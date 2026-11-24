import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { AdminModalWrapper } from '../components/admin/AdminModalWrapper';
import {
  ArrowLeft,
  CreditCard,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  Lock,
  LogOut,
  Mail,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  Users,
} from 'lucide-react';
import { MystoreAnimatedLogo } from '../components/common/MystoreAnimatedLogo';
import { AdminOverviewTab, AdminTabId } from '../components/admin/AdminOverviewTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminStoresTab } from '../components/admin/AdminStoresTab';
import { AdminRevenueTab } from '../components/admin/AdminRevenueTab';
import { AdminPaymentSettingsTab } from '../components/admin/AdminPaymentSettingsTab';
import { AdminOrdersBuyersTab } from '../components/admin/AdminOrdersBuyersTab';
import { useStore } from '../context/StoreContext';
import { PLATFORM_PLANS } from '../data/plans';
import {
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  Roles,
  Store,
  StoreStatus,
  SubscriptionTransaction,
  User,
} from '../types/schema';

const ADMIN_TABS: Array<{
  id: AdminTabId;
  label: string;
  description: string;
  icon: typeof LayoutGrid;
}> = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Platform KPIs, Pro plan revenue & moderation summary',
    icon: LayoutGrid,
  },
  {
    id: 'users',
    label: 'Users',
    description: 'Manage merchant accounts & view store buyer counts (read-only)',
    icon: Users,
  },
  {
    id: 'stores',
    label: 'Stores',
    description: 'Publish, unpublish, restrict, inspect, or delete storefronts',
    icon: StoreIcon,
  },
  {
    id: 'revenue',
    label: 'Plans & Billing',
    description: 'Track Pro plan earnings, MRR, and billing transactions',
    icon: CreditCard,
  },
  {
    id: 'payment-settings',
    label: 'Payment Setting',
    description: 'Configure available plan payment methods, account numbers & QR codes',
    icon: QrCode,
  },
  {
    id: 'orders',
    label: 'Orders & Buyers',
    description: 'Live storefront orders and read-only registered store customers',
    icon: ShoppingBag,
  },
];

const PRO_PRICE = PLATFORM_PLANS.find((p) => p.id === 'pro')?.monthlyPrice ?? 369;

