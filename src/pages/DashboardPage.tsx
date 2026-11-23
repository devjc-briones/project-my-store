import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  Package,
  Plus,
  Search,
  Sparkles,
  Store as StoreIcon,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { StoreCard } from '../components/dashboard/StoreCard';
import { getPlanLimits } from '../data/plans';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { Store, StoreStatus } from '../types/schema';
import { isUserPlanPastDue, isUserPlanUnpaidDue } from '../utils/billing';

type StatusFilter = 'all' | StoreStatus;

export function DashboardPage() {
  const { state, navigate, deleteStore, pushToast } = useStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [storeLimitModalOpen, setStoreLimitModalOpen] = useState(false);

  useBodyScrollLock(Boolean(storeToDelete) || storeLimitModalOpen);

  useEffect(() => {
    if (!storeToDelete && !storeLimitModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStoreToDelete(null);
        setStoreLimitModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [storeToDelete, storeLimitModalOpen]);

  const handleConfirmDeleteStore = () => {
    if (!storeToDelete) return;
    const deletedName = storeToDelete.name;
    deleteStore(storeToDelete.id);
    setStoreToDelete(null);
    pushToast({
      type: 'success',
      title: 'Store deleted',
      description: `"${deletedName}" and all of its saved data have been removed.`,
    });
  };

  const ownerId = state.currentUser?.id ?? '';
  const stores = useMemo(
    () => state.stores.filter((s) => s.ownerId === ownerId),
    [state.stores, ownerId]
  );
  const planLimits = getPlanLimits(state.currentUser?.plan ?? 'starter');
  const isUserRestricted =
    state.currentUser?.status === 'restricted' &&
    !state.currentUser?.restrictedReason?.includes('Subscription billing');
  const isPlanPastDue = isUserPlanPastDue(state.currentUser);
  const isPlanUnpaid = isUserPlanUnpaidDue(state.currentUser, state.subscriptionTransactions);
  const canAddStore = !isUserRestricted && !isPlanPastDue && stores.length < planLimits.maxStores;
  const totalProducts = useMemo(() => {
    const ownedIds = new Set(stores.map((s) => s.id));
    return state.products.filter((p) => ownedIds.has(p.storeId)).length;
  }, [stores, state.products]);
  const publishedCount = stores.filter((s) => s.status === 'published').length;
  const draftCount = stores.filter((s) => s.status === 'draft').length;

  const handleAddNewStoreClick = () => {
    if (isPlanPastDue) {
      navigate({ name: 'upgrade-plan' });
      return;
    }
    if (!canAddStore) {
      setStoreLimitModalOpen(true);
      return;
    }
    navigate({ name: 'store-create' });
  };

  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stores.filter((store) => {
      if (statusFilter !== 'all' && store.status !== statusFilter) return false;
      if (q && !store.name.toLowerCase().includes(q) && !store.slug.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [stores, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <DashboardHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
        </div>

        {/* Single Warning Banner */}
        {isPlanUnpaid ? (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg ring-4 ring-amber-500/20 transition-all">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-amber-950 flex flex-wrap items-center gap-2">
                  <span>All active stores are temporarily closed due to unpaid plan</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white uppercase tracking-wider">
                    Action Required
                  </span>
                </p>
                <p className="text-xs sm:text-sm text-amber-900 leading-relaxed font-medium">
                  Your Pro Plan billing period has ended. Please settle your renewal payment to
                  reopen all active storefronts.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate({ name: 'upgrade-plan' })}
              className="min-h-[42px] px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all cursor-pointer shrink-0 shadow-sm"
            >
              Pay Due Plan Now
            </button>
          </div>
        ) : isPlanPastDue ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">
                  Renewal payment pending admin approval
                </p>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  All active stores remain temporarily closed until your submitted payment is
                  approved.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate({ name: 'upgrade-plan' })}
              className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              View Billing Status
            </button>
          </div>
        ) : isUserRestricted ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-rose-900">Account Restricted by Platform Admin</p>
              <p className="text-xs sm:text-sm text-rose-800 leading-relaxed">
                {state.currentUser?.restrictedReason ||
                  'Your merchant account has been restricted due to a policy violation.'}
              </p>
            </div>
          </div>
        ) : null}

        {/* Overview Stats Strip */}
        <section
          aria-label="Workspace Overview"
          className="bg-white border border-slate-200/80 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
        >
          <div className="p-5 sm:px-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Stores</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{stores.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
              <StoreIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="p-5 sm:px-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Products</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{totalProducts}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="p-5 sm:px-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Store Status</p>
              <p className="text-sm sm:text-base font-semibold text-slate-900 tabular-nums mt-1.5">
                {isPlanPastDue && publishedCount > 0
                  ? `${publishedCount} Temp. Closed · ${draftCount} Draft`
                  : `${publishedCount} Published · ${draftCount} Draft`}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Empty State (0 Stores) vs Active State (1+ Stores) */}
        {stores.length === 0 ? (
          <section className="bg-white border border-slate-200/80 rounded-2xl px-6 py-16 sm:py-20 text-center flex flex-col items-center justify-center shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="w-16 h-16 rounded-2xl bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 mb-5">
              <StoreIcon className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              You don&apos;t have any online stores yet.
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-md leading-relaxed">
              Choose from five tailored industry templates, customize your brand theme and banner,
              and start sharing your storefront link.
            </p>
            <button
              type="button"
              onClick={handleAddNewStoreClick}
              className="mt-6 inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer whitespace-nowrap shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Your First Online Store
            </button>
          </section>
        ) : (
          <section className="space-y-6">
            {/* Upper Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    My Stores
                  </h2>
                  {!canAddStore && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                      <Lock className="w-3 h-3" />
                      {planLimits.label} limit ({stores.length}/{planLimits.maxStores})
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-0.5">
                  Select a store card to manage products, or customize its storefront design.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddNewStoreClick}
                className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm ${
                  canAddStore
                    ? 'text-white bg-slate-900 hover:bg-slate-800'
                    : 'text-slate-700 bg-slate-200 hover:bg-slate-300'
                }`}
              >
                {canAddStore ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                Add New Store
              </button>
            </div>

            {/* Search & Status Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="Filter stores"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stores by name or slug..."
                  className="w-full min-h-[42px] pl-10 pr-3.5 py-2 text-sm bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div
                role="tablist"
                aria-label="Filter stores by status"
                className="inline-flex items-center p-1 bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] self-start sm:self-auto"
              >
                {(['all', 'published', 'draft', 'restricted'] as const).map((status) => (
                  <button
                    key={status}
                    role="tab"
                    type="button"
                    aria-selected={statusFilter === status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                      statusFilter === status
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Stores Grid */}
            {filteredStores.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center space-y-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                <p className="text-sm font-semibold text-slate-900">
                  No stores match your current filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStores.map((store) => (
                  <StoreCard
                    key={store.id}
                    store={store}
                    onDeleteRequest={(target) => setStoreToDelete(target)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Delete Store Warning Confirmation Modal */}
      {storeToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-store-modal-title"
          onClick={() => setStoreToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="delete-store-modal-title"
                      className="text-lg font-bold text-slate-900 leading-tight"
                    >
                      Are you sure?
                    </h2>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      Store: <span className="font-semibold text-slate-700">{storeToDelete.name}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close warning dialog"
                  onClick={() => setStoreToDelete(null)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 bg-rose-50/80 border border-rose-200/80 rounded-xl">
                <p className="text-xs sm:text-sm text-rose-900 leading-relaxed">
                  <span className="font-semibold">Warning:</span> All saved customers/users,
                  items, prices, orders, and settings stored in{' '}
                  <span className="font-semibold">{storeToDelete.name}</span> will be permanently
                  deleted and cannot be recovered.
                </p>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200/80 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStoreToDelete(null)}
                className="min-h-[44px] px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStore}
                className="min-h-[44px] px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Plan Store Limit Reached Modal */}
      {storeLimitModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="store-limit-modal-title"
          onClick={() => setStoreLimitModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="store-limit-modal-title"
                      className="text-lg font-bold text-slate-900 leading-tight"
                    >
                      Store Limit Reached
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {planLimits.label} · {stores.length} / {planLimits.maxStores} stores
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close plan limit dialog"
                  onClick={() => setStoreLimitModalOpen(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2">
                <p>
                  Your current <strong>{planLimits.label}</strong> plan includes up to{' '}
                  <strong>
                    {planLimits.maxStores} active store{planLimits.maxStores === 1 ? '' : 's'}
                  </strong>
                  .
                </p>
                <p className="text-slate-600">
                  All your existing stores and data stay safe, and you can upgrade your plan anytime
                  to create additional storefronts.
                </p>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200/80 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStoreLimitModalOpen(false)}
                className="min-h-[44px] px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setStoreLimitModalOpen(false);
                  navigate({ name: 'upgrade-plan' });
                }}
                className="min-h-[44px] px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
