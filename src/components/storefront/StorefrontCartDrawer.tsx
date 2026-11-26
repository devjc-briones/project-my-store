import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Landmark,
  Loader2,
  Minus,
  PackageSearch,
  Plus,
  QrCode,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { TEMPLATE_SHOWCASE_MEDIA } from '../../data/templateVisuals';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { resolveThemeTokens } from '../../templates/templateTypes';
import {
  BuyerAccount,
  BuyerCheckoutInfo,
  CustomerOrder,
  OrderPaymentStatus,
  PaymentSettings,
  Store,
} from '../../types/schema';
import {
  PaymentSessionIntent,
  createPaymentSessionIntent,
  isAllowedPaymongoRedirect,
  pollPaymentSessionIntent,
} from '../../utils/paymentGateway';
import { formatCurrency } from '../../utils/pricing';
import { useStore } from '../../context/StoreContext';
import { BuyerAuthModal } from './BuyerAuthModal';

export interface CartLineItem {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  variant?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
}

type PaymentMethodKey = 'gcash' | 'maya' | 'bank' | 'cod';

interface EnabledPaymentOption {
  key: PaymentMethodKey;
  label: string;
  subtitle: string;
  icon: typeof Smartphone;
}

interface StorefrontCartDrawerProps {
  isOpen: boolean;
  store: Store;
  items: CartLineItem[];
  paymentSettings: PaymentSettings;
  onClose: () => void;
  onUpdateQuantity: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onClearCart: () => void;
  onPlaceOrder: (
    orderInput: Omit<CustomerOrder, 'id' | 'status' | 'createdAt'>
  ) => CustomerOrder;
  onTrackOrder?: (orderId: string) => void;
  onOpenInfoSettings?: () => void;
}

interface CheckoutFieldErrors {
  customerName?: string;
  phoneNumber?: string;
  deliveryAddress?: string;
}

const NON_KEYBOARD_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'radio',
  'submit',
  'reset',
  'file',
  'range',
  'color',
  'hidden',
]);

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  if (target instanceof HTMLInputElement) {
    return !NON_KEYBOARD_INPUT_TYPES.has(target.type);
  }
  return target.isContentEditable;
}