export function AdminPage() {
  const {
    state,
    navigate,
    signInAdminUser,
    signOut,
    pushToast,
    adminUpdateUser,
    adminDeleteUser,
    adminUpdateStore,
    deleteStore,
    recordSubscriptionPayment,
    adminToggleSubscriptionTxStatus,
    updateOrderStatus,
    updateOrderPaymentStatus,
    platformPaymentSettings,
    updatePlatformPaymentSettings,
  } = useStore();

  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [ownerFilterUserId, setOwnerFilterUserId] = useState<string | null>(null);
  const [buyerFilterStoreId, setBuyerFilterStoreId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);

  // Lock body scrolling when the navigation drawer menu is open
  useBodyScrollLock(menuOpen);

  // Admin Login Gate state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [shakeAdminForm, setShakeAdminForm] = useState(false);
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);

  const isAdminAuthenticated = state.currentUser?.role === Roles.Admin;

  const users = useMemo(() => {
    return (state.users ?? []).filter((u) => u.role !== Roles.Admin);
  }, [state.users]);

  const transactions = state.subscriptionTransactions ?? [];
  const pendingTxCount = useMemo(
    () => transactions.filter((tx) => tx.status === 'pending').length,
    [transactions]
  );
  const enabledPaymentMethodsCount = useMemo(
    () => platformPaymentSettings.channels.filter((c) => c.enabled).length,
    [platformPaymentSettings.channels]
  );
  const orders = state.placedOrders ?? [];
  const buyers = state.buyers ?? [];

  const ordersGmv = useMemo(
    () => orders.reduce((sum, o) => sum + o.grandTotal, 0),
    [orders]
  );

  const activeTabMeta = ADMIN_TABS.find((t) => t.id === activeTab) ?? ADMIN_TABS[0];

  useEffect(() => {
    if (!menuOpen && !signOutModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (signOutModalOpen) {
          setSignOutModalOpen(false);
        } else if (menuOpen) {
          setMenuOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, signOutModalOpen]);

  const switchTab = (tab: AdminTabId) => {
    setActiveTab(tab);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateUserPlan = (userId: string, nextPlan: 'starter' | 'pro') => {
    const target = users.find((u) => u.id === userId);
    adminUpdateUser(userId, {
      plan: nextPlan,
      cancelAtPeriodEnd: false,
      planPeriodEndsAt:
        nextPlan === 'pro'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
    });
    if (target && nextPlan === 'pro') {
      recordSubscriptionPayment({
        userId: target.id,
        userName: target.name,
        userEmail: target.email,
        planId: 'pro',
        amount: PRO_PRICE,
        paymentMethod: 'Admin Grant',
      });
    }
    pushToast({
      type: 'success',
      title: `Updated plan to ${nextPlan === 'pro' ? 'Pro' : 'Free'}`,
      description: `${target?.name ?? 'User'} is now on the ${
        nextPlan === 'pro' ? 'Pro (₱369/mo)' : 'Free'
      } tier.`,
    });
  };

  const handleToggleRestrictUser = (user: User, reason?: string) => {
    const nextRestricted = user.status !== 'restricted';
    adminUpdateUser(user.id, {
      status: nextRestricted ? 'restricted' : 'active',
      restrictedReason: nextRestricted ? reason || 'Restricted by admin.' : undefined,
    });
    pushToast({
      type: nextRestricted ? 'info' : 'success',
      title: nextRestricted ? `Restricted ${user.name}` : `Unrestricted ${user.name}`,
      description: nextRestricted
        ? 'Account can no longer create new stores until unrestricted.'
        : 'Account access has been restored.',
    });
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    adminDeleteUser(userId);
    pushToast({
      type: 'success',
      title: 'User deleted',
      description: `${target?.name ?? 'Merchant'} and all associated stores were removed.`,
    });
  };

  const handleChangeStoreStatus = (store: Store, nextStatus: StoreStatus, reason?: string) => {
    adminUpdateStore(store.id, {
      status: nextStatus,
      restrictedReason: nextStatus === 'restricted' ? reason : undefined,
    });
    const labelMap: Record<StoreStatus, string> = {
      published: 'published live',
      draft: store.status === 'restricted' ? 'restored to draft' : 'unpublished to draft',
      restricted: 'restricted',
    };
    pushToast({
      type: nextStatus === 'restricted' ? 'info' : 'success',
      title: `${store.name} ${labelMap[nextStatus]}`,
      description:
        nextStatus === 'restricted'
          ? 'Public storefront access is now blocked.'
          : nextStatus === 'draft'
            ? 'Storefront moved offline to Draft status.'
            : `${store.domainUrl} is now live.`,
    });
  };

  const handleDeleteStore = (storeId: string) => {
    const target = state.stores.find((s) => s.id === storeId);
    deleteStore(storeId);
    pushToast({
      type: 'success',
      title: 'Store deleted',
      description: `"${target?.name ?? 'Store'}" and its catalog have been permanently removed.`,
    });
  };

  const handleRecordManualProPayment = (
    user: User,
    paymentMethod: string,
    status: SubscriptionTransaction['status'] = 'paid'
  ) => {
    if (status === 'paid') {
      adminUpdateUser(user.id, {
        plan: 'pro',
        cancelAtPeriodEnd: false,
        planPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    recordSubscriptionPayment({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      planId: 'pro',
      amount: PRO_PRICE,
      paymentMethod,
      status,
    });
    pushToast({
      type: status === 'paid' ? 'success' : 'info',
      title: status === 'paid' ? 'Pro payment recorded' : 'Pending payment logged',
      description:
        status === 'paid'
          ? `Logged ₱${PRO_PRICE} via ${paymentMethod} for ${user.name}. Payment completed notification sent.`
          : `Logged ₱${PRO_PRICE} via ${paymentMethod} for ${user.name} as pending approval.`,
    });
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderFulfillmentStatus) => {
    updateOrderStatus(orderId, status);
    pushToast({
      type: 'success',
      title: `Order ${orderId} updated`,
      description: `Status set to ${status}.`,
    });
  };

  const handleUpdateOrderPaymentStatus = (
    orderId: string,
    paymentStatus: OrderPaymentStatus
  ) => {
    updateOrderPaymentStatus(orderId, paymentStatus);
    pushToast({
      type: paymentStatus === 'paid' ? 'success' : 'info',
      title: `Order ${orderId} payment updated`,
      description: `Payment status set to ${paymentStatus.replace('_', ' ')}.`,
    });
  };

  const handleConfirmAdminSignOut = () => {
    setSignOutModalOpen(false);
    setMenuOpen(false);
    signOut();
    setAdminEmail('');
    setAdminPassword('');
    setAdminLoginError(null);
    pushToast({
      type: 'info',
      title: 'Signed out',
      description: 'You have exited the admin session.',
    });
    navigate({ name: 'login', mode: 'signin' });
  };

  const handleAdminGateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isAdminLoggingIn) return;
    setIsAdminLoggingIn(true);
    try {
      const res = await signInAdminUser(adminEmail, adminPassword);
      setIsAdminLoggingIn(false);
      if (!res.success) {
        const errMsg = res.error || 'Invalid admin credentials.';
        setAdminLoginError(errMsg);
        if (res.isSystemError) {
          pushToast({
            type: 'error',
            title: 'Database Error',
            description: errMsg,
          });
        }
        setShakeAdminForm(false);
        window.requestAnimationFrame(() => {
          setShakeAdminForm(true);
          window.setTimeout(() => setShakeAdminForm(false), 400);
        });
        return;
      }
      setAdminLoginError(null);
      pushToast({
        type: 'success',
        title: 'Admin signed in',
        description: 'Welcome to the mystore Admin Console.',
      });
    } catch (err: any) {
      setIsAdminLoggingIn(false);
      setAdminLoginError(err?.message || 'Unable to connect to database.');
    }
  };

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between px-4 py-6 sm:px-8">
        <div className="max-w-md w-full mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate({ name: 'landing' })}
            className="cursor-pointer focus:outline-none"
          >
            <MystoreAnimatedLogo />
          </button>
          <button
            type="button"
            onClick={() =>
              navigate({ name: state.currentUser ? 'dashboard' : 'login', mode: 'signin' })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{state.currentUser ? 'Back to Dashboard' : 'Merchant Sign In'}</span>
          </button>
        </div>

        <div className="max-w-[410px] w-full mx-auto my-8 bg-white rounded-[24px] border border-[#e2e8f0] shadow-[0_20px_50px_-12px_rgba(15,23,42,0.10)] p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0f172a] text-white shadow-lg shadow-slate-900/20 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">Admin Console</h1>
            <p className="text-sm text-slate-500 mt-1">
              Sign in with your administrator credentials
            </p>
          </div>

          {state.currentUser && state.currentUser.role !== Roles.Admin && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              Signed in as <span className="font-semibold">{state.currentUser.email}</span>. Seller
              accounts cannot access admin controls.
            </div>
          )}

          <form
            onSubmit={handleAdminGateSubmit}
            noValidate
            className={`space-y-4 ${shakeAdminForm ? 'auth-shake' : ''}`}
          >
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5"
              >
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    if (adminLoginError) setAdminLoginError(null);
                  }}
                  placeholder="admin@domain.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 focus:bg-white text-sm text-slate-900 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold tracking-wide text-slate-600 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password"
                  type={showAdminPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    if (adminLoginError) setAdminLoginError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-slate-50 focus:bg-white text-sm text-slate-900 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPass((prev) => !prev)}
                  aria-label={showAdminPass ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {adminLoginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {adminLoginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isAdminLoggingIn}
              className="w-full min-h-[46px] py-3 px-4 bg-[#0f172a] hover:bg-slate-800 disabled:opacity-75 text-white text-sm font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isAdminLoggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Sign In to Admin'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400">© 2026 mystore Platform Administration</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col antialiased">
      {/* ========================================================= */}
      {/* 1. CLEAN TOP NAVIGATION BAR (ANIMATED LOGO + BURGER MENU) */}
      {/* ========================================================= */}
      <header className="fixed top-0 inset-x-0 z-50 h-14 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0]">
        <div className="max-w-5xl mx-auto px-4 h-full flex items-center justify-between">
          <button
            type="button"
            onClick={() => switchTab('overview')}
            className="focus:outline-none cursor-pointer py-1 rounded-lg"
            aria-label="mystore admin overview"
          >
            <MystoreAnimatedLogo />
          </button>

          <button
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="admin-nav-drawer"
            onClick={() => setMenuOpen((prev) => !prev)}
            className={`relative z-50 w-10 h-10 -mr-1.5 rounded-xl flex items-center justify-center text-slate-800 hover:bg-slate-100 active:bg-slate-200/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer ${
              menuOpen ? 'menu-open' : ''
            }`}
          >
            <span className="sr-only">Toggle Menu</span>
            <div className="w-[19px] h-[16px] flex flex-col justify-between items-center pointer-events-none">
              <span className="burger-line line-1 block w-full h-[2px] rounded-full bg-[#0f172a]" />
              <span className="burger-line line-2 block w-full h-[2px] rounded-full bg-[#0f172a]" />
              <span className="burger-line line-3 block w-full h-[2px] rounded-full bg-[#0f172a]" />
            </div>
          </button>
        </div>
      </header>

      {/* Spacer matching fixed header height */}
      <div className="h-14 shrink-0" aria-hidden="true" />

      {/* ========================================================= */}
      {/* 2. BACKDROP & FLOATING HAMBURGER NAVIGATION DRAWER        */}
      {/* ========================================================= */}
      <div
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-300 ease-out touch-none ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        id="admin-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Admin Navigation Menu"
        aria-hidden={!menuOpen}
        className={`fixed top-[4rem] left-3 right-3 z-[45] mx-auto max-w-md rounded-2xl bg-white/95 backdrop-blur-md border border-[#e2e8f0] shadow-2xl shadow-slate-900/15 p-3 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain transform transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          menuOpen
            ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto drawer-active'
            : '-translate-y-3 scale-[0.98] opacity-0 pointer-events-none'
        }`}
      >
        <div className="px-2.5 pt-1 pb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Admin Navigation
          </span>
          <span className="text-[11px] font-medium text-slate-500">Admin Console</span>
        </div>

        <nav className="flex flex-col gap-1">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => switchTab(tab.id)}
                className={`admin-drawer-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#0f172a] text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 font-medium'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-500'
                    }`}
                  />
                  <span>{tab.label}</span>
                </span>

                {tab.id === 'overview' && isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
                {tab.id === 'users' && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {users.length + buyers.length}
                  </span>
                )}
                {tab.id === 'stores' && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {state.stores.length}
                  </span>
                )}
                {tab.id === 'revenue' && (
                  <span
                    className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                      pendingTxCount > 0
                        ? isActive
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'bg-amber-100 text-amber-800 font-bold'
                        : isActive
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {pendingTxCount > 0 ? `${pendingTxCount} pending` : 'Pro'}
                  </span>
                )}
                {tab.id === 'payment-settings' && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {enabledPaymentMethodsCount}/{platformPaymentSettings.channels.length}
                  </span>
                )}
                {tab.id === 'orders' && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {orders.length}
                  </span>
                )}
              </button>
            );
          })}

          <div className="admin-drawer-item pt-2 mt-1.5 border-t border-[#e2e8f0]">
            <button
              type="button"
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => {
                setMenuOpen(false);
                setSignOutModalOpen(true);
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#fff1f2] hover:bg-rose-100/80 active:scale-[0.99] text-[#e11d48] font-semibold text-sm transition-all cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sign Out</span>
              </span>
              <span className="text-[11px] font-normal text-rose-500/80 truncate max-w-[140px]">
                {state.currentUser?.email}
              </span>
            </button>
          </div>
        </nav>
      </aside>

      {/* ========================================================= */}
      {/* 3. MAIN CONTENT AREA                                      */}
      {/* ========================================================= */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-4">
        <div key={activeTab} className="admin-view-animate space-y-3.5">
          <div className="px-0.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a]">
              {activeTabMeta.label}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {activeTabMeta.description}
            </p>
          </div>

          {activeTab === 'overview' && (
            <AdminOverviewTab
              users={users}
              buyersCount={buyers.length}
              stores={state.stores}
              productsCount={state.products.length}
              transactions={transactions}
              ordersCount={orders.length}
              ordersGmv={ordersGmv}
              onNavigateTab={switchTab}
              onQuickUnrestrictUser={(userId) => {
                const target = users.find((u) => u.id === userId);
                if (target) handleToggleRestrictUser(target);
              }}
              onQuickUnrestrictStore={(storeId) => {
                const target = state.stores.find((s) => s.id === storeId);
                if (target) handleChangeStoreStatus(target, 'draft');
              }}
            />
          )}

          {activeTab === 'users' && (
            <AdminUsersTab
              users={users}
              buyers={buyers}
              stores={state.stores}
              transactions={transactions}
              currentUserId={state.currentUser?.id}
              initialBuyerStoreId={buyerFilterStoreId}
              onClearBuyerStoreFilter={() => setBuyerFilterStoreId(null)}
              onUpdateUserPlan={handleUpdateUserPlan}
              onToggleRestrictUser={handleToggleRestrictUser}
              onDeleteUser={handleDeleteUser}
              onViewUserStores={(userId) => {
                setOwnerFilterUserId(userId);
                switchTab('stores');
              }}
            />
          )}

          {activeTab === 'stores' && (
            <AdminStoresTab
              stores={state.stores}
              users={users}
              buyers={buyers}
              products={state.products}
              ownerFilterUserId={ownerFilterUserId}
              onClearOwnerFilter={() => setOwnerFilterUserId(null)}
              onChangeStoreStatus={handleChangeStoreStatus}
              onDeleteStore={handleDeleteStore}
              onOpenStorefront={(slug) => navigate({ name: 'storefront', storeSlug: slug })}
              onManageStoreProducts={(storeId) => navigate({ name: 'store-products', storeId })}
              onViewStoreBuyers={(storeId) => {
                setBuyerFilterStoreId(storeId);
                switchTab('users');
              }}
            />
          )}

          {activeTab === 'revenue' && (
            <AdminRevenueTab
              users={users}
              stores={state.stores}
              transactions={transactions}
              paymentMethodLabels={platformPaymentSettings.channels.map((c) => c.label)}
              onToggleTxStatus={(txId, nextStatus) => {
                const targetTx = transactions.find((t) => t.id === txId);
                adminToggleSubscriptionTxStatus(txId, nextStatus);
                if (nextStatus === 'paid') {
                  pushToast({
                    type: 'success',
                    title:
                      targetTx?.status === 'pending' ? 'Payment approved' : 'Transaction restored',
                    description:
                      targetTx?.status === 'pending'
                        ? `Payment completed notification sent to ${targetTx.userName} and Pro plan activated.`
                        : 'Billing status marked as paid.',
                  });
                } else {
                  pushToast({
                    type: 'info',
                    title: 'Transaction refunded',
                    description: `Billing status marked as ${nextStatus}.`,
                  });
                }
              }}
              onRecordManualProPayment={handleRecordManualProPayment}
            />
          )}

          {activeTab === 'payment-settings' && (
            <AdminPaymentSettingsTab
              settings={platformPaymentSettings}
              onUpdateSettings={updatePlatformPaymentSettings}
            />
          )}

          {activeTab === 'orders' && (
            <AdminOrdersBuyersTab
              orders={orders}
              buyers={buyers}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateOrderPaymentStatus={handleUpdateOrderPaymentStatus}
            />
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* 4. SIGN OUT CONFIRMATION MODAL                            */}
      {/* ========================================================= */}
      <AdminModalWrapper
        isOpen={signOutModalOpen}
        onClose={() => setSignOutModalOpen(false)}
        ariaLabelledBy="admin-signout-modal-title"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl border border-[#e2e8f0] max-w-xs w-full p-5 shadow-2xl space-y-4 my-auto"
        >
          <div className="space-y-1">
            <h2 id="admin-signout-modal-title" className="text-base font-bold text-[#0f172a]">
              Sign out of mystore?
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              You will be logged out of the admin dashboard session.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSignOutModalOpen(false)}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAdminSignOut}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#e11d48] text-xs font-semibold text-white hover:bg-rose-700 transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </AdminModalWrapper>
    </div>
  );
}
