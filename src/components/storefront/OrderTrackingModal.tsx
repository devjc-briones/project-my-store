import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  MapPin,
  Package,
  PackageSearch,
  Phone,
  Search,
  Truck,
  User,
  X,
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { resolveThemeTokens } from '../../templates/templateTypes';
import { CurrencyCode, OrderFulfillmentStatus, Store } from '../../types/schema';
import { formatCurrency } from '../../utils/pricing';
import { UnifiedOrderRow } from '../../utils/storeOrders';

interface OrderTrackingModalProps {
  isOpen: boolean;
  store: Store;
  orders: UnifiedOrderRow[];
  currency: CurrencyCode;
  initialOrderId?: string | null;
  onClose: () => void;
}

interface TrackingStepMeta {
  status: OrderFulfillmentStatus;
  title: string;
  description: string;
  icon: typeof ClipboardCheck;
}

const TRACKING_STEPS: TrackingStepMeta[] = [
  {
    status: 'Pending',
    title: 'Order Received',
    description: 'Order recorded and awaiting merchant confirmation.',
    icon: ClipboardCheck,
  },
  {
    status: 'Preparing',
    title: 'Being Prepared / Packed',
    description: 'The store is preparing and packing your items.',
    icon: Package,
  },
  {
    status: 'Out for Delivery',
    title: 'Out for Delivery',
    description: 'Courier is on the way to your delivery address.',
    icon: Truck,
  },
  {
    status: 'Completed',
    title: 'Delivered',
    description: 'Order completed and delivered. Thank you!',
    icon: CheckCircle2,
  },
];

const ORDER_STATUS_TABS: {
  status: OrderFulfillmentStatus;
  label: string;
}[] = [
  { status: 'Pending', label: 'Pending' },
  { status: 'Preparing', label: 'Preparing' },
  { status: 'Out for Delivery', label: 'Out for Delivery' },
  { status: 'Completed', label: 'Delivered' },
];