export function StorefrontCartDrawer({
  isOpen,
  store,
  items,
  paymentSettings,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onPlaceOrder,
  onTrackOrder,
  onOpenInfoSettings,
}: StorefrontCartDrawerProps) {
  useBodyScrollLock(isOpen);
  const { state, pushToast, getBuyerCheckoutInfo, saveBuyerCheckoutInfo } = useStore();

  const theme = resolveThemeTokens(store.branding, store.templateId);
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA[store.templateId].imageUrl;
  const currency = paymentSettings.currency;

  const savedBuyerInfo = state.currentBuyer ? getBuyerCheckoutInfo() : null;
  const hasSavedBuyerInfo = Boolean(
    state.currentBuyer &&
      savedBuyerInfo &&
      (savedBuyerInfo.fullName.trim() ||
        savedBuyerInfo.phoneNumber.trim() ||
        savedBuyerInfo.deliveryAddress.trim())
  );

  const [step, setStep] = useState<'cart' | 'checkout' | 'receipt'>('cart');
  const [customerName, setCustomerName] = useState(
    savedBuyerInfo?.fullName || state.currentBuyer?.name || ''
  );
  const [phoneNumber, setPhoneNumber] = useState(savedBuyerInfo?.phoneNumber ?? '');
  const [showBuyerAuth, setShowBuyerAuth] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(
    savedBuyerInfo?.deliveryAddress ?? ''
  );
  const [notes, setNotes] = useState(savedBuyerInfo?.notes ?? '');
  const [saveInfoForLater, setSaveInfoForLater] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [shakeForm, setShakeForm] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<CustomerOrder | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  // Mobile keyboard / input focus tracking so Place Order footer doesn't cover checkout inputs
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const blurTimerRef = useRef<number | null>(null);
  const maxViewportHeightRef = useRef<number>(
    typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 0
  );

  // Zero-receipt online payment session state
  const [paymentQrModalOpen, setPaymentQrModalOpen] = useState(false);
  const [orderPaymentSession, setOrderPaymentSession] = useState<PaymentSessionIntent | null>(null);
  const [isCreatingOrderSession, setIsCreatingOrderSession] = useState(false);
  const [orderSessionError, setOrderSessionError] = useState<string | null>(null);
  const [copiedAccountNumber, setCopiedAccountNumber] = useState(false);
  const [copiedExactAmount, setCopiedExactAmount] = useState(false);
  const [orderCountdownNowMs, setOrderCountdownNowMs] = useState(() => Date.now());
  const autoConfirmedGuardRef = useRef(false);

  const fullNameRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const addressRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    maxViewportHeightRef.current = vv.height;
    let wasKeyboardOpen = false;

    const handleResize = () => {
      const currentHeight = vv.height;
      if (currentHeight > maxViewportHeightRef.current) {
        maxViewportHeightRef.current = currentHeight;
      }
      const shrunk = maxViewportHeightRef.current - currentHeight > 130;
      if (shrunk) {
        wasKeyboardOpen = true;
        setIsKeyboardOpen(true);
      } else if (wasKeyboardOpen) {
        wasKeyboardOpen = false;
        setIsKeyboardOpen(false);
        setIsInputFocused(false);
      }
    };

    const handleOrientation = () => {
      maxViewportHeightRef.current = vv.height;
      setIsKeyboardOpen(false);
    };

    vv.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientation);
    return () => {
      vv.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  const handleFormFocusCapture = (e: React.FocusEvent<HTMLFormElement>) => {
    if (!isEditableElement(e.target)) return;
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setIsInputFocused(true);
  };

  const handleFormBlurCapture = (e: React.FocusEvent<HTMLFormElement>) => {
    if (!isEditableElement(e.target)) return;
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
    }
    blurTimerRef.current = window.setTimeout(() => {
      const active = document.activeElement;
      if (!isEditableElement(active) || !e.currentTarget.contains(active)) {
        setIsInputFocused(false);
      }
    }, 120);
  };

  const enabledPaymentMethods = useMemo<EnabledPaymentOption[]>(() => {
    const list: EnabledPaymentOption[] = [];
    if (paymentSettings.gcashEnabled) {
      list.push({
        key: 'gcash',
        label: 'GCash',
        subtitle: 'Mobile wallet transfer',
        icon: Smartphone,
      });
    }
    if (paymentSettings.mayaEnabled) {
      list.push({
        key: 'maya',
        label: 'Maya',
        subtitle: 'QR / wallet transfer',
        icon: Smartphone,
      });
    }
    if (paymentSettings.bankTransferEnabled) {
      list.push({
        key: 'bank',
        label: 'Bank Transfer',
        subtitle: paymentSettings.bankDetails.bankName || 'InstaPay / PESONet',
        icon: Landmark,
      });
    }
    if (paymentSettings.codEnabled) {
      list.push({
        key: 'cod',
        label: 'Cash on Delivery (COD)',
        subtitle: 'Pay courier upon arrival',
        icon: Banknote,
      });
    }
    return list;
  }, [paymentSettings]);

  const [selectedPaymentKey, setSelectedPaymentKey] = useState<PaymentMethodKey | null>(
    enabledPaymentMethods[0]?.key ?? null
  );

  useEffect(() => {
    if (enabledPaymentMethods.length === 0) {
      if (selectedPaymentKey !== null) {
        setSelectedPaymentKey(null);
      }
      return;
    }
    if (!selectedPaymentKey || !enabledPaymentMethods.some((m) => m.key === selectedPaymentKey)) {
      setSelectedPaymentKey(enabledPaymentMethods[0].key);
    }
  }, [enabledPaymentMethods, selectedPaymentKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (paymentQrModalOpen) {
          setPaymentQrModalOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, paymentQrModalOpen]);

  useEffect(() => {
    setOrderPaymentSession(null);
    setOrderSessionError(null);
    setCopiedAccountNumber(false);
    setCopiedExactAmount(false);
    autoConfirmedGuardRef.current = false;
  }, [selectedPaymentKey]);

  useEffect(() => {
    if (isOpen && step === 'receipt' && items.length > 0) {
      setStep('cart');
      setReceiptOrder(null);
    }
  }, [isOpen, items.length, step]);

  const applySavedCheckoutInfo = (
    infoOverride?: BuyerCheckoutInfo | null,
    fallbackName?: string
  ) => {
    const info = infoOverride !== undefined ? infoOverride : getBuyerCheckoutInfo();
    setCustomerName(info?.fullName || fallbackName || state.currentBuyer?.name || '');
    setPhoneNumber(info?.phoneNumber ?? '');
    setDeliveryAddress(info?.deliveryAddress ?? '');
    setNotes(info?.notes ?? '');
    if (
      info?.preferredPaymentMethod &&
      enabledPaymentMethods.some((m) => m.key === info.preferredPaymentMethod)
    ) {
      setSelectedPaymentKey(info.preferredPaymentMethod);
    }
  };

  // Auto-sync saved Information Settings whenever drawer opens or saved profile updates
  useEffect(() => {
    if (!isOpen) return;
    if (!savedBuyerInfo) return;
    setCustomerName(savedBuyerInfo.fullName || state.currentBuyer?.name || '');
    setPhoneNumber(savedBuyerInfo.phoneNumber || '');
    setDeliveryAddress(savedBuyerInfo.deliveryAddress || '');
    setNotes(savedBuyerInfo.notes ?? '');
    if (
      savedBuyerInfo.preferredPaymentMethod &&
      enabledPaymentMethods.some((m) => m.key === savedBuyerInfo.preferredPaymentMethod)
    ) {
      setSelectedPaymentKey(savedBuyerInfo.preferredPaymentMethod);
    }
  }, [
    isOpen,
    savedBuyerInfo?.updatedAt,
    savedBuyerInfo?.fullName,
    savedBuyerInfo?.phoneNumber,
    savedBuyerInfo?.deliveryAddress,
    savedBuyerInfo?.notes,
    savedBuyerInfo?.preferredPaymentMethod,
    state.currentBuyer?.name,
    enabledPaymentMethods,
  ]);

  if (!isOpen) return null;

  const subtotal =
    Math.round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100;
  const freeShippingUnlocked =
    paymentSettings.freeShippingThreshold > 0 &&
    subtotal >= paymentSettings.freeShippingThreshold;
  const amountToFreeShipping =
    paymentSettings.freeShippingThreshold > 0 && !freeShippingUnlocked
      ? Math.max(0, paymentSettings.freeShippingThreshold - subtotal)
      : 0;
  const deliveryFee = items.length === 0 || freeShippingUnlocked ? 0 : paymentSettings.shippingFee;
  const taxAmount =
    Math.round(subtotal * ((paymentSettings.taxPercent || 0) / 100) * 100) / 100;
  const serviceChargeAmount =
    Math.round(subtotal * ((paymentSettings.serviceChargePercent || 0) / 100) * 100) / 100;
  const grandTotal =
    Math.round((subtotal + deliveryFee + taxAmount + serviceChargeAmount) * 100) / 100;

  const selectedMethod =
    enabledPaymentMethods.find((m) => m.key === selectedPaymentKey) ??
    enabledPaymentMethods[0] ??
    null;

  const triggerShake = () => {
    setShakeForm(false);
    window.requestAnimationFrame(() => {
      setShakeForm(true);
      window.setTimeout(() => setShakeForm(false), 400);
    });
  };

  const isOnlineQrPayment =
    selectedPaymentKey === 'gcash' ||
    selectedPaymentKey === 'bank' ||
    selectedPaymentKey === 'maya';

  const qrPaymentDetails =
    selectedPaymentKey === 'gcash'
      ? {
          title: 'GCash Payment',
          qrUrl: paymentSettings.gcashDetails.qrImageUrl,
          numberLabel: 'GCash Number',
          accountNumber:
            paymentSettings.gcashDetails.mobileNumber || 'Contact store for GCash number',
          accountName: paymentSettings.gcashDetails.accountName || store.name,
          extraInfo: paymentSettings.gcashDetails.qrNote,
        }
      : selectedPaymentKey === 'bank'
        ? {
            title: paymentSettings.bankDetails.bankName
              ? `${paymentSettings.bankDetails.bankName} Payment`
              : 'Bank Transfer Payment',
            qrUrl: paymentSettings.bankDetails.qrImageUrl,
            numberLabel: 'Bank Account Number',
            accountNumber:
              paymentSettings.bankDetails.accountNumber || 'Contact store for account number',
            accountName: paymentSettings.bankDetails.accountName || store.name,
            extraInfo: paymentSettings.bankDetails.bankName
              ? `Bank: ${paymentSettings.bankDetails.bankName}`
              : undefined,
          }
        : {
            title: 'Maya Payment',
            qrUrl: paymentSettings.mayaDetails.qrImageUrl,
            numberLabel: 'Maya Number',
            accountNumber:
              paymentSettings.mayaDetails.mobileNumber || 'Contact store for Maya number',
            accountName: paymentSettings.mayaDetails.accountName || store.name,
            extraInfo: paymentSettings.mayaDetails.qrNote,
          };

  const completeOrderPlacement = (options?: {
    paymentStatus?: OrderPaymentStatus;
    referenceNumber?: string;
  }) => {
    if (!selectedMethod) return;
    if (saveInfoForLater) {
      saveBuyerCheckoutInfo({
        fullName: customerName.trim(),
        phoneNumber: phoneNumber.trim(),
        deliveryAddress: deliveryAddress.trim(),
        notes: notes.trim() || undefined,
        preferredPaymentMethod: selectedPaymentKey ?? undefined,
      });
      setSaveInfoForLater(false);
    }
    const resolvedPaymentStatus: OrderPaymentStatus =
      options?.paymentStatus ??
      (selectedMethod.key === 'cod' ? 'unpaid' : 'pending_verification');

    const createdOrder = onPlaceOrder({
      storeId: store.id,
      customerName: customerName.trim(),
      phoneNumber: phoneNumber.trim(),
      deliveryAddress: deliveryAddress.trim(),
      notes: notes.trim() || undefined,
      currency,
      paymentMethodKey: selectedMethod.key,
      paymentMethod: selectedMethod.label,
      paymentStatus: resolvedPaymentStatus,
      amountPaid: resolvedPaymentStatus === 'paid' ? grandTotal : 0,
      paymentReferenceNumber: options?.referenceNumber || orderPaymentSession?.referenceCode,
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        variant: item.variant,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: Math.round(item.unitPrice * item.quantity * 100) / 100,
      })),
      subtotal,
      deliveryFee,
      taxAmount,
      serviceChargeAmount,
      grandTotal,
    });

    setPaymentQrModalOpen(false);
    setOrderPaymentSession(null);
    setOrderSessionError(null);
    setCopiedAccountNumber(false);
    setCopiedExactAmount(false);
    setReceiptOrder(createdOrder);
    setStep('receipt');
    setFieldErrors({});
    setShakeForm(false);
    onClearCart();
  };

  const startOnlinePaymentSession = async () => {
    if (!selectedMethod) return;
    setIsCreatingOrderSession(true);
    setOrderSessionError(null);
    autoConfirmedGuardRef.current = false;
    try {
      const session = await createPaymentSessionIntent({
        targetType: 'store_order',
        storeId: store.id,
        channel: selectedMethod.key,
        channelLabel: selectedMethod.label,
        baseAmount: grandTotal,
        currency,
      });
      setOrderPaymentSession(session);
      setOrderCountdownNowMs(Date.now());
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to initialize online payment session.';
      setOrderSessionError(msg);
    } finally {
      setIsCreatingOrderSession(false);
    }
  };

  // Countdown tick for online order session
  useEffect(() => {
    if (
      !paymentQrModalOpen ||
      !orderPaymentSession ||
      orderPaymentSession.status !== 'awaiting_payment'
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setOrderCountdownNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paymentQrModalOpen, orderPaymentSession]);

  // Poll live status while customer completes transfer
  useEffect(() => {
    if (
      !paymentQrModalOpen ||
      !orderPaymentSession ||
      orderPaymentSession.status !== 'awaiting_payment'
    ) {
      return;
    }
    let active = true;

    const checkStatus = async () => {
      try {
        const latest = await pollPaymentSessionIntent(
          orderPaymentSession.id,
          orderPaymentSession.readToken
        );
        if (!active) return;
        setOrderPaymentSession((prev) =>
          prev ? { ...latest, readToken: prev.readToken } : latest
        );

        if (latest.status === 'paid' && !autoConfirmedGuardRef.current) {
          autoConfirmedGuardRef.current = true;
          completeOrderPlacement({
            paymentStatus: 'paid',
            referenceNumber: latest.matchedAlertReference || latest.referenceCode,
          });
          pushToast({
            type: 'success',
            title: 'Payment confirmed automatically',
            description: `Reference ${latest.referenceCode} paid—order confirmed with zero receipt upload.`,
          });
        }
      } catch {
        // Keep polling on transient error
      }
    };

    const interval = window.setInterval(checkStatus, 2500);
    window.addEventListener('focus', checkStatus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', checkStatus);
    };
  }, [paymentQrModalOpen, orderPaymentSession]);

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod) {
      pushToast({
        type: 'error',
        title: 'No payment method available',
        description: 'This store has not enabled any payment methods yet.',
      });
      return;
    }
    const nextErrors: CheckoutFieldErrors = {};

    if (customerName.trim().length < 2) {
      nextErrors.customerName = 'Please enter your full name.';
    }
    if (phoneNumber.trim().length < 7) {
      nextErrors.phoneNumber = 'Please enter a valid contact phone number.';
    }
    if (deliveryAddress.trim().length < 5) {
      nextErrors.deliveryAddress = 'Please enter your full delivery address.';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      triggerShake();
      const firstInvalidEl = nextErrors.customerName
        ? fullNameRef.current
        : nextErrors.phoneNumber
          ? phoneRef.current
          : addressRef.current;
      firstInvalidEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (isOnlineQrPayment) {
      setIsInputFocused(false);
      setIsKeyboardOpen(false);
      setPaymentQrModalOpen(true);
      void startOnlinePaymentSession();
      return;
    }

    completeOrderPlacement({ paymentStatus: 'unpaid' });
  };

  const handleConfirmZeroReceiptOrderSubmitted = () => {
    if (autoConfirmedGuardRef.current) return;
    autoConfirmedGuardRef.current = true;
    completeOrderPlacement({
      paymentStatus: 'pending_verification',
      referenceNumber: orderPaymentSession?.referenceCode,
    });
  };

  const handleCopyText = async (value: string, kind: 'account' | 'amount') => {
    try {
      await navigator.clipboard.writeText(value);
      if (kind === 'account') {
        setCopiedAccountNumber(true);
        window.setTimeout(() => setCopiedAccountNumber(false), 1800);
      } else {
        setCopiedExactAmount(true);
        window.setTimeout(() => setCopiedExactAmount(false), 1800);
      }
    } catch {
      // Ignore if clipboard API is restricted
    }
  };

  const handleCloseDrawer = () => {
    if (step === 'receipt') {
      setStep('cart');
      setReceiptOrder(null);
      setCopiedOrderId(false);
    }
    setIsInputFocused(false);
    setIsKeyboardOpen(false);
    setPaymentQrModalOpen(false);
    setOrderPaymentSession(null);
    setOrderSessionError(null);
    setCopiedAccountNumber(false);
    setCopiedExactAmount(false);
    setFieldErrors({});
    setShakeForm(false);
    onClose();
  };

  const handleCopyReceiptOrderId = async (orderId: string) => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopiedOrderId(true);
      window.setTimeout(() => setCopiedOrderId(false), 1800);
    } catch {
      // Ignore if clipboard API is restricted
    }
  };

  const handleTrackThisOrder = (orderId: string) => {
    setStep('cart');
    setReceiptOrder(null);
    setCopiedOrderId(false);
    setPaymentQrModalOpen(false);
    setOrderPaymentSession(null);
    setOrderSessionError(null);
    setFieldErrors({});
    setShakeForm(false);
    onClose();
    onTrackOrder?.(orderId);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Cart and Checkout"
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/60"
    >
      <div className="fixed inset-0" onClick={handleCloseDrawer} aria-hidden="true" />

      <aside
        className="relative z-10 w-full max-w-md h-full flex flex-col border-l shadow-2xl"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
          color: theme.textPrimary,
          fontFamily: theme.bodyFontFamily,
        }}
      >
        {/* Drawer Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: theme.borderColor }}
        >
          <div className="flex items-center gap-2.5">
            {step === 'checkout' && (
              <button
                type="button"
                aria-label="Back to cart"
                onClick={() => {
                  setStep('cart');
                  setIsInputFocused(false);
                  setIsKeyboardOpen(false);
                  setFieldErrors({});
                  setShakeForm(false);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center border cursor-pointer"
                style={{ borderColor: theme.borderColor }}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2
              className="text-lg font-bold"
              style={{ fontFamily: theme.headingFontFamily }}
            >
              {step === 'cart'
                ? `Your Bag (${items.reduce((sum, i) => sum + i.quantity, 0)})`
                : step === 'checkout'
                  ? 'Checkout Details'
                  : 'Order Confirmed'}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label="Close cart"
            className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer"
            style={{ borderColor: theme.borderColor, color: theme.textPrimary }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-5 space-y-5 flex-1">
          {step === 'receipt' && receiptOrder ? (
            <div className="space-y-5">
              <div
                className="p-5 rounded-2xl border text-center space-y-2"
                style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
              >
                <CheckCircle2
                  className="w-10 h-10 mx-auto"
                  style={{ color: theme.primaryColor }}
                />
                <p className="text-xs font-mono font-semibold" style={{ color: theme.primaryColor }}>
                  Order #{receiptOrder.id}
                </p>
                <h3
                  className="text-xl font-bold"
                  style={{ fontFamily: theme.headingFontFamily }}
                >
                  Thank you, {receiptOrder.customerName}!
                </h3>
                <p className="text-xs" style={{ color: theme.textMuted }}>
                  Your order with {store.name} has been recorded.
                </p>
              </div>

              <div
                className="p-4 rounded-xl border space-y-3 text-xs"
                style={{ borderColor: theme.borderColor }}
              >
                <div className="space-y-1">
                  <p className="font-semibold">Delivery Details</p>
                  <p style={{ color: theme.textMuted }}>
                    {receiptOrder.customerName} · {receiptOrder.phoneNumber}
                  </p>
                  <p style={{ color: theme.textMuted }}>{receiptOrder.deliveryAddress}</p>
                  {receiptOrder.notes && (
                    <p style={{ color: theme.textMuted }}>Note: {receiptOrder.notes}</p>
                  )}
                </div>

                <div className="pt-2 border-t space-y-2" style={{ borderColor: theme.borderColor }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">Payment Method</p>
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                      style={{
                        backgroundColor: theme.subtleBg,
                        borderColor: theme.borderColor,
                        color: theme.textPrimary,
                      }}
                    >
                      {receiptOrder.paymentStatus === 'paid'
                        ? 'Paid'
                        : receiptOrder.paymentStatus === 'pending_verification'
                          ? 'Pending Verification'
                          : receiptOrder.paymentStatus === 'refunded'
                            ? 'Refunded'
                            : 'Unpaid (COD)'}
                    </span>
                  </div>
                  <p style={{ color: theme.textMuted }}>
                    {receiptOrder.paymentMethod}
                    {receiptOrder.paymentReferenceNumber
                      ? ` · Ref #${receiptOrder.paymentReferenceNumber}`
                      : ''}
                  </p>
                  {receiptOrder.paymentProofUrl && (
                    <div className="flex items-center gap-2.5 pt-1">
                      <img
                        src={receiptOrder.paymentProofUrl}
                        alt="Uploaded payment receipt"
                        className="w-12 h-12 rounded-lg object-cover border"
                        style={{ borderColor: theme.borderColor }}
                      />
                      <span className="text-[11px] font-medium" style={{ color: theme.textMuted }}>
                        Payment receipt attached
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t space-y-2" style={{ borderColor: theme.borderColor }}>
                  <p className="font-semibold">Items Summary</p>
                  {receiptOrder.items.map((item, idx) => (
                    <div
                      key={`${item.productId}_${idx}`}
                      className="flex items-start justify-between gap-2"
                    >
                      <span style={{ color: theme.textMuted }}>
                        {item.quantity}× {item.name}
                        {item.variant ? ` (${item.variant})` : ''}
                      </span>
                      <span className="font-mono tabular-nums font-semibold shrink-0">
                        {formatCurrency(item.unitPrice * item.quantity, currency)}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  className="pt-2 border-t space-y-1.5"
                  style={{ borderColor: theme.borderColor }}
                >
                  <div className="flex justify-between" style={{ color: theme.textMuted }}>
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(receiptOrder.subtotal, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between" style={{ color: theme.textMuted }}>
                    <span>Delivery Fee</span>
                    <span className="font-mono tabular-nums">
                      {receiptOrder.deliveryFee === 0
                        ? 'Free'
                        : formatCurrency(receiptOrder.deliveryFee, currency)}
                    </span>
                  </div>
                  {receiptOrder.taxAmount > 0 && (
                    <div className="flex justify-between" style={{ color: theme.textMuted }}>
                      <span>Tax / VAT</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(receiptOrder.taxAmount, currency)}
                      </span>
                    </div>
                  )}
                  {receiptOrder.serviceChargeAmount > 0 && (
                    <div className="flex justify-between" style={{ color: theme.textMuted }}>
                      <span>Service Charge</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(receiptOrder.serviceChargeAmount, currency)}
                      </span>
                    </div>
                  )}
                  <div className="pt-1.5 border-t flex justify-between text-sm font-bold" style={{ borderColor: theme.borderColor }}>
                    <span>Total Paid / Due</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(receiptOrder.grandTotal, currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleCopyReceiptOrderId(receiptOrder.id)}
                    className={`min-h-[42px] px-3 py-2 text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer transition-opacity hover:opacity-85 ${theme.buttonRadiusClass}`}
                    style={{
                      backgroundColor: theme.subtleBg,
                      borderColor: theme.borderColor,
                      color: theme.textPrimary,
                    }}
                  >
                    {copiedOrderId ? (
                      <>
                        <Check className="w-3.5 h-3.5" style={{ color: theme.primaryColor }} />
                        <span>Copied ID</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Order ID</span>
                      </>
                    )}
                  </button>

                  {onTrackOrder && (
                    <button
                      type="button"
                      onClick={() => handleTrackThisOrder(receiptOrder.id)}
                      className={`min-h-[42px] px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-opacity hover:opacity-90 ${theme.buttonRadiusClass}`}
                      style={{
                        backgroundColor: theme.primaryColor,
                        color: theme.onPrimaryText,
                      }}
                    >
                      <PackageSearch className="w-3.5 h-3.5" />
                      <span>Track This Order</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className={`w-full min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold border cursor-pointer transition-opacity hover:opacity-85 ${theme.buttonRadiusClass}`}
                  style={
                    onTrackOrder
                      ? {
                          backgroundColor: theme.cardBg,
                          borderColor: theme.borderColor,
                          color: theme.textPrimary,
                        }
                      : {
                          backgroundColor: theme.primaryColor,
                          borderColor: theme.primaryColor,
                          color: theme.onPrimaryText,
                        }
                  }
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div
                className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border"
                style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
              >
                <ShoppingBag className="w-6 h-6" style={{ color: theme.textMuted }} />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold">Your shopping bag is empty</p>
                <p className="text-xs" style={{ color: theme.textMuted }}>
                  Add items from {store.name} to view totals and check out.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className={`min-h-[40px] px-5 py-2 text-xs font-semibold cursor-pointer ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                Browse Products
              </button>
            </div>
          ) : step === 'cart' ? (
            <>
              {amountToFreeShipping > 0 && (
                <div
                  className="p-3 rounded-xl border text-xs font-medium"
                  style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
                >
                  Add{' '}
                  <span className="font-mono tabular-nums font-bold">
                    {formatCurrency(amountToFreeShipping, currency)}
                  </span>{' '}
                  more to unlock free delivery.
                </div>
              )}

              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="p-3 rounded-xl border flex gap-3"
                    style={{ borderColor: theme.borderColor }}
                  >
                    <img
                      src={item.imageUrl || fallbackImg}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-lg object-cover border shrink-0"
                      style={{ borderColor: theme.borderColor }}
                    />

                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{item.name}</p>
                          {item.variant && (
                            <p className="text-[11px]" style={{ color: theme.textMuted }}>
                              {item.variant}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => onRemoveItem(item.key)}
                          className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div
                          className="inline-flex items-center border rounded-lg"
                          style={{ borderColor: theme.borderColor }}
                        >
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => onUpdateQuantity(item.key, -1)}
                            className="w-7 h-7 flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => onUpdateQuantity(item.key, 1)}
                            className="w-7 h-7 flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-sm font-bold font-mono tabular-nums">
                          {formatCurrency(item.unitPrice * item.quantity, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <form
              id="checkout-form"
              onSubmit={handleCheckoutSubmit}
              onFocusCapture={handleFormFocusCapture}
              onBlurCapture={handleFormBlurCapture}
              noValidate
              className="space-y-4"
            >
              {/* Auto-Fill Information Settings Banner */}
              <div
                className="p-3 rounded-xl border flex items-center justify-between gap-2.5 text-xs"
                style={{
                  backgroundColor: theme.subtleBg,
                  borderColor: theme.borderColor,
                }}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {hasSavedBuyerInfo ? (
                    <Sparkles
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: theme.accentTextColor }}
                    />
                  ) : (
                    <SlidersHorizontal
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: theme.textMuted }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {hasSavedBuyerInfo
                        ? 'Auto-filled from Information Settings'
                        : 'Save details for faster checkout'}
                    </p>
                    <p className="text-[11px]" style={{ color: theme.textMuted }}>
                      {hasSavedBuyerInfo
                        ? 'Review or edit your delivery details below anytime.'
                        : 'Set your checkout details once in Information Settings.'}
                    </p>
                  </div>
                </div>
                {onOpenInfoSettings && (
                  <button
                    type="button"
                    onClick={onOpenInfoSettings}
                    className={`px-2.5 py-1.5 text-[11px] font-semibold border shrink-0 cursor-pointer hover:opacity-85 ${theme.chipRadiusClass}`}
                    style={{
                      backgroundColor: theme.cardBg,
                      borderColor: theme.borderColor,
                      color: theme.accentTextColor,
                    }}
                  >
                    {hasSavedBuyerInfo ? 'Edit Info' : 'Set Info'}
                  </button>
                )}
              </div>

              <div
                className={`space-y-1.5 ${
                  shakeForm && fieldErrors.customerName ? 'auth-shake' : ''
                }`}
              >
                <label htmlFor="checkout-full-name" className="block text-xs font-semibold">
                  Full Name
                </label>
                <input
                  ref={fullNameRef}
                  id="checkout-full-name"
                  type="text"
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.customerName)}
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (fieldErrors.customerName) {
                      setFieldErrors((prev) => ({ ...prev, customerName: undefined }));
                    }
                  }}
                  placeholder="Juan Dela Cruz"
                  className={`w-full min-h-[42px] px-3 py-2 text-sm border rounded-xl outline-none transition-all ${
                    fieldErrors.customerName
                      ? 'ring-4 ring-rose-500/20 focus:ring-rose-500/25'
                      : 'focus:ring-2'
                  }`}
                  style={{
                    backgroundColor: theme.canvasBg,
                    borderColor: fieldErrors.customerName ? '#f43f5e' : theme.borderColor,
                    color: theme.textPrimary,
                  }}
                />
                {fieldErrors.customerName && (
                  <p
                    className={`text-xs font-medium mt-1 ${
                      theme.isDark ? 'text-rose-400' : 'text-rose-600'
                    }`}
                  >
                    {fieldErrors.customerName}
                  </p>
                )}
              </div>

              <div
                className={`space-y-1.5 ${
                  shakeForm && fieldErrors.phoneNumber ? 'auth-shake' : ''
                }`}
              >
                <label htmlFor="checkout-phone" className="block text-xs font-semibold">
                  Phone Number
                </label>
                <input
                  ref={phoneRef}
                  id="checkout-phone"
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(fieldErrors.phoneNumber)}
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (fieldErrors.phoneNumber) {
                      setFieldErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                    }
                  }}
                  placeholder="0917 555 0123"
                  className={`w-full min-h-[42px] px-3 py-2 text-sm font-mono border rounded-xl outline-none transition-all ${
                    fieldErrors.phoneNumber
                      ? 'ring-4 ring-rose-500/20 focus:ring-rose-500/25'
                      : 'focus:ring-2'
                  }`}
                  style={{
                    backgroundColor: theme.canvasBg,
                    borderColor: fieldErrors.phoneNumber ? '#f43f5e' : theme.borderColor,
                    color: theme.textPrimary,
                  }}
                />
                {fieldErrors.phoneNumber && (
                  <p
                    className={`text-xs font-medium mt-1 ${
                      theme.isDark ? 'text-rose-400' : 'text-rose-600'
                    }`}
                  >
                    {fieldErrors.phoneNumber}
                  </p>
                )}
              </div>

              <div
                className={`space-y-1.5 ${
                  shakeForm && fieldErrors.deliveryAddress ? 'auth-shake' : ''
                }`}
              >
                <label htmlFor="checkout-address" className="block text-xs font-semibold">
                  Delivery Address
                </label>
                <textarea
                  ref={addressRef}
                  id="checkout-address"
                  rows={2}
                  aria-invalid={Boolean(fieldErrors.deliveryAddress)}
                  value={deliveryAddress}
                  onChange={(e) => {
                    setDeliveryAddress(e.target.value);
                    if (fieldErrors.deliveryAddress) {
                      setFieldErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
                    }
                  }}
                  placeholder="Street, Barangay, City, Landmark"
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none transition-all resize-none ${
                    fieldErrors.deliveryAddress
                      ? 'ring-4 ring-rose-500/20 focus:ring-rose-500/25'
                      : 'focus:ring-2'
                  }`}
                  style={{
                    backgroundColor: theme.canvasBg,
                    borderColor: fieldErrors.deliveryAddress ? '#f43f5e' : theme.borderColor,
                    color: theme.textPrimary,
                  }}
                />
                {fieldErrors.deliveryAddress && (
                  <p
                    className={`text-xs font-medium mt-1 ${
                      theme.isDark ? 'text-rose-400' : 'text-rose-600'
                    }`}
                  >
                    {fieldErrors.deliveryAddress}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="checkout-order-notes" className="block text-xs font-semibold">
                  Order Notes <span style={{ color: theme.textMuted }}>(Optional)</span>
                </label>
                <textarea
                  id="checkout-order-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery gate code, utensils, special request..."
                  className="w-full min-h-[84px] px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 resize-y"
                  style={{
                    backgroundColor: theme.canvasBg,
                    borderColor: theme.borderColor,
                    color: theme.textPrimary,
                  }}
                />
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold">Select Payment Method</label>
                {enabledPaymentMethods.length === 0 ? (
                  <div
                    className="p-3.5 rounded-xl border text-xs flex items-start gap-2.5"
                    style={{
                      backgroundColor: theme.subtleBg,
                      borderColor: theme.borderColor,
                      color: theme.textMuted,
                    }}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.primaryColor }} />
                    <span>
                      No payment methods have been enabled by this store yet. Please check back once the merchant sets up payment options.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {enabledPaymentMethods.map((method) => {
                      const Icon = method.icon;
                      const active = selectedPaymentKey === method.key;
                      return (
                        <button
                          key={method.key}
                          type="button"
                          onClick={() => setSelectedPaymentKey(method.key)}
                          className="w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
                          style={
                            active
                              ? {
                                  borderColor: theme.primaryColor,
                                  backgroundColor: theme.subtleBg,
                                }
                              : {
                                  borderColor: theme.borderColor,
                                  backgroundColor: theme.cardBg,
                                }
                          }
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 shrink-0" style={{ color: theme.primaryColor }} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{method.label}</p>
                              <p className="text-[11px] truncate" style={{ color: theme.textMuted }}>
                                {method.subtitle}
                              </p>
                            </div>
                          </div>
                          <span
                            className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                            style={{
                              borderColor: active ? theme.primaryColor : theme.borderColor,
                            }}
                          >
                            {active && (
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: theme.primaryColor }}
                              />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedPaymentKey === 'cod' && paymentSettings.codInstructions && (
                  <div
                    className="p-3 rounded-xl border text-xs"
                    style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor, color: theme.textMuted }}
                  >
                    {paymentSettings.codInstructions}
                  </div>
                )}
              </div>

              <label
                className="flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer select-none"
                style={{
                  backgroundColor: theme.subtleBg,
                  borderColor: theme.borderColor,
                }}
              >
                <input
                  type="checkbox"
                  checked={saveInfoForLater}
                  onChange={(e) => setSaveInfoForLater(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded cursor-pointer accent-current shrink-0"
                  style={{ color: theme.primaryColor }}
                />
                <span>
                  <strong className="block font-semibold">
                    {hasSavedBuyerInfo
                      ? 'Update my saved Information Settings with these details'
                      : 'Save these details to Information Settings for next checkout'}
                  </strong>
                  <span className="text-[11px]" style={{ color: theme.textMuted }}>
                    Automatically fills your name, phone, address, notes, and preferred payment.
                  </span>
                </span>
              </label>
            </form>
          )}
          </div>

          {/* Mobile keyboard-active inline totals & Place Order footer (scrolls with form instead of riding up over inputs) */}
          {items.length > 0 && step === 'checkout' && (isInputFocused || isKeyboardOpen) && (
            <div
              className="p-5 border-t space-y-4 shrink-0 md:hidden"
              style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
            >
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt style={{ color: theme.textMuted }}>Subtotal</dt>
                  <dd className="font-mono tabular-nums font-medium">
                    {formatCurrency(subtotal, currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt style={{ color: theme.textMuted }}>Delivery Fee</dt>
                  <dd className="font-mono tabular-nums font-medium">
                    {freeShippingUnlocked
                      ? 'Free Shipping'
                      : formatCurrency(deliveryFee, currency)}
                  </dd>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between">
                    <dt style={{ color: theme.textMuted }}>
                      Tax / VAT ({paymentSettings.taxPercent}%)
                    </dt>
                    <dd className="font-mono tabular-nums font-medium">
                      {formatCurrency(taxAmount, currency)}
                    </dd>
                  </div>
                )}
                {serviceChargeAmount > 0 && (
                  <div className="flex justify-between">
                    <dt style={{ color: theme.textMuted }}>
                      Service Charge ({paymentSettings.serviceChargePercent}%)
                    </dt>
                    <dd className="font-mono tabular-nums font-medium">
                      {formatCurrency(serviceChargeAmount, currency)}
                    </dd>
                  </div>
                )}
                <div
                  className="pt-2 border-t flex justify-between text-base font-bold"
                  style={{ borderColor: theme.borderColor }}
                >
                  <dt>Grand Total</dt>
                  <dd className="font-mono tabular-nums">{formatCurrency(grandTotal, currency)}</dd>
                </div>
              </dl>

              <button
                key="place-order-submit-inline-btn"
                type="submit"
                form="checkout-form"
                disabled={!selectedMethod}
                className={`w-full min-h-[46px] px-5 py-3 text-sm font-semibold transition-opacity ${
                  selectedMethod ? 'cursor-pointer hover:opacity-90' : 'opacity-50 cursor-not-allowed'
                } ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                Place Order — {formatCurrency(grandTotal, currency)}
              </button>
            </div>
          )}
        </div>

        {/* Auto-Calculated Totals Footer (Cart & Checkout steps; unpinned on mobile while keyboard/input active) */}
        {items.length > 0 && step !== 'receipt' && (
          <div
            className={`${
              step === 'checkout' && (isInputFocused || isKeyboardOpen)
                ? 'hidden md:block'
                : ''
            } p-5 border-t space-y-4 shrink-0`}
            style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
          >
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt style={{ color: theme.textMuted }}>Subtotal</dt>
                <dd className="font-mono tabular-nums font-medium">
                  {formatCurrency(subtotal, currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: theme.textMuted }}>Delivery Fee</dt>
                <dd className="font-mono tabular-nums font-medium">
                  {freeShippingUnlocked
                    ? 'Free Shipping'
                    : formatCurrency(deliveryFee, currency)}
                </dd>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between">
                  <dt style={{ color: theme.textMuted }}>
                    Tax / VAT ({paymentSettings.taxPercent}%)
                  </dt>
                  <dd className="font-mono tabular-nums font-medium">
                    {formatCurrency(taxAmount, currency)}
                  </dd>
                </div>
              )}
              {serviceChargeAmount > 0 && (
                <div className="flex justify-between">
                  <dt style={{ color: theme.textMuted }}>
                    Service Charge ({paymentSettings.serviceChargePercent}%)
                  </dt>
                  <dd className="font-mono tabular-nums font-medium">
                    {formatCurrency(serviceChargeAmount, currency)}
                  </dd>
                </div>
              )}
              <div
                className="pt-2 border-t flex justify-between text-base font-bold"
                style={{ borderColor: theme.borderColor }}
              >
                <dt>Grand Total</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(grandTotal, currency)}</dd>
              </div>
            </dl>

            {step === 'cart' ? (
              <button
                key="proceed-to-checkout-btn"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (!state.currentBuyer) {
                    setShowBuyerAuth(true);
                    return;
                  }
                  setFieldErrors({});
                  setShakeForm(false);
                  applySavedCheckoutInfo();
                  setStep('checkout');
                }}
                className={`w-full min-h-[46px] px-5 py-3 text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90 ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                Proceed to Checkout
              </button>
            ) : (
              <button
                key="place-order-submit-btn"
                type="submit"
                form="checkout-form"
                disabled={!selectedMethod}
                className={`w-full min-h-[46px] px-5 py-3 text-sm font-semibold transition-opacity ${
                  selectedMethod ? 'cursor-pointer hover:opacity-90' : 'opacity-50 cursor-not-allowed'
                } ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                Place Order — {formatCurrency(grandTotal, currency)}
              </button>
            )}
          </div>
        )}
      </aside>

      <BuyerAuthModal
        isOpen={showBuyerAuth}
        storeId={store.id}
        storeName={store.name}
        onClose={() => setShowBuyerAuth(false)}
        onSuccess={(buyer?: BuyerAccount) => {
          setShowBuyerAuth(false);
          applySavedCheckoutInfo(buyer?.savedCheckoutInfo ?? null, buyer?.name);
          setStep('checkout');
        }}
      />

      {paymentQrModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={qrPaymentDetails.title}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-[2px]"
        >
          <div
            className="fixed inset-0"
            onClick={() => setPaymentQrModalOpen(false)}
            aria-hidden="true"
          />

          <div
            className="relative z-10 w-full max-w-md max-h-[92dvh] flex flex-col border rounded-2xl shadow-2xl overflow-hidden"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
              color: theme.textPrimary,
              fontFamily: theme.bodyFontFamily,
            }}
          >
            {/* Modal Header */}
            <div
              className="px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0"
              style={{ borderColor: theme.borderColor }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 flex items-center justify-center border shrink-0 ${theme.chipRadiusClass}`}
                  style={{
                    backgroundColor: theme.subtleBg,
                    borderColor: theme.borderColor,
                    color: theme.primaryColor,
                  }}
                >
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3
                    className="text-base font-bold truncate"
                    style={{ fontFamily: theme.headingFontFamily }}
                  >
                    {qrPaymentDetails.title}
                  </h3>
                  <p className="text-xs font-mono tabular-nums font-semibold" style={{ color: theme.primaryColor }}>
                    Total: {formatCurrency(grandTotal, currency)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPaymentQrModalOpen(false)}
                aria-label="Close payment QR modal"
                className={`w-9 h-9 border flex items-center justify-center shrink-0 cursor-pointer ${theme.buttonRadiusClass}`}
                style={{ borderColor: theme.borderColor, color: theme.textPrimary }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Zero-Receipt Exact Amount -> QR -> Account Name & Number */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              {isCreatingOrderSession ? (
                <div className="py-10 text-center space-y-2.5">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto" style={{ color: theme.primaryColor }} />
                  <p className="text-xs font-semibold">Preparing zero-receipt payment session...</p>
                </div>
              ) : orderSessionError ? (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-center space-y-3">
                  <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
                  <p className="text-xs font-medium text-rose-800">{orderSessionError}</p>
                  <button
                    type="button"
                    onClick={() => void startOnlinePaymentSession()}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : orderPaymentSession?.status === 'expired' ? (
                <div
                  className="p-5 rounded-xl border text-center space-y-3"
                  style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
                >
                  <Clock className="w-7 h-7 mx-auto text-amber-600" />
                  <p className="text-xs font-semibold">
                    This 30-minute payment window expired. Generate a new exact amount to continue.
                  </p>
                  <button
                    type="button"
                    onClick={() => void startOnlinePaymentSession()}
                    className={`inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 text-xs font-semibold cursor-pointer ${theme.buttonRadiusClass}`}
                    style={{ backgroundColor: theme.primaryColor, color: theme.onPrimaryText }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generate New Amount</span>
                  </button>
                </div>
              ) : orderPaymentSession?.provider === 'paymongo' &&
                isAllowedPaymongoRedirect(orderPaymentSession.checkoutUrl) ? (
                <div
                  className="p-5 rounded-xl border text-center space-y-3.5"
                  style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
                >
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Listening for PayMongo payment confirmation...</span>
                  </div>
                  <p className="text-xs" style={{ color: theme.textMuted }}>
                    Complete payment securely via PayMongo (GCash, Maya, QR Ph, or Online Banking).
                    No screenshot or receipt upload needed.
                  </p>
                  <a
                    href={orderPaymentSession.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-semibold ${theme.buttonRadiusClass}`}
                    style={{ backgroundColor: theme.primaryColor, color: theme.onPrimaryText }}
                  >
                    <span>Open PayMongo Checkout</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <>
                  {/* Live Status + Countdown */}
                  {orderPaymentSession && (
                    <div
                      className="px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs"
                      style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
                    >
                      <span className="inline-flex items-center gap-2 font-semibold text-emerald-600">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Listening for transfer alert...</span>
                      </span>
                      <span className="font-mono font-bold tabular-nums">
                        {(() => {
                          const diffSec = Math.max(
                            0,
                            Math.floor(
                              (new Date(orderPaymentSession.expiresAt).getTime() -
                                orderCountdownNowMs) /
                                1000
                            )
                          );
                          const m = String(Math.floor(diffSec / 60)).padStart(2, '0');
                          const s = String(diffSec % 60).padStart(2, '0');
                          return `Expires in ${m}:${s}`;
                        })()}
                      </span>
                    </div>
                  )}

                  {/* Exact Unique Payable Amount */}
                  {orderPaymentSession && (
                    <div
                      className="p-3.5 rounded-xl border-2 flex items-center justify-between gap-3"
                      style={{
                        backgroundColor: theme.cardBg,
                        borderColor: theme.primaryColor,
                      }}
                    >
                      <div className="min-w-0">
                        <p
                          className="text-[10px] font-bold uppercase tracking-wide"
                          style={{ color: theme.textMuted }}
                        >
                          Send Exact Amount (No Receipt Upload)
                        </p>
                        <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums mt-0.5">
                          {formatCurrency(orderPaymentSession.uniquePayableAmount, currency)}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
                          Transfer exact centavos so payment auto-confirms instantly.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            orderPaymentSession.uniquePayableAmount.toFixed(2),
                            'amount'
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold shrink-0 cursor-pointer ${theme.buttonRadiusClass}`}
                        style={{
                          backgroundColor: theme.primaryColor,
                          color: theme.onPrimaryText,
                        }}
                      >
                        {copiedExactAmount ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Exact</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* 1. QR Code */}
                  {qrPaymentDetails.qrUrl && (
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className="p-2.5 bg-white rounded-2xl border border-slate-200 shadow-xs inline-flex items-center justify-center">
                        <img
                          src={qrPaymentDetails.qrUrl}
                          alt={`${qrPaymentDetails.title} QR Code`}
                          className="w-36 h-36 sm:w-44 sm:h-44 object-contain rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  {/* 2. Account Number & Account Name */}
                  <div
                    className="p-3.5 rounded-xl border text-center space-y-2"
                    style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
                  >
                    <div className="space-y-0.5">
                      <p
                        className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: theme.textMuted }}
                      >
                        Account Name
                      </p>
                      <p className="text-sm font-bold" style={{ color: theme.textPrimary }}>
                        {qrPaymentDetails.accountName}
                      </p>
                    </div>

                    <div
                      className="pt-2 border-t space-y-1"
                      style={{ borderColor: theme.borderColor }}
                    >
                      <p
                        className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: theme.textMuted }}
                      >
                        {qrPaymentDetails.numberLabel}
                      </p>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-mono font-bold tracking-wide select-all">
                          {qrPaymentDetails.accountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(qrPaymentDetails.accountNumber, 'account')}
                          aria-label={`Copy ${qrPaymentDetails.numberLabel}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold border rounded-md cursor-pointer transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: theme.cardBg,
                            borderColor: theme.borderColor,
                            color: theme.textPrimary,
                          }}
                        >
                          {copiedAccountNumber ? (
                            <>
                              <Check className="w-3 h-3" style={{ color: theme.primaryColor }} />
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

                    {orderPaymentSession && (
                      <p className="text-[11px] font-mono pt-1" style={{ color: theme.textMuted }}>
                        Ref: {orderPaymentSession.referenceCode}
                      </p>
                    )}

                    {qrPaymentDetails.extraInfo && (
                      <p className="text-[11px] pt-0.5" style={{ color: theme.textMuted }}>
                        {qrPaymentDetails.extraInfo}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer: Zero-Receipt Confirmation Action */}
            <div
              className="p-4 sm:p-5 border-t space-y-2 shrink-0"
              style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
            >
              <button
                type="button"
                disabled={isCreatingOrderSession || Boolean(orderSessionError)}
                onClick={handleConfirmZeroReceiptOrderSubmitted}
                className={`w-full min-h-[46px] px-5 py-3 text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                I&apos;ve Sent Exact Payment — Place Order
              </button>
              <p className="text-[11px] text-center" style={{ color: theme.textMuted }}>
                No receipt upload required. Your order confirms automatically once the transfer alert arrives.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
