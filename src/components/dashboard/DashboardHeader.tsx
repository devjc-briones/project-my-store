import { MystoreAnimatedLogo } from '../common/MystoreAnimatedLogo';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CreditCard,
  LogOut,
  Package,
  Shield,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { getPlanLimits } from '../../data/plans';
import { AppRoute } from '../../router/routes';
import { CustomerOrder, Roles } from '../../types/schema';
import { formatCurrency } from '../../utils/pricing';
import { isUserPlanUnpaidDue } from '../../utils/billing';

interface DashboardHeaderProps {
  sectionLabel?: string;
}

interface SellerNotificationItem {
  id: string;
  category: 'order' | 'stock' | 'alert' | 'billing';
  title: string;
  description: string;
  createdAt?: string;
  targetRoute: AppRoute;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function formatNotifTime(iso?: string): string {
  if (!iso) return 'Notice';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recent';
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function DashboardHeader({ sectionLabel }: DashboardHeaderProps) {
  const {
    state,
    navigate,
    signOut,
    pushToast,
    getPaymentSettings,
    markNotificationsRead,
    dismissNotifications,
  } = useStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const user = state.currentUser;
  const isAdmin = user?.role === Roles.Admin;
  const planLabel = getPlanLimits(user?.plan ?? 'starter').label;

  const sellerNotifications = useMemo<SellerNotificationItem[]>(() => {
    if (isAdmin || !user) return [];

    const ownedStores = state.stores.filter((s) => s.ownerId === user.id);
    const storeById = new Map(ownedStores.map((s) => [s.id, s]));
    const dismissedSet = new Set(state.dismissedNotificationIds ?? []);
    const items: SellerNotificationItem[] = [];

    if (
      user.status === 'restricted' &&
      !user.restrictedReason?.includes('Subscription billing')
    ) {
      items.push({
        id: `acct_restricted_${user.id}_${user.restrictedReason ?? 'default'}`,
        category: 'alert',
        title: 'Account restricted',
        description:
          user.restrictedReason?.trim() ||
          'Your merchant account is under review by platform admin.',
        targetRoute: { name: 'dashboard' },
      });
    }

    ownedStores.forEach((store) => {
      if (
        store.status === 'restricted' &&
        !store.restrictedReason?.includes('Subscription billing')
      ) {
        items.push({
          id: `store_restricted_${store.id}_${store.restrictedReason ?? 'default'}`,
          category: 'alert',
          title: `Store restricted: ${store.name}`,
          description:
            store.restrictedReason?.trim() ||
            'This storefront has been restricted by platform admin.',
          createdAt: store.updatedAt,
          targetRoute: { name: 'store-overview', storeId: store.id },
        });
      }
    });

    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const activeOrdersByStore = new Map<string, CustomerOrder[]>();

    (state.placedOrders ?? [])
      .filter((o) => storeById.has(o.storeId) && o.status !== 'Completed')
      .forEach((order) => {
        const list = activeOrdersByStore.get(order.storeId) ?? [];
        list.push(order);
        activeOrdersByStore.set(order.storeId, list);
      });

    activeOrdersByStore.forEach((storeOrders, storeId) => {
      const storeName = storeById.get(storeId)?.name || storeOrders[0]?.storeName || 'Shop';
      const currency = getPaymentSettings(storeId).currency;

      const chronological = storeOrders
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const groups: Array<{
        firstOrderId: string;
        latestAt: string;
        latestMs: number;
        count: number;
        totalAmount: number;
      }> = [];

      chronological.forEach((order) => {
        const orderMs = new Date(order.createdAt).getTime();
        const currentGroup = groups[groups.length - 1];

        if (
          currentGroup &&
          !Number.isNaN(orderMs) &&
          !Number.isNaN(currentGroup.latestMs) &&
          orderMs - currentGroup.latestMs < TEN_MINUTES_MS
        ) {
          currentGroup.count += 1;
          currentGroup.totalAmount += order.grandTotal;
          currentGroup.latestAt = order.createdAt;
          currentGroup.latestMs = orderMs;
        } else {
          groups.push({
            firstOrderId: order.id,
            latestAt: order.createdAt,
            latestMs: orderMs,
            count: 1,
            totalAmount: order.grandTotal,
          });
        }
      });

      groups.forEach((group) => {
        items.push({
          id: `shop_order_${storeId}_${group.firstOrderId}_${group.count}`,
          category: 'order',
          title: `${storeName} received ${group.count} ${group.count === 1 ? 'order' : 'orders'}`,
          description: `Total ${formatCurrency(group.totalAmount, currency)} · Tap to view shop orders`,
          createdAt: group.latestAt,
          targetRoute: {
            name: 'store-products',
            storeId,
            initialTab: 'orders',
          },
        });
      });
    });

    state.products
      .filter((p) => storeById.has(p.storeId) && p.isAvailable && p.stock <= 5)
      .forEach((product) => {
        const storeName = storeById.get(product.storeId)?.name || 'Store';
        items.push({
          id: `stock_${product.id}_${product.stock}`,
          category: 'stock',
          title:
            product.stock <= 0
              ? `Out of stock: ${product.name}`
              : `Low stock: ${product.name}`,
          description:
            product.stock <= 0
              ? `0 units left in ${storeName}`
              : `Only ${product.stock} left in ${storeName}`,
          createdAt: product.updatedAt,
          targetRoute: {
            name: 'store-products',
            storeId: product.storeId,
            initialTab: 'products',
          },
        });
      });

    (state.subscriptionTransactions ?? [])
      .filter((tx) => tx.userId === user.id)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.approvedAt ?? b.createdAt).getTime() -
          new Date(a.approvedAt ?? a.createdAt).getTime()
      )
      .forEach((tx) => {
        const planName = tx.planId === 'pro' ? 'Pro' : 'Free';
        items.push({
          id: `sub_${tx.id}_${tx.status}`,
          category: 'billing',
          title:
            tx.status === 'refunded'
              ? 'Subscription refunded'
              : tx.status === 'pending'
                ? 'Payment pending approval'
                : 'Payment completed',
          description:
            tx.status === 'refunded'
              ? `${formatCurrency(tx.amount, 'PHP')} via ${tx.paymentMethod}`
              : tx.status === 'pending'
                ? `${formatCurrency(tx.amount, 'PHP')} via ${tx.paymentMethod} (${tx.referenceId}) · Awaiting admin approval`
                : `${planName} plan (${formatCurrency(tx.amount, 'PHP')}) approved via ${tx.paymentMethod}`,
          createdAt: tx.approvedAt ?? tx.createdAt,
          targetRoute: { name: 'upgrade-plan' },
        });
      });

    if (isUserPlanUnpaidDue(user, state.subscriptionTransactions)) {
      items.push({
        id: `plan_due_${user.id}_${user.planPeriodEndsAt}`,
        category: 'alert',
        title: 'Active stores temporarily closed',
        description:
          'All active stores are temporarily closed due to unpaid plan. Tap to pay and reopen.',
        createdAt: user.planPeriodEndsAt,
        targetRoute: { name: 'upgrade-plan' },
      });
    }

    return items
      .filter((item) => item.id.startsWith('plan_due_') || !dismissedSet.has(item.id))
      .sort((a, b) => {
        if (a.category === 'alert' && b.category !== 'alert') return -1;
        if (b.category === 'alert' && a.category !== 'alert') return 1;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
  }, [
    isAdmin,
    user,
    state.stores,
    state.placedOrders,
    state.products,
    state.subscriptionTransactions,
    state.dismissedNotificationIds,
    getPaymentSettings,
  ]);

  const readNotificationSet = useMemo(
    () => new Set(state.readNotificationIds ?? []),
    [state.readNotificationIds]
  );

  const unreadIds = useMemo(
    () =>
      sellerNotifications
        .filter((item) => !readNotificationSet.has(item.id))
        .map((item) => item.id),
    [sellerNotifications, readNotificationSet]
  );

  const unreadCount = unreadIds.length;

  useEffect(() => {
    if (!dropdownOpen && !notifOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownOpen && dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
      }
      if (notifOpen && notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen, notifOpen]);

  const handleSignOut = () => {
    setDropdownOpen(false);
    setNotifOpen(false);
    signOut();
    pushToast({
      type: 'info',
      title: 'Signed out',
      description: 'You have exited your merchant session.',
    });
    navigate({ name: 'login', mode: 'signin' });
  };

  const renderNotifIcon = (category: SellerNotificationItem['category']) => {
    switch (category) {
      case 'order':
        return (
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
        );
      case 'stock':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" />
          </div>
        );
      case 'alert':
        return (
          <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        );
      case 'billing':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-4">
          {/* Left: SaaS Brand Logo */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate({ name: isAdmin ? 'admin' : 'dashboard' })}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-lg py-1"
              aria-label={isAdmin ? 'mystore admin console' : 'mystore dashboard'}
            >
              <MystoreAnimatedLogo />
            </button>
            {sectionLabel && (
              <>
                <span className="text-slate-300 select-none" aria-hidden="true">
                  /
                </span>
                <span className="text-sm font-medium text-slate-600 truncate">{sectionLabel}</span>
              </>
            )}
          </div>

          {/* Right: Seller Notification Bell + User Initials <-> X Account Menu */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {!isAdmin && (
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  aria-label={
                    unreadCount > 0
                      ? `Notifications (${unreadCount} unread)`
                      : 'Notifications'
                  }
                  aria-haspopup="menu"
                  aria-expanded={notifOpen}
                  onClick={() => {
                    setDropdownOpen(false);
                    setNotifOpen((prev) => !prev);
                  }}
                  className={`relative inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)] active:scale-95 transition-all duration-200 cursor-pointer touch-manipulation select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    notifOpen ? 'bg-slate-50 border-slate-300' : ''
                  }`}
                >
                  <Bell className="w-[18px] h-[18px] text-slate-700" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums ring-2 ring-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                <div
                  role="menu"
                  aria-hidden={!notifOpen}
                  aria-label="Seller notifications"
                  className={`fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-[4.5rem] sm:top-auto sm:mt-2.5 sm:w-80 origin-top-right bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl shadow-slate-900/15 overflow-hidden z-50 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    notifOpen
                      ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto drawer-active'
                      : '-translate-y-2 scale-[0.96] opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[11px] font-semibold tabular-nums">
                          {unreadCount} new
                        </span>
                      )}
                    </div>

                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        tabIndex={notifOpen ? 0 : -1}
                        onClick={() => markNotificationsRead(unreadIds)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer shrink-0"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    ) : (
                      sellerNotifications.length > 0 && (
                        <button
                          type="button"
                          tabIndex={notifOpen ? 0 : -1}
                          onClick={() =>
                            dismissNotifications(sellerNotifications.map((n) => n.id))
                          }
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
                        >
                          Clear all
                        </button>
                      )
                    )}
                  </div>

                  {sellerNotifications.length === 0 ? (
                    <div className="px-5 py-9 text-center space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-500 mx-auto">
                        <Bell className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-semibold text-slate-800">
                        No notifications yet
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        New orders, low-stock alerts, and account updates will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[364px] overflow-y-auto overscroll-contain divide-y divide-slate-100">
                      {sellerNotifications.map((item) => {
                        const isUnread = !readNotificationSet.has(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            tabIndex={notifOpen ? 0 : -1}
                            onClick={() => {
                              markNotificationsRead([item.id]);
                              setNotifOpen(false);
                              navigate(item.targetRoute);
                            }}
                            className={`w-full h-[72px] px-4 py-2.5 text-left flex items-center gap-3 transition-colors cursor-pointer ${
                              isUnread
                                ? 'bg-slate-50/85 hover:bg-slate-100/80'
                                : 'bg-white hover:bg-slate-50'
                            }`}
                          >
                            {renderNotifIcon(item.category)}
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className={`text-xs leading-4 truncate ${
                                    isUnread
                                      ? 'font-bold text-slate-900'
                                      : 'font-semibold text-slate-700'
                                  }`}
                                >
                                  {item.title}
                                </p>
                                <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                                  {formatNotifTime(item.createdAt)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-4">
                                {item.description}
                              </p>
                            </div>
                            {isUnread && (
                              <span
                                className="w-2 h-2 rounded-full bg-rose-600 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                aria-label={dropdownOpen ? 'Close account menu' : 'Open account menu'}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                onClick={() => {
                  setNotifOpen(false);
                  setDropdownOpen((prev) => !prev);
                }}
                className={`inline-flex items-center justify-center gap-2.5 min-h-[44px] min-w-[44px] p-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)] active:scale-95 transition-all duration-200 cursor-pointer touch-manipulation select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  dropdownOpen ? 'dash-menu-open bg-slate-50 border-slate-300' : ''
                }`}
              >
                <div className="relative w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden">
                  {/* Initials Layer */}
                  <span
                    aria-hidden={dropdownOpen}
                    className={`dash-morph-layer absolute inset-0 flex items-center justify-center ${
                      dropdownOpen
                        ? 'opacity-0 scale-50 rotate-45 pointer-events-none'
                        : 'opacity-100 scale-100 rotate-0'
                    }`}
                  >
                    {user ? getInitials(user.name) : <UserIcon className="w-4 h-4" />}
                  </span>

                  {/* Morphing X Layer */}
                  <span
                    aria-hidden={!dropdownOpen}
                    className={`dash-morph-layer absolute inset-0 flex items-center justify-center pointer-events-none ${
                      dropdownOpen
                        ? 'opacity-100 scale-100 rotate-0'
                        : 'opacity-0 scale-50 -rotate-45'
                    }`}
                  >
                    <span className="dash-x-bar dash-x-bar-1 absolute w-4 h-[2px] rounded-full bg-white" />
                    <span className="dash-x-bar dash-x-bar-2 absolute w-4 h-[2px] rounded-full bg-white" />
                  </span>
                </div>

                <div className="hidden sm:block text-left max-w-[140px] pr-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {user?.name ?? 'Merchant'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {isAdmin ? 'Administrator' : `${planLabel} plan`}
                  </p>
                </div>
              </button>

              <div
                role="menu"
                aria-hidden={!dropdownOpen}
                aria-label="Account menu"
                className={`absolute right-0 mt-2.5 w-64 origin-top-right bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl shadow-slate-900/15 py-2 z-50 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  dropdownOpen
                    ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto drawer-active'
                    : '-translate-y-2 scale-[0.96] opacity-0 pointer-events-none'
                }`}
              >
                <div className="nav-item-stagger px-4 py-2.5 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {user?.name ?? 'Merchant'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {user?.email ?? 'merchant@mystore.com'}
                  </p>
                </div>

                <div className="nav-item-stagger py-1">
                  {isAdmin ? (
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={dropdownOpen ? 0 : -1}
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate({ name: 'admin' });
                      }}
                      className="w-full min-h-[40px] px-4 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-slate-600" />
                      <span>Admin Console</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={dropdownOpen ? 0 : -1}
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate({ name: 'upgrade-plan' });
                      }}
                      className="w-full min-h-[40px] px-4 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-between gap-2.5 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Sparkles className="w-4 h-4 text-slate-600" />
                        <span>Upgrade Plan</span>
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700">
                        {planLabel}
                      </span>
                    </button>
                  )}
                </div>

                <div className="nav-item-stagger pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={dropdownOpen ? 0 : -1}
                    onClick={handleSignOut}
                    className="w-full min-h-[40px] px-4 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="h-16 shrink-0" aria-hidden="true" />
    </>
  );
}