function normalizeOrderId(value: string): string {
  return value.trim().replace(/^#+/, '').toUpperCase();
}

export function OrderTrackingModal({
  isOpen,
  store,
  orders,
  currency,
  initialOrderId,
  onClose,
}: OrderTrackingModalProps) {
  useBodyScrollLock(isOpen);

  const theme = resolveThemeTokens(store.branding, store.templateId);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);

  const [query, setQuery] = useState('');
  const [searchedId, setSearchedId] = useState<string | null>(null);
  const [activeStatusTab, setActiveStatusTab] = useState<OrderFulfillmentStatus>('Pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shakeSearch, setShakeSearch] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const ordersByStatus = useMemo(() => {
    const grouped: Record<OrderFulfillmentStatus, UnifiedOrderRow[]> = {
      Pending: [],
      Preparing: [],
      'Out for Delivery': [],
      Completed: [],
    };
    orders.forEach((order) => {
      if (grouped[order.status]) {
        grouped[order.status].push(order);
      }
    });
    return grouped;
  }, [orders]);

  // Reset state if user navigates to a different store
  useEffect(() => {
    setQuery('');
    setSearchedId(null);
    setActiveStatusTab('Pending');
    setErrorMsg(null);
    setShakeSearch(false);
    setCopiedId(false);
    wasOpenRef.current = false;
  }, [store.id]);

  // Pre-fill and sync active tab when opened
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;

    setErrorMsg(null);
    setShakeSearch(false);
    setCopiedId(false);

    if (initialOrderId) {
      const normalized = normalizeOrderId(initialOrderId);
      setQuery(normalized);
      setSearchedId(normalized);
      const matched = orders.find((o) => o.id.toUpperCase() === normalized);
      if (matched) {
        setActiveStatusTab(matched.status);
      }
    } else if (justOpened) {
      const firstPopulatedTab = ORDER_STATUS_TABS.find(
        (tab) => (ordersByStatus[tab.status] ?? []).length > 0
      );
      setActiveStatusTab(firstPopulatedTab ? firstPopulatedTab.status : 'Pending');
    }
  }, [isOpen, initialOrderId, orders, ordersByStatus]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const tabLiveOrders = useMemo(
    () => ordersByStatus[activeStatusTab] ?? [],
    [ordersByStatus, activeStatusTab]
  );

  // Always derive the active order reactively from `orders` so seller fulfillment updates reflect live
  const trackedOrder = useMemo(() => {
    if (!searchedId) return null;
    const normalized = normalizeOrderId(searchedId);
    return orders.find((o) => o.id.toUpperCase() === normalized) ?? null;
  }, [orders, searchedId]);

  if (!isOpen) return null;

  const triggerShake = () => {
    setShakeSearch(false);
    window.requestAnimationFrame(() => {
      setShakeSearch(true);
      window.setTimeout(() => setShakeSearch(false), 400);
    });
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeOrderId(query);
    if (!normalized) {
      setSearchedId(null);
      setErrorMsg('Please enter your Order ID.');
      triggerShake();
      inputRef.current?.focus();
      return;
    }

    const match = orders.find((o) => o.id.toUpperCase() === normalized);
    if (!match) {
      setSearchedId(null);
      setErrorMsg(
        `No order matching "${normalized}" was found in ${store.name}. Double-check your Order ID.`
      );
      triggerShake();
      inputRef.current?.focus();
      return;
    }

    setErrorMsg(null);
    setQuery(match.id);
    setSearchedId(match.id);
    setActiveStatusTab(match.status);
  };

  const handleSelectQuickOrder = (order: UnifiedOrderRow) => {
    setErrorMsg(null);
    setShakeSearch(false);
    setQuery(order.id);
    setSearchedId(order.id);
    setActiveStatusTab(order.status);
    setCopiedId(false);
  };

  const handleSelectStatusTab = (nextStatus: OrderFulfillmentStatus) => {
    setActiveStatusTab(nextStatus);
    setErrorMsg(null);
    setShakeSearch(false);
    if (trackedOrder && trackedOrder.status !== nextStatus) {
      setSearchedId(null);
      setQuery('');
    }
  };

  const handleCopyOrderId = async (orderId: string) => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 1800);
    } catch {
      // Fallback ignored if clipboard unavailable
    }
  };

  const currentStepIndex = trackedOrder
    ? Math.max(
        0,
        TRACKING_STEPS.findIndex((step) => step.status === trackedOrder.status)
      )
    : -1;

  const currentStepMeta = currentStepIndex >= 0 ? TRACKING_STEPS[currentStepIndex] : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Track Order — ${store.name}`}
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/60"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <aside
        className="relative z-10 w-full max-w-lg h-full flex flex-col border-l shadow-2xl"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
          color: theme.textPrimary,
          fontFamily: theme.bodyFontFamily,
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: theme.borderColor }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 flex items-center justify-center shrink-0 ${theme.chipRadiusClass}`}
              style={{
                backgroundColor: theme.subtleBg,
                color: theme.primaryColor,
                border: `1px solid ${theme.borderColor}`,
              }}
            >
              <PackageSearch className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-base sm:text-lg font-bold truncate"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                Track Your Order
              </h2>
              <p className="text-[11px] truncate" style={{ color: theme.textMuted }}>
                {store.name} · Live fulfillment status
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close order tracker"
            className={`w-9 h-9 border flex items-center justify-center shrink-0 cursor-pointer ${theme.buttonRadiusClass}`}
            style={{ borderColor: theme.borderColor, color: theme.textPrimary }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Search Input Form */}
          <form onSubmit={handleTrackSubmit} noValidate className="space-y-2.5">
            <label htmlFor="track-order-id-input" className="block text-xs font-semibold">
              Enter Order ID
            </label>

            <div className={`flex items-stretch gap-2 ${shakeSearch ? 'auth-shake' : ''}`}>
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: theme.textMuted }}
                />
                <input
                  ref={inputRef}
                  id="track-order-id-input"
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  aria-invalid={Boolean(errorMsg)}
                  placeholder="Enter Order ID (e.g. ORD-1001)"
                  className={`w-full min-h-[44px] pl-9 pr-3 py-2 text-sm font-mono uppercase border outline-none transition-all ${
                    theme.chipRadiusClass
                  } ${errorMsg ? 'ring-4 ring-rose-500/20' : 'focus:ring-2'}`}
                  style={{
                    backgroundColor: theme.canvasBg,
                    borderColor: errorMsg ? '#f43f5e' : theme.borderColor,
                    color: theme.textPrimary,
                  }}
                />
              </div>

              <button
                type="submit"
                className={`min-h-[44px] px-4 sm:px-5 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer transition-opacity hover:opacity-90 ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                Track
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                  theme.isDark
                    ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </form>

          {/* Orders Organized by Status Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: theme.textMuted }}>
                Orders by Status
              </p>
              <span className="text-[11px] font-mono tabular-nums" style={{ color: theme.textMuted }}>
                {orders.length} total
              </span>
            </div>

            <div
              role="tablist"
              aria-label="Filter track orders by fulfillment status"
              className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl border"
              style={{
                backgroundColor: theme.canvasBg,
                borderColor: theme.borderColor,
              }}
            >
              {ORDER_STATUS_TABS.map((tab) => {
                const count = (ordersByStatus[tab.status] ?? []).length;
                const isActiveTab = activeStatusTab === tab.status;
                return (
                  <button
                    key={tab.status}
                    type="button"
                    role="tab"
                    aria-selected={isActiveTab}
                    onClick={() => handleSelectStatusTab(tab.status)}
                    className={`min-h-[38px] px-2.5 py-1.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all text-center ${theme.chipRadiusClass}`}
                    style={
                      isActiveTab
                        ? {
                            backgroundColor: theme.primaryColor,
                            color: theme.onPrimaryText,
                          }
                        : {
                            backgroundColor: 'transparent',
                            color: theme.textMuted,
                          }
                    }
                  >
                    <span className="truncate">{tab.label}</span>
                    <span
                      className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md shrink-0"
                      style={
                        isActiveTab
                          ? {
                              backgroundColor:
                                theme.onPrimaryText === '#0F172A'
                                  ? 'rgba(15, 23, 42, 0.14)'
                                  : 'rgba(255, 255, 255, 0.2)',
                              color: theme.onPrimaryText,
                            }
                          : {
                              backgroundColor: theme.subtleBg,
                              color: theme.textPrimary,
                            }
                      }
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Tab Orders List */}
            <div role="tabpanel" className="space-y-2.5">
              {tabLiveOrders.length === 0 ? (
                <div
                  className="px-4 py-3.5 rounded-xl border text-center text-xs"
                  style={{
                    backgroundColor: theme.canvasBg,
                    borderColor: theme.borderColor,
                    color: theme.textMuted,
                  }}
                >
                  No{' '}
                  <strong style={{ color: theme.textPrimary }}>
                    {ORDER_STATUS_TABS.find((t) => t.status === activeStatusTab)?.label}
                  </strong>{' '}
                  orders right now.
                </div>
              ) : (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold" style={{ color: theme.textMuted }}>
                      Your Orders (
                      {ORDER_STATUS_TABS.find((t) => t.status === activeStatusTab)?.label})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tabLiveOrders.map((order) => {
                        const isActive = trackedOrder?.id === order.id;
                        return (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => handleSelectQuickOrder(order)}
                            className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-medium border cursor-pointer transition-all ${theme.chipRadiusClass}`}
                            style={
                              isActive
                                ? {
                                    backgroundColor: theme.primaryColor,
                                    borderColor: theme.primaryColor,
                                    color: theme.onPrimaryText,
                                  }
                                : {
                                    backgroundColor: theme.subtleBg,
                                    borderColor: theme.borderColor,
                                    color: theme.textPrimary,
                                  }
                            }
                          >
                            <span className="font-mono font-bold">{order.id}</span>
                            <span className="opacity-80 font-mono tabular-nums">
                              · {formatCurrency(order.total, currency)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
              )}
            </div>
          </div>

          {/* Active Tracked Order Status + Visual Stepper + Receipt */}
          {trackedOrder && currentStepMeta ? (
            <div className="space-y-5 pt-1">
              {/* Current Status Summary Banner */}
              <div
                className="p-4 rounded-2xl border space-y-2"
                style={{
                  backgroundColor: theme.subtleBg,
                  borderColor: theme.borderColor,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono font-bold truncate">
                      Order #{trackedOrder.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyOrderId(trackedOrder.id)}
                      aria-label="Copy Order ID"
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border rounded-md cursor-pointer shrink-0"
                      style={{
                        backgroundColor: theme.cardBg,
                        borderColor: theme.borderColor,
                        color: theme.textMuted,
                      }}
                    >
                      {copiedId ? (
                        <>
                          <Check className="w-3 h-3" style={{ color: theme.primaryColor }} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  <span
                    className={`px-2.5 py-1 text-[11px] font-bold shrink-0 ${theme.chipRadiusClass}`}
                    style={{
                      backgroundColor: theme.primaryColor,
                      color: theme.onPrimaryText,
                    }}
                  >
                    {trackedOrder.status}
                  </span>
                </div>

                <p className="text-base font-bold" style={{ fontFamily: theme.headingFontFamily }}>
                  {currentStepMeta.title}
                </p>
                <p className="text-xs" style={{ color: theme.textMuted }}>
                  {currentStepMeta.description}
                </p>
                <p className="text-[11px]" style={{ color: theme.textMuted }}>
                  Placed: {trackedOrder.placedAt}
                </p>
              </div>

              {/* 4-Step Visual Progress Stepper */}
              <div
                className="p-4 sm:p-5 rounded-2xl border"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.canvasBg }}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: theme.textMuted }}>
                  Fulfillment Progress
                </h3>

                <ol className="space-y-0">
                  {TRACKING_STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const isReached = index <= currentStepIndex;
                    const isLast = index === TRACKING_STEPS.length - 1;

                    return (
                      <li key={step.status} className="relative flex gap-3.5">
                        {/* Vertical Track & Icon Node */}
                        <div className="flex flex-col items-center shrink-0">
                          <div
                            className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors shrink-0"
                            style={
                              isReached
                                ? {
                                    backgroundColor: theme.primaryColor,
                                    borderColor: theme.primaryColor,
                                    color: theme.onPrimaryText,
                                  }
                                : {
                                    backgroundColor: theme.cardBg,
                                    borderColor: theme.borderColor,
                                    color: theme.textMuted,
                                  }
                            }
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          {!isLast && (
                            <div
                              aria-hidden="true"
                              className="w-0.5 flex-1 min-h-[28px] my-1 rounded-full transition-colors"
                              style={{
                                backgroundColor: isCompleted
                                  ? theme.primaryColor
                                  : theme.borderColor,
                              }}
                            />
                          )}
                        </div>

                        {/* Step Copy */}
                        <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span
                              className={`text-sm ${
                                isReached ? 'font-bold' : 'font-medium'
                              }`}
                              style={{
                                color: isReached ? theme.textPrimary : theme.textMuted,
                              }}
                            >
                              {step.title}
                            </span>

                            {isCurrent && (
                              <span
                                className="px-2 py-0.5 text-[10px] font-bold rounded-md"
                                style={{
                                  backgroundColor: theme.subtleBg,
                                  color: theme.primaryColor,
                                  border: `1px solid ${theme.primaryColor}`,
                                }}
                              >
                                Current Step
                              </span>
                            )}
                          </div>

                          <p
                            className="text-xs mt-0.5 leading-relaxed"
                            style={{ color: theme.textMuted }}
                          >
                            {step.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Order Receipt Summary */}
              <div
                className="p-4 rounded-2xl border space-y-3.5 text-xs"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.cardBg }}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.textMuted }}>
                  Order Receipt Summary
                </h3>

                {/* Customer & Delivery */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <User className="w-3.5 h-3.5 shrink-0" style={{ color: theme.primaryColor }} />
                    <span>{trackedOrder.customer}</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: theme.textMuted }}>
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono tabular-nums">{trackedOrder.phoneNumber}</span>
                  </div>
                  <div className="flex items-start gap-2" style={{ color: theme.textMuted }}>
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{trackedOrder.deliveryAddress}</span>
                  </div>
                  {trackedOrder.notes && (
                    <p
                      className="p-2.5 rounded-lg border text-[11px] mt-1"
                      style={{
                        backgroundColor: theme.subtleBg,
                        borderColor: theme.borderColor,
                        color: theme.textMuted,
                      }}
                    >
                      <strong style={{ color: theme.textPrimary }}>Note:</strong> {trackedOrder.notes}
                    </p>
                  )}
                </div>

                {/* Payment Method */}
                <div
                  className="pt-3 border-t flex items-center justify-between gap-2"
                  style={{ borderColor: theme.borderColor }}
                >
                  <span style={{ color: theme.textMuted }}>Payment Method</span>
                  <span className="font-semibold">{trackedOrder.paymentMethod}</span>
                </div>

                {/* Items List */}
                <div
                  className="pt-3 border-t space-y-2"
                  style={{ borderColor: theme.borderColor }}
                >
                  <p className="font-semibold">
                    Items ({trackedOrder.itemsCount})
                  </p>
                  {trackedOrder.items.map((item, idx) => (
                    <div
                      key={`${item.productId}_${idx}`}
                      className="flex items-start justify-between gap-3"
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

                {/* Fee Breakdown */}
                <div
                  className="pt-3 border-t space-y-1.5"
                  style={{ borderColor: theme.borderColor }}
                >
                  <div className="flex justify-between" style={{ color: theme.textMuted }}>
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(trackedOrder.subtotal, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between" style={{ color: theme.textMuted }}>
                    <span>Delivery Fee</span>
                    <span className="font-mono tabular-nums">
                      {trackedOrder.deliveryFee === 0
                        ? 'Free'
                        : formatCurrency(trackedOrder.deliveryFee, currency)}
                    </span>
                  </div>
                  {trackedOrder.taxAmount > 0 && (
                    <div className="flex justify-between" style={{ color: theme.textMuted }}>
                      <span>Tax / VAT</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(trackedOrder.taxAmount, currency)}
                      </span>
                    </div>
                  )}
                  {trackedOrder.serviceChargeAmount > 0 && (
                    <div className="flex justify-between" style={{ color: theme.textMuted }}>
                      <span>Service Charge</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(trackedOrder.serviceChargeAmount, currency)}
                      </span>
                    </div>
                  )}
                  <div
                    className="pt-2 border-t flex justify-between text-sm font-bold"
                    style={{ borderColor: theme.borderColor }}
                  >
                    <span>Total Amount</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(trackedOrder.total, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="p-6 rounded-2xl border text-center space-y-2.5"
              style={{
                backgroundColor: theme.subtleBg,
                borderColor: theme.borderColor,
              }}
            >
              <PackageSearch
                className="w-8 h-8 mx-auto opacity-80"
                style={{ color: theme.primaryColor }}
              />
              <p className="text-sm font-bold">Check your live delivery status</p>
              <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
                Enter your Order ID above or tap any order pill to see real-time fulfillment updates
                from {store.name}.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
