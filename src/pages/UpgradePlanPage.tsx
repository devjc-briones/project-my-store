import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Landmark,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { useStore } from '../context/StoreContext';
import { getPlatformPlans, PlanId } from '../data/plans';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { PlatformPaymentChannel, PlatformPaymentChannelType } from '../types/schema';
import {
  PaymentGatewayPublicConfig,
  PaymentSessionIntent,
  createPaymentSessionIntent,
  fetchPaymentGatewayConfig,
  fetchPaymentSessionByReference,
  isAllowedPaymongoRedirect,
  pollPaymentSessionIntent,
} from '../utils/paymentGateway';

function getChannelIcon(type: PlatformPaymentChannelType) {
  switch (type) {
    case 'ewallet':
      return Smartphone;
    case 'bank':
      return Landmark;
    default:
      return QrCode;
  }
}

function getDefaultPeriodEndIso(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

function formatBillingDate(isoString?: string): string {
  const target = isoString ? new Date(isoString) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(target.getTime())) {
    return 'end of billing cycle';
  }
  return target.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCountdown(expiresAtIso?: string, nowMs = Date.now()): string {
  if (!expiresAtIso) return '30:00';
  const diffSec = Math.max(0, Math.floor((new Date(expiresAtIso).getTime() - nowMs) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function UpgradePlanPage() {
  const {
    state,
    navigate,
    updateUserProfile,
    recordSubscriptionPayment,
    confirmGatewaySubscription,
    platformPaymentSettings,
    proMonthlyPrice,
    pushToast,
  } = useStore();
  const user = state.currentUser;
  const currentPlanId: PlanId = user?.plan ?? 'starter';
  const isPaidPlan = currentPlanId !== 'starter';
  const isCancellationScheduled = Boolean(isPaidPlan && user?.cancelAtPeriodEnd);
  const platformPlans = useMemo(() => getPlatformPlans(proMonthlyPrice), [proMonthlyPrice]);

  const resolvedPeriodEndsAt = useMemo(() => {
    if (!isPaidPlan) return undefined;
    if (user?.planPeriodEndsAt) return user.planPeriodEndsAt;

    const latestPaidTx = (state.subscriptionTransactions ?? [])
      .filter((tx) => tx.userId === user?.id && tx.status === 'paid')
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const anchorIso = latestPaidTx?.createdAt ?? user?.createdAt;
    if (anchorIso) {
      const anchorMs = new Date(anchorIso).getTime();
      if (!Number.isNaN(anchorMs)) {
        return new Date(anchorMs + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
    }
    return getDefaultPeriodEndIso();
  }, [isPaidPlan, user?.planPeriodEndsAt, user?.id, user?.createdAt, state.subscriptionTransactions]);

  const periodEndsAtFormatted = formatBillingDate(resolvedPeriodEndsAt);

  const daysUntilDue = useMemo(() => {
    if (!resolvedPeriodEndsAt) return null;
    const dueMs = new Date(resolvedPeriodEndsAt).getTime();
    if (Number.isNaN(dueMs)) return null;
    return Math.ceil((dueMs - Date.now()) / (24 * 60 * 60 * 1000));
  }, [resolvedPeriodEndsAt]);

  const pendingSubscriptionTx = useMemo(
    () =>
      (state.subscriptionTransactions ?? [])
        .filter((tx) => tx.userId === user?.id && tx.status === 'pending')
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ??
      null,
    [state.subscriptionTransactions, user?.id]
  );

  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayPublicConfig | null>(null);

  useEffect(() => {
    fetchPaymentGatewayConfig()
      .then((cfg) => setGatewayConfig(cfg))
      .catch(() => {
        // Fallback silently if offline
      });
  }, []);

  const configuredChannels = useMemo(
    () => platformPaymentSettings.channels.filter((c) => c.enabled),
    [platformPaymentSettings.channels]
  );

  const availableChannels = useMemo<PlatformPaymentChannel[]>(() => {
    if (configuredChannels.length > 0) return configuredChannels;
    if (gatewayConfig?.engine === 'paymongo') {
      return [
        {
          id: 'qrph',
          type: 'ewallet',
          label: 'GCash / Maya / QR Ph',
          subtitle: 'Instant local checkout via PayMongo',
          enabled: true,
          requiresReceipt: false,
          accountName: 'PayMongo Checkout',
          numberLabel: 'Gateway',
          accountNumber: 'QR Ph / E-Wallets / PH Banks',
        },
      ];
    }
    return [];
  }, [configuredChannels, gatewayConfig?.engine]);

  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('pro');
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    () => availableChannels[0]?.id ?? ''
  );
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedExactAmount, setCopiedExactAmount] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Zero-receipt live payment session state
  const [paymentSession, setPaymentSession] = useState<PaymentSessionIntent | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isResumingSession, setIsResumingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const pendingStorageKey = user?.id ? `mystore_pending_sub_session:${user.id}` : null;

  const readCachedSubscriptionSession = (): PaymentSessionIntent | null => {
    if (!pendingStorageKey || typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(pendingStorageKey);
      if (!raw) return null;
      return JSON.parse(raw) as PaymentSessionIntent;
    } catch {
      return null;
    }
  };

  const writeCachedSubscriptionSession = (session: PaymentSessionIntent | null) => {
    if (!pendingStorageKey || typeof window === 'undefined') return;
    try {
      if (!session || session.status === 'paid') {
        window.localStorage.removeItem(pendingStorageKey);
      } else {
        window.localStorage.setItem(pendingStorageKey, JSON.stringify(session));
      }
    } catch {
      // Ignore storage quota restrictions
    }
  };

  // Confirmation banner state
  const [completedUpgrade, setCompletedUpgrade] = useState<{
    planName: string;
    priceLabel: string;
    paymentLabel: string;
    referenceId: string;
  } | null>(null);

  useBodyScrollLock(cancelModalOpen || paymentModalOpen);

  useEffect(() => {
    if (!cancelModalOpen && !paymentModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCancelModalOpen(false);
        setPaymentModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelModalOpen, paymentModalOpen]);

  const currentPlan = useMemo(
    () => platformPlans.find((p) => p.id === currentPlanId) ?? platformPlans[0],
    [platformPlans, currentPlanId]
  );

  const selectedPlan = useMemo(
    () => platformPlans.find((p) => p.id === selectedPlanId) ?? platformPlans[1],
    [platformPlans, selectedPlanId]
  );

  useEffect(() => {
    if (availableChannels.length === 0) {
      setSelectedChannelId('');
      return;
    }
    if (!availableChannels.some((c) => c.id === selectedChannelId)) {
      setSelectedChannelId(availableChannels[0].id);
    }
  }, [availableChannels, selectedChannelId]);

  const activeChannel = useMemo(
    () =>
      availableChannels.find((c) => c.id === selectedChannelId) ??
      availableChannels[0] ??
      null,
    [availableChannels, selectedChannelId]
  );

  const isPlanDue = useMemo(() => {
    if (!isPaidPlan || isCancellationScheduled || !resolvedPeriodEndsAt) return false;
    const dueMs = new Date(resolvedPeriodEndsAt).getTime();
    return !Number.isNaN(dueMs) && Date.now() >= dueMs;
  }, [isPaidPlan, isCancellationScheduled, resolvedPeriodEndsAt]);

  const isSamePlan = selectedPlan.id === currentPlanId;
  const isRenewalDue = isSamePlan && isPlanDue;
  const requiresPayment = selectedPlan.monthlyPrice > 0 && (!isSamePlan || isRenewalDue);

  // Check URL return from PayMongo redirect (?payment_session=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const returnedSessionId = params.get('payment_session');
    if (!returnedSessionId) return;

    pollPaymentSessionIntent(returnedSessionId)
      .then(async (session) => {
        if (session.status === 'paid') {
          await confirmGatewaySubscription({
            referenceId: session.referenceCode,
            planId: 'pro',
            amount: session.baseAmount,
            paymentMethod: session.channelLabel || 'PayMongo',
          });
          setCompletedUpgrade({
            planName: 'Pro',
            priceLabel: `₱${session.baseAmount} / month`,
            paymentLabel: session.channelLabel || 'PayMongo',
            referenceId: session.referenceCode,
          });
          pushToast({
            type: 'success',
            title: 'Payment confirmed — Pro Plan activated',
            description: `Reference ${session.referenceCode} verified automatically.`,
          });
        }
      })
      .catch(() => {
        // Ignore stale session IDs
      });
  }, [confirmGatewaySubscription, pushToast]);

  // Countdown tick while waiting for payment
  useEffect(() => {
    if (!paymentModalOpen || !paymentSession || paymentSession.status !== 'awaiting_payment') return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paymentModalOpen, paymentSession]);

  // Poll live status for active awaiting_payment session
  useEffect(() => {
    if (!paymentModalOpen || !paymentSession || paymentSession.status !== 'awaiting_payment') return;
    let active = true;

    const checkStatus = async () => {
      try {
        const latest = await pollPaymentSessionIntent(paymentSession.id, paymentSession.readToken);
        if (!active) return;
        setPaymentSession((prev) =>
          prev
            ? {
                ...latest,
                readToken: prev.readToken,
              }
            : latest
        );

        if (latest.status === 'paid') {
          writeCachedSubscriptionSession(null);
          await confirmGatewaySubscription({
            referenceId: latest.referenceCode,
            planId: 'pro',
            amount: latest.baseAmount,
            paymentMethod: latest.channelLabel || activeChannel?.label || 'Local Payment',
          });
          if (!active) return;
          setCompletedUpgrade({
            planName: selectedPlan.name,
            priceLabel: `${selectedPlan.priceLabel} / month`,
            paymentLabel: latest.channelLabel || activeChannel?.label || 'Local Payment',
            referenceId: latest.referenceCode,
          });
          pushToast({
            type: 'success',
            title: 'Payment confirmed automatically',
            description: `${selectedPlan.name} plan activated for ${latest.referenceCode} without receipt upload.`,
          });
        }
      } catch {
        // Keep polling gracefully on transient network hiccups
      }
    };

    const interval = window.setInterval(checkStatus, 2500);
    window.addEventListener('focus', checkStatus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', checkStatus);
    };
  }, [
    paymentModalOpen,
    paymentSession,
    activeChannel?.label,
    confirmGatewaySubscription,
    pushToast,
    selectedPlan.name,
    selectedPlan.priceLabel,
  ]);

  const handleResumePendingPayment = async () => {
    if (!pendingSubscriptionTx) return;
    const targetPlanId: PlanId = pendingSubscriptionTx.planId || 'pro';
    setSelectedPlanId(targetPlanId);
    setCompletedUpgrade(null);
    setSessionError(null);
    setCopiedNumber(false);
    setCopiedExactAmount(false);

    const matchedChannel =
      availableChannels.find(
        (c) =>
          c.id === pendingSubscriptionTx.paymentMethod.toLowerCase() ||
          c.label.toLowerCase() === pendingSubscriptionTx.paymentMethod.toLowerCase()
      ) ?? availableChannels[0];
    if (matchedChannel) {
      setSelectedChannelId(matchedChannel.id);
    }

    setPaymentModalOpen(true);

    // If current state already holds the awaiting session, keep it immediately
    if (
      paymentSession &&
      paymentSession.referenceCode === pendingSubscriptionTx.referenceId &&
      paymentSession.status === 'awaiting_payment'
    ) {
      return;
    }

    const cached = readCachedSubscriptionSession();
    if (cached && cached.referenceCode === pendingSubscriptionTx.referenceId) {
      setPaymentSession(cached);
      const cachedChannel = availableChannels.find((c) => c.id === cached.channel);
      if (cachedChannel) setSelectedChannelId(cachedChannel.id);
    }

    setIsResumingSession(true);
    try {
      let latest: PaymentSessionIntent | null = null;
      if (cached && cached.referenceCode === pendingSubscriptionTx.referenceId) {
        latest = await pollPaymentSessionIntent(cached.id, cached.readToken).catch(() => null);
        if (latest) {
          latest = { ...latest, readToken: cached.readToken };
        }
      }
      if (!latest) {
        latest = await fetchPaymentSessionByReference(pendingSubscriptionTx.referenceId);
      }
      setPaymentSession(latest);
      writeCachedSubscriptionSession(latest);
      const sessionChannel = availableChannels.find((c) => c.id === latest.channel);
      if (sessionChannel) setSelectedChannelId(sessionChannel.id);

      if (latest.status === 'paid') {
        writeCachedSubscriptionSession(null);
        await confirmGatewaySubscription({
          referenceId: latest.referenceCode,
          planId: 'pro',
          amount: latest.baseAmount,
          paymentMethod:
            latest.channelLabel || pendingSubscriptionTx.paymentMethod || 'Local Payment',
        });
        setCompletedUpgrade({
          planName: 'Pro',
          priceLabel: `₱${latest.baseAmount} / month`,
          paymentLabel:
            latest.channelLabel || pendingSubscriptionTx.paymentMethod || 'Local Payment',
          referenceId: latest.referenceCode,
        });
      }
    } catch {
      if (!cached || cached.referenceCode !== pendingSubscriptionTx.referenceId) {
        setPaymentSession(null);
      }
    } finally {
      setIsResumingSession(false);
    }
  };

  const handleSelectPlan = (planId: PlanId) => {
    const isPayingDueCurrentPlan = planId === currentPlanId && isPlanDue;
    if (planId === currentPlanId && !isPayingDueCurrentPlan) return;
    if (pendingSubscriptionTx && planId === pendingSubscriptionTx.planId) {
      void handleResumePendingPayment();
      return;
    }

    const targetPlan = platformPlans.find((p) => p.id === planId);
    if (!targetPlan) return;

    if (targetPlan.monthlyPrice === 0) {
      if (isPaidPlan && !isCancellationScheduled) {
        setCancelModalOpen(true);
      } else if (isCancellationScheduled) {
        handleRevertToFreeAfterTerm();
      }
      return;
    }

    setSelectedPlanId(planId);
    setCompletedUpgrade(null);
    setPaymentSession(null);
    setSessionError(null);
    setCopiedNumber(false);
    setCopiedExactAmount(false);
    setPaymentModalOpen(true);
  };

  const handleConfirmScheduleCancel = () => {
    const endIso = resolvedPeriodEndsAt ?? getDefaultPeriodEndIso();
    updateUserProfile({
      cancelAtPeriodEnd: true,
      planPeriodEndsAt: endIso,
    });
    setCancelModalOpen(false);
    setCompletedUpgrade(null);
    pushToast({
      type: 'info',
      title: `${currentPlan.name} cancellation scheduled`,
      description: `You will keep ${currentPlan.name} access until ${formatBillingDate(
        endIso
      )}, then your account returns to Free.`,
    });
  };

  const handleResumePaidPlan = () => {
    updateUserProfile({
      cancelAtPeriodEnd: false,
    });
    pushToast({
      type: 'success',
      title: `${currentPlan.name} plan resumed`,
      description: 'Your paid subscription will continue normally.',
    });
  };

  const handleRevertToFreeAfterTerm = () => {
    updateUserProfile({
      plan: 'starter',
      cancelAtPeriodEnd: false,
      planPeriodEndsAt: undefined,
    });
    setCompletedUpgrade(null);
    setSelectedPlanId('pro');
    pushToast({
      type: 'info',
      title: 'Returned to Free plan',
      description:
        'All your existing stores and data are preserved. Free plan store limits now apply.',
    });
  };

  const handleCopyText = async (value: string, type: 'number' | 'amount') => {
    try {
      await navigator.clipboard.writeText(value);
      if (type === 'number') {
        setCopiedNumber(true);
        window.setTimeout(() => setCopiedNumber(false), 1800);
      } else {
        setCopiedExactAmount(true);
        window.setTimeout(() => setCopiedExactAmount(false), 1800);
      }
    } catch {
      // Ignore restricted clipboard
    }
  };

  const handleStartZeroReceiptSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isCreatingSession) return;
    if (isSamePlan && !isRenewalDue) return;

    if (selectedPlan.monthlyPrice === 0) {
      if (isPaidPlan && !isCancellationScheduled) {
        setCancelModalOpen(true);
      } else if (isCancellationScheduled) {
        handleRevertToFreeAfterTerm();
      }
      return;
    }

    if (!activeChannel) {
      pushToast({
        type: 'error',
        title: 'No Payment Method Available',
        description: 'No subscription payment methods are currently enabled by admin.',
      });
      return;
    }

    if (!user) return;

    setIsCreatingSession(true);
    setSessionError(null);
    try {
      const session = await createPaymentSessionIntent({
        targetType: 'subscription',
        channel: activeChannel.id,
        channelLabel: activeChannel.label,
        planId: 'pro',
        baseAmount: selectedPlan.monthlyPrice,
        currency: 'PHP',
      });
      setPaymentSession(session);
      writeCachedSubscriptionSession(session);
      setNowMs(Date.now());

      // Record pending subscription transaction tied to this exact reference code (no receipt needed)
      await recordSubscriptionPayment({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        planId: selectedPlan.id,
        amount: selectedPlan.monthlyPrice,
        paymentMethod: activeChannel.label,
        referenceId: session.referenceCode,
        status: 'pending',
        dueDate: isRenewalDue ? resolvedPeriodEndsAt : undefined,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to initialize payment gateway session.';
      setSessionError(message);
      pushToast({
        type: 'error',
        title: 'Payment Session Failed',
        description: message,
      });
    } finally {
      setIsCreatingSession(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <DashboardHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Top Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => navigate({ name: 'dashboard' })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Subscription Plans &amp; Billing
            </h1>
            <p className="text-sm text-slate-600">
              Choose a plan and pay via GCash, Maya, or PH Bank Transfer with automatic confirmation—no receipt upload required.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] self-start lg:self-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500">Current Active Plan</p>
                <p className="text-sm font-bold text-slate-900">
                  {currentPlan.name} ({currentPlan.priceLabel})
                </p>
                {isPaidPlan ? (
                  <p
                    className={`mt-0.5 inline-flex flex-wrap items-center gap-1.5 text-[11px] font-semibold ${
                      isCancellationScheduled || (daysUntilDue !== null && daysUntilDue <= 5)
                        ? 'text-amber-700'
                        : 'text-slate-600'
                    }`}
                  >
                    <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isCancellationScheduled
                        ? `Ends on ${periodEndsAtFormatted}`
                        : `Due date: ${periodEndsAtFormatted}`}
                    </span>
                    {!isCancellationScheduled && daysUntilDue !== null && (
                      <span className="text-slate-400 font-medium">
                        ·{' '}
                        {daysUntilDue < 0
                          ? 'Overdue'
                          : daysUntilDue === 0
                            ? 'Due today'
                            : daysUntilDue === 1
                              ? '1 day left'
                              : `${daysUntilDue} days left`}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                    No billing due · Forever free
                  </p>
                )}
              </div>
            </div>

            {isPaidPlan && !isCancellationScheduled && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {isPlanDue && !pendingSubscriptionTx && (
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(currentPlanId)}
                    className="min-h-[36px] px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Pay Due ({currentPlan.priceLabel})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Cancel Plan
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scheduled Cancellation Notice */}
        {isCancellationScheduled && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm sm:text-base font-bold text-slate-900">
                  {currentPlan.name} plan cancellation scheduled (ends {periodEndsAtFormatted})
                </p>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  You will continue enjoying {currentPlan.name} benefits until your paid period
                  finishes, then your account automatically switches back to{' '}
                  <strong>Free</strong>. All your existing stores, products, and data stay
                  intact, and Free plan limits will apply.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleResumePaidPlan}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Resume {currentPlan.name}
              </button>
              <button
                type="button"
                onClick={handleRevertToFreeAfterTerm}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Finish Term &amp; Switch to Free Now
              </button>
            </div>
          </div>
        )}

        {/* Overdue Plan Notice */}
        {isPlanDue && !pendingSubscriptionTx && !completedUpgrade && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-base font-bold text-amber-950">
                  All active stores are temporarily closed due to unpaid plan
                </p>
                <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                  Your billing period ended on <strong>{periodEndsAtFormatted}</strong> and your
                  active storefronts are temporarily closed. Pay your due plan now to automatically
                  reopen full access.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSelectPlan(currentPlanId)}
              className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              Pay Due Plan ({currentPlan.priceLabel})
            </button>
          </div>
        )}

        {/* Confirmed or Pending Payment Notice */}
        {completedUpgrade ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-base font-bold text-emerald-950">
                  {completedUpgrade.planName} Plan Activated!
                </p>
                <p className="text-xs sm:text-sm text-emerald-900">
                  Reference <span className="font-mono font-semibold">{completedUpgrade.referenceId}</span>{' '}
                  · {completedUpgrade.priceLabel} via {completedUpgrade.paymentLabel}. Payment
                  confirmed automatically—all Pro templates and multi-store limits are unlocked.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate({ name: 'dashboard' })}
              className="min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer shrink-0"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          pendingSubscriptionTx && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Clock className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-base font-bold text-slate-900">
                    Pro Plan awaiting transfer confirmation
                  </p>
                  <p className="text-xs sm:text-sm text-slate-700">
                    Reference{' '}
                    <span className="font-mono font-semibold">
                      {pendingSubscriptionTx.referenceId}
                    </span>{' '}
                    · ₱{pendingSubscriptionTx.amount} / month via{' '}
                    {pendingSubscriptionTx.paymentMethod}. Open the payment details anytime to see
                    your QR code and exact centavo amount.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleResumePendingPayment()}
                  className="min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer shrink-0 inline-flex items-center justify-center gap-1.5"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Continue Payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'dashboard' })}
                  className="min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer shrink-0"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )
        )}

        {/* Platform Plans Grid */}
        <section aria-label="Available subscription plans" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl gap-5 sm:gap-6">
            {platformPlans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const isDueRenewalCard = isCurrent && isPlanDue;
              const isPendingThisPlan = Boolean(
                pendingSubscriptionTx && plan.id === pendingSubscriptionTx.planId
              );
              const isFreeDowngrade = plan.monthlyPrice === 0 && isPaidPlan;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-6 flex flex-col justify-between border text-left transition-all ${
                    plan.featured
                      ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                      : 'bg-white text-slate-900 border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-5">
                      <div>
                        <p
                          className={`text-xs font-medium ${
                            plan.featured ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {plan.audience}
                        </p>
                        <h2 className="text-xl font-bold mt-1">{plan.name}</h2>
                      </div>

                      {isCurrent && (
                        <span
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg shrink-0 ${
                            isCancellationScheduled || isDueRenewalCard
                              ? plan.featured
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                              : plan.featured
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isCancellationScheduled
                            ? 'Canceling'
                            : isDueRenewalCard
                              ? 'Payment Due'
                              : 'Current Plan'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2 pb-5 border-b border-current/15">
                      <span className="text-3xl font-extrabold tabular-nums">
                        {plan.priceLabel}
                      </span>
                      <span
                        className={`text-xs ${
                          plan.featured ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {plan.cadence}
                      </span>
                    </div>

                    <ul className="space-y-3 py-5 text-sm">
                      {plan.highlights.map((line) => (
                        <li key={line} className="flex items-start gap-2.5">
                          <Check
                            className={`w-4 h-4 mt-0.5 shrink-0 ${
                              plan.featured ? 'text-emerald-400' : 'text-slate-700'
                            }`}
                          />
                          <span className={plan.featured ? 'text-slate-200' : 'text-slate-600'}>
                            {line}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={isCurrent && !isDueRenewalCard}
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                      isPendingThisPlan
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold cursor-pointer shadow-sm'
                        : isDueRenewalCard
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold cursor-pointer shadow-sm'
                          : isCurrent
                            ? plan.featured
                              ? 'bg-white/15 text-white/80 cursor-default'
                              : 'bg-slate-100 text-slate-500 cursor-default'
                            : isFreeDowngrade
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 cursor-pointer'
                              : plan.featured
                                ? 'bg-white text-slate-900 hover:bg-slate-100 cursor-pointer'
                                : 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    {isPendingThisPlan
                      ? 'Continue Payment (View QR)'
                      : isDueRenewalCard
                        ? `Pay Due Plan (${plan.priceLabel})`
                        : isCurrent
                          ? isCancellationScheduled
                            ? `Ends ${periodEndsAtFormatted}`
                            : 'Current Active Plan'
                          : isFreeDowngrade
                            ? isCancellationScheduled
                              ? 'Switch to Free Now'
                              : 'Downgrade to Free'
                            : `Choose ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Zero-Receipt Pay for Plan Modal */}
      {paymentModalOpen && requiresPayment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-plan-modal-title"
          onClick={() => setPaymentModalOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/55 backdrop-blur-xs"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-3xl max-h-[92dvh] bg-white border border-slate-200/80 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    id="pay-plan-modal-title"
                    className="text-lg font-bold text-slate-900 truncate"
                  >
                    {isRenewalDue
                      ? `Pay Due ${selectedPlan.name} Plan`
                      : `Pay for ${selectedPlan.name} Plan`}
                  </h2>
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-900 text-white shrink-0">
                    {selectedPlan.priceLabel}/mo
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instant local payment via GCash, Maya, or Bank Transfer—no receipt upload needed.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close payment modal"
                onClick={() => setPaymentModalOpen(false)}
                className="w-9 h-9 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Checkout Body */}
            <form
              onSubmit={handleStartZeroReceiptSession}
              noValidate
              className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Method Selector & Live Zero-Receipt Payment View */}
                <div className="lg:col-span-7 space-y-4">
                  {availableChannels.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-2">
                      <AlertCircle className="w-6 h-6 text-amber-700 mx-auto" />
                      <p className="text-sm font-bold text-amber-950">
                        No payment methods available right now
                      </p>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        The platform administrator has not enabled any subscription payment channels
                        yet. Please check back soon.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Method Selector */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {availableChannels.map((channel) => {
                          const Icon = getChannelIcon(channel.type);
                          const active = activeChannel?.id === channel.id;
                          return (
                            <button
                              key={channel.id}
                              type="button"
                              disabled={Boolean(paymentSession && paymentSession.status === 'paid')}
                              onClick={() => {
                                setSelectedChannelId(channel.id);
                                setPaymentSession(null);
                                setSessionError(null);
                                setCopiedNumber(false);
                                setCopiedExactAmount(false);
                              }}
                              className={`p-3 rounded-xl border text-left flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                active
                                  ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate">
                                    {channel.label}
                                  </p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {channel.subtitle}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  active ? 'border-slate-900' : 'border-slate-300'
                                }`}
                              >
                                {active && <span className="w-2 h-2 rounded-full bg-slate-900" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Channel Details OR Live Payment Session */}
                      {activeChannel && !paymentSession && isResumingSession && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-center space-y-2">
                          <Loader2 className="w-6 h-6 animate-spin text-slate-700 mx-auto" />
                          <p className="text-xs font-semibold text-slate-700">
                            Restoring your pending payment details...
                          </p>
                        </div>
                      )}

                      {activeChannel && !paymentSession && !isResumingSession && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <QrCode className="w-4 h-4 text-slate-900" />
                            <span>{activeChannel.label} — Automated Checkout</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Click <strong>Continue to Pay</strong> on the right to lock in your payment
                            session. You won&apos;t need to upload any screenshot or receipt—just
                            complete the transfer and your Pro plan unlocks automatically.
                          </p>
                          {sessionError && (
                            <p
                              role="alert"
                              className="flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
                            >
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{sessionError}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {paymentSession && paymentSession.status === 'paid' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
                          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                          <div className="space-y-1">
                            <p className="text-base font-bold text-emerald-950">
                              Payment Confirmed!
                            </p>
                            <p className="text-xs text-emerald-800">
                              Reference <span className="font-mono font-bold">{paymentSession.referenceCode}</span>{' '}
                              verified automatically. Your {selectedPlan.name} plan is now active.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPaymentModalOpen(false)}
                            className="min-h-[40px] px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      )}

                      {paymentSession && paymentSession.status === 'expired' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-3">
                          <Clock className="w-8 h-8 text-amber-700 mx-auto" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-amber-950">
                              Payment session expired
                            </p>
                            <p className="text-xs text-amber-800">
                              The 30-minute transfer window elapsed. Generate a fresh exact amount to
                              continue.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartZeroReceiptSession()}
                            className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Generate New Amount</span>
                          </button>
                        </div>
                      )}

                      {paymentSession && paymentSession.status === 'awaiting_payment' && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
                          {/* Live Listening Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Listening for payment confirmation...</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-700 tabular-nums">
                              Expires in {formatCountdown(paymentSession.expiresAt, nowMs)}
                            </span>
                          </div>

                          {paymentSession.provider === 'paymongo' &&
                          isAllowedPaymongoRedirect(paymentSession.checkoutUrl) ? (
                            <div className="space-y-3 text-center py-2">
                              <p className="text-xs text-slate-600 leading-relaxed">
                                Complete your payment securely on PayMongo using{' '}
                                <strong>GCash, Maya, QR Ph, or Online Banking</strong>. No receipt upload
                                required.
                              </p>
                              <a
                                href={paymentSession.checkoutUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
                              >
                                <span>Open PayMongo Checkout</span>
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          ) : (
                            <>
                              {/* Exact Unique Centavo Amount Card */}
                              <div className="bg-white border-2 border-slate-900 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Transfer Exact Amount (Auto-Match)
                                  </p>
                                  <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 mt-0.5">
                                    ₱{paymentSession.uniquePayableAmount.toFixed(2)}
                                  </p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Send exact centavos so we unlock Pro automatically—no receipt needed.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyText(
                                      paymentSession.uniquePayableAmount.toFixed(2),
                                      'amount'
                                    )
                                  }
                                  className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"
                                >
                                  {copiedExactAmount ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Copied Amount</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy Exact ₱</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* QR + Account Details */}
                              {activeChannel && (
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                  {activeChannel.qrImageUrl && (
                                    <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-xs shrink-0">
                                      <img
                                        src={activeChannel.qrImageUrl}
                                        alt={`${activeChannel.label} Payment QR`}
                                        className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg"
                                      />
                                    </div>
                                  )}

                                  <div
                                    className={`flex-1 w-full space-y-2 ${
                                      activeChannel.qrImageUrl
                                        ? 'text-center sm:text-left'
                                        : 'text-left'
                                    }`}
                                  >
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        Account Name
                                      </p>
                                      <p className="text-sm font-bold text-slate-900">
                                        {activeChannel.accountName || 'mystore Platform Billing'}
                                      </p>
                                    </div>

                                    {activeChannel.accountNumber && (
                                      <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                          {activeChannel.numberLabel || 'Account Number'}
                                        </p>
                                        <div
                                          className={`flex items-center gap-2 mt-0.5 flex-wrap ${
                                            activeChannel.qrImageUrl
                                              ? 'justify-center sm:justify-start'
                                              : 'justify-start'
                                          }`}
                                        >
                                          <span className="text-base font-mono font-bold text-slate-900 select-all">
                                            {activeChannel.accountNumber}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleCopyText(activeChannel.accountNumber, 'number')
                                            }
                                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
                                          >
                                            {copiedNumber ? (
                                              <>
                                                <Check className="w-3 h-3 text-emerald-600" />
                                                <span>Copied</span>
                                              </>
                                            ) : (
                                              <>
                                                <Copy className="w-3 h-3" />
                                                <span>Copy</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    <p className="text-[11px] font-mono text-slate-500">
                                      Session Ref: {paymentSession.referenceCode}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Right: Billing Summary & Submit CTA */}
                <div className="lg:col-span-5 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Plan Summary
                    </p>
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedPlan.name} Plan
                    </h3>
                    <p className="text-xs text-slate-500">{selectedPlan.audience}</p>
                  </div>

                  <dl className="space-y-2 pt-3 border-t border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-600">Account</dt>
                      <dd className="font-semibold text-slate-900 truncate max-w-[180px]">
                        {user?.email ?? 'merchant@mystore.com'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-600">Current Tier</dt>
                      <dd className="font-semibold text-slate-900 capitalize">{currentPlan.name}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-600">{isRenewalDue ? 'Renewal' : 'New Plan'}</dt>
                      <dd className="font-semibold text-slate-900">
                        {isRenewalDue ? `${selectedPlan.name} (+30 days)` : selectedPlan.name}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-600">Payment Channel</dt>
                      <dd className="font-semibold text-slate-900">
                        {activeChannel?.label ?? 'None selected'}
                      </dd>
                    </div>
                    <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
                      <dt className="text-sm font-bold text-slate-900">
                        {paymentSession ? 'Exact Payable Total' : 'Total Due'}
                      </dt>
                      <dd className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
                        {paymentSession
                          ? `₱${paymentSession.uniquePayableAmount.toFixed(2)}`
                          : selectedPlan.priceLabel}
                        {!paymentSession && (
                          <span className="text-xs font-sans font-medium text-slate-500 ml-1">
                            /mo
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="space-y-2 pt-1">
                    {!paymentSession ? (
                      <button
                        type="submit"
                        disabled={!activeChannel || isCreatingSession}
                        className="w-full min-h-[46px] px-5 py-3 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
                      >
                        {isCreatingSession ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Preparing Payment...</span>
                          </>
                        ) : isRenewalDue ? (
                          `Continue to Pay (${selectedPlan.priceLabel})`
                        ) : (
                          `Continue to Pay (${selectedPlan.priceLabel})`
                        )}
                      </button>
                    ) : paymentSession.status === 'awaiting_payment' ? (
                      <div className="w-full min-h-[46px] px-4 py-3 text-xs font-semibold rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center gap-2 text-center">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Waiting for automatic payment alert...</span>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setPaymentModalOpen(false)}
                      className="w-full min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
                    >
                      {paymentSession?.status === 'paid'
                        ? 'Close'
                        : paymentSession?.status === 'awaiting_payment'
                          ? 'Close (Pay Later)'
                          : 'Cancel'}
                    </button>
                  </div>

                  <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Zero receipt upload · Activates automatically on confirmation.</span>
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Paid Plan Confirmation Modal */}
      {cancelModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-plan-modal-title"
          onClick={() => setCancelModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="cancel-plan-modal-title"
                      className="text-lg font-bold text-slate-900 leading-tight"
                    >
                      Cancel {currentPlan.name} Plan?
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ends on {periodEndsAtFormatted}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close cancel plan dialog"
                  onClick={() => setCancelModalOpen(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <p>
                  Your <strong>{currentPlan.name}</strong> subscription will stay active until your
                  current paid term ends on <strong>{periodEndsAtFormatted}</strong>, then your
                  account will automatically return to <strong>Free</strong>.
                </p>
                <p className="text-slate-600">
                  None of your existing stores, products, prices, or orders will be deleted—however,
                  once back on Free, Free plan limits (1 store limit, max 25 products per store)
                  will apply so you won&apos;t be able to add extra shops.
                </p>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200/80 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="min-h-[44px] px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
              >
                Keep {currentPlan.name}
              </button>
              <button
                type="button"
                onClick={handleConfirmScheduleCancel}
                className="min-h-[44px] px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
