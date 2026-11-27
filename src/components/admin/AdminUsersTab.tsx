import { useEffect, useMemo, useState } from 'react';
import { AdminModalWrapper } from './AdminModalWrapper';
import {
  CheckCircle2,
  Clock,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store as StoreIcon,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { BuyerAccount, Roles, Store, SubscriptionTransaction, User } from '../../types/schema';
import { DEFAULT_PRO_MONTHLY_PRICE, getPlanLimits } from '../../data/plans';
import { isUserPlanPastDue, isUserPlanUnpaidDue } from '../../utils/billing';
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TablePagination,
  usePagination,
} from '../common/TablePagination';

type UserSegment = 'merchants' | 'buyers';
type UserFilter = 'all' | 'pro' | 'free' | 'dues' | 'restricted';

interface AdminUsersTabProps {
  users: User[];
  buyers: BuyerAccount[];
  stores: Store[];
  transactions: SubscriptionTransaction[];
  currentUserId?: string;
  initialBuyerStoreId?: string | null;
  proPrice?: number;
  onClearBuyerStoreFilter?: () => void;
  onUpdateUserPlan: (userId: string, nextPlan: 'starter' | 'pro') => void;
  onToggleRestrictUser: (user: User, reason?: string) => void;
  onDeleteUser: (userId: string) => void;
  onViewUserStores: (userId: string) => void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AdminUsersTab({
  users,
  buyers,
  stores,
  transactions,
  currentUserId,
  initialBuyerStoreId,
  proPrice = DEFAULT_PRO_MONTHLY_PRICE,
  onClearBuyerStoreFilter,
  onUpdateUserPlan,
  onToggleRestrictUser,
  onDeleteUser,
  onViewUserStores,
}: AdminUsersTabProps) {
  const [segment, setSegment] = useState<UserSegment>(initialBuyerStoreId ? 'buyers' : 'merchants');
  const [selectedBuyerStoreId, setSelectedBuyerStoreId] = useState<string>(initialBuyerStoreId ?? 'all');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [restrictModalUser, setRestrictModalUser] = useState<User | null>(null);
  const [restrictReason, setRestrictReason] = useState('');
  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);

  useEffect(() => {
    if (initialBuyerStoreId) {
      setSegment('buyers');
      setSelectedBuyerStoreId(initialBuyerStoreId);
    }
  }, [initialBuyerStoreId]);

  const storeCountByUser = useMemo(() => {
    const map = new Map<string, number>();
    stores.forEach((s) => {
      map.set(s.ownerId, (map.get(s.ownerId) ?? 0) + 1);
    });
    return map;
  }, [stores]);

  const storeById = useMemo(() => {
    const map = new Map<string, Store>();
    stores.forEach((s) => map.set(s.id, s));
    return map;
  }, [stores]);

  const buyersPerStore = useMemo(() => {
    const counts = new Map<string, number>();
    buyers.forEach((b) => {
      if (b.storeId) {
        counts.set(b.storeId, (counts.get(b.storeId) ?? 0) + 1);
      }
    });
    return stores
      .map((store) => ({
        store,
        count: counts.get(store.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [buyers, stores]);

  const merchantUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role !== Roles.Admin &&
          u.role !== Roles.Buyer &&
          Number(u.roleId) !== 1 &&
          Number(u.roleId) !== 3
      ),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return merchantUsers.filter((u) => {
      if (filter === 'pro' && u.plan !== 'pro') return false;
      if (filter === 'free' && u.plan !== 'starter') return false;
      if (filter === 'dues' && !isUserPlanUnpaidDue(u, transactions)) return false;
      if (filter === 'restricted' && u.status !== 'restricted') return false;
      if (
        q &&
        !(u.name ?? '').toLowerCase().includes(q) &&
        !(u.email ?? '').toLowerCase().includes(q) &&
        !(u.id ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [merchantUsers, transactions, search, filter]);

  const filteredBuyers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return buyers.filter((b) => {
      if (selectedBuyerStoreId !== 'all' && b.storeId !== selectedBuyerStoreId) {
        return false;
      }
      if (q) {
        const storeName = (b.storeId ? storeById.get(b.storeId)?.name : undefined) ?? b.storeName ?? '';
        const matches =
          (b.name ?? '').toLowerCase().includes(q) ||
          (b.email ?? '').toLowerCase().includes(q) ||
          storeName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [buyers, selectedBuyerStoreId, search, storeById]);

  const usersPagination = usePagination(
    filteredUsers,
    DEFAULT_TABLE_PAGE_SIZE,
    `${segment}::${filter}::${search}`
  );
  const buyersPagination = usePagination(
    filteredBuyers,
    DEFAULT_TABLE_PAGE_SIZE,
    `${segment}::${selectedBuyerStoreId}::${search}`
  );

  const openRestrictModal = (user: User) => {
    if (user.status === 'restricted') {
      onToggleRestrictUser(user);
      return;
    }
    setRestrictReason('Account flagged for admin compliance verification.');
    setRestrictModalUser(user);
  };

  const confirmRestrict = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restrictModalUser) return;
    onToggleRestrictUser(restrictModalUser, restrictReason.trim() || 'Restricted by admin.');
    setRestrictModalUser(null);
    setRestrictReason('');
  };

  const handleSwitchSegment = (next: UserSegment) => {
    setSegment(next);
    setSearch('');
    if (next === 'merchants' && onClearBuyerStoreFilter) {
      onClearBuyerStoreFilter();
    }
  };

  return (
    <div className="space-y-4">
      {/* User Class Switcher: Merchants vs Store Buyers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div
          role="tablist"
          aria-label="User account types"
          className="inline-flex items-center p-1 bg-white border border-[#e2e8f0] rounded-xl self-start overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={segment === 'merchants'}
            onClick={() => handleSwitchSegment('merchants')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              segment === 'merchants'
                ? 'bg-[#0f172a] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Merchants ({merchantUsers.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={segment === 'buyers'}
            onClick={() => handleSwitchSegment('buyers')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              segment === 'buyers'
                ? 'bg-[#0f172a] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Store Buyers ({buyers.length})</span>
          </button>
        </div>

        {segment === 'buyers' && (
          <p className="text-[11px] font-medium text-slate-500">
            Read-only storefront customer accounts · No restrict or delete actions
          </p>
        )}
      </div>

      {segment === 'merchants' ? (
        <>
          {/* Merchant Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Search merchant users"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search merchant name or email..."
                className="w-full min-h-[42px] pl-10 pr-3.5 py-2 text-sm bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div
              role="tablist"
              aria-label="Filter users"
              className="inline-flex items-center p-1 bg-white border border-[#e2e8f0] rounded-xl self-start sm:self-auto overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {(
                [
                  { id: 'all', label: `All (${merchantUsers.length})` },
                  { id: 'pro', label: `Pro (${merchantUsers.filter((u) => u.plan === 'pro').length})` },
                  { id: 'free', label: `Free (${merchantUsers.filter((u) => u.plan === 'starter').length})` },
                  {
                    id: 'dues',
                    label: `Dues (${merchantUsers.filter((u) => isUserPlanUnpaidDue(u, transactions)).length})`,
                  },
                  {
                    id: 'restricted',
                    label: `Restricted (${merchantUsers.filter((u) => u.status === 'restricted').length})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    filter === tab.id
                      ? 'bg-[#0f172a] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

      {/* Empty State */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">No merchant users match your filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Merchant</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Stores</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersPagination.paginatedItems.map((user) => {
                    const ownedStores = storeCountByUser.get(user.id) ?? 0;
                    const limits = getPlanLimits(user.plan);
                    const isRestricted = user.status === 'restricted';
                    const isUnpaidDue = isUserPlanUnpaidDue(user, transactions);
                    const isPastDuePending = !isUnpaidDue && isUserPlanPastDue(user);
                    const isSelf = user.id === currentUserId;

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/60">
                        <td className="py-3.5 px-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">
                              {user.name}
                              {isSelf && (
                                <span className="ml-2 text-[11px] font-medium text-slate-400">
                                  · Active Session
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                            {isRestricted && user.restrictedReason && (
                              <p className="text-[11px] text-rose-600 mt-0.5">{user.restrictedReason}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              user.plan === 'pro'
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {limits.label}
                          </span>
                          <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                            {user.plan === 'pro'
                              ? `₱${proPrice}/mo${user.planPeriodEndsAt ? ` · Due ${formatDate(user.planPeriodEndsAt)}` : ''}`
                              : '₱0/mo'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onViewUserStores(user.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold tabular-nums text-slate-700 hover:text-slate-900 underline decoration-slate-300 underline-offset-2 cursor-pointer"
                          >
                            <StoreIcon className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {ownedStores}/{limits.maxStores}
                            </span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isRestricted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/70">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Restricted
                            </span>
                          ) : isUnpaidDue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              Due (Unpaid)
                            </span>
                          ) : isPastDuePending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              Pending Approval
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateUserPlan(user.id, user.plan === 'pro' ? 'starter' : 'pro')
                              }
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                            >
                              {user.plan === 'pro' ? 'Set Free' : 'Grant Pro'}
                            </button>

                            <button
                              type="button"
                              onClick={() => openRestrictModal(user)}
                              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                isRestricted
                                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                  : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                              }`}
                            >
                              {isRestricted ? 'Unrestrict' : 'Restrict'}
                            </button>

                            <button
                              type="button"
                              aria-label={`Delete ${user.name}`}
                              onClick={() => setDeleteModalUser(user)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={usersPagination.page}
              totalPages={usersPagination.totalPages}
              totalItems={usersPagination.totalItems}
              startItem={usersPagination.startItem}
              endItem={usersPagination.endItem}
              canPrev={usersPagination.canPrev}
              canNext={usersPagination.canNext}
              onPrev={usersPagination.goPrev}
              onNext={usersPagination.goNext}
              itemLabel="merchants"
            />
          </div>

          {/* Mobile & Tablet Cards */}
          <div className="lg:hidden space-y-2.5">
            {usersPagination.paginatedItems.map((user) => {
              const ownedStores = storeCountByUser.get(user.id) ?? 0;
              const limits = getPlanLimits(user.plan);
              const isRestricted = user.status === 'restricted';
              const isUnpaidDue = isUserPlanUnpaidDue(user, transactions);
              const isPastDuePending = !isUnpaidDue && isUserPlanPastDue(user);

              return (
                <div
                  key={user.id}
                  className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 space-y-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                    {isRestricted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 shrink-0">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Restricted
                      </span>
                    ) : isUnpaidDue ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        Due (Unpaid)
                      </span>
                    ) : isPastDuePending ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        Pending Approval
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    )}
                  </div>

                  {isRestricted && user.restrictedReason && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg px-3 py-2">
                      {user.restrictedReason}
                    </p>
                  )}

                  <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600 tabular-nums">
                    <span className="font-semibold text-slate-900">
                      {limits.label} ({user.plan === 'pro' ? `₱${proPrice}/mo` : '₱0'})
                    </span>
                    {user.plan === 'pro' && user.planPeriodEndsAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Due {formatDate(user.planPeriodEndsAt)}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => onViewUserStores(user.id)}
                      className="underline font-medium text-slate-700 cursor-pointer"
                    >
                      {ownedStores}/{limits.maxStores} stores
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateUserPlan(user.id, user.plan === 'pro' ? 'starter' : 'pro')
                      }
                      className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>{user.plan === 'pro' ? 'Set Free' : 'Grant Pro'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openRestrictModal(user)}
                      className={`min-h-[38px] px-2.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1 cursor-pointer ${
                        isRestricted
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : 'text-amber-700 bg-amber-50 border border-amber-200'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>{isRestricted ? 'Unrestrict' : 'Restrict'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteModalUser(user)}
                      className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
            <TablePagination
              page={usersPagination.page}
              totalPages={usersPagination.totalPages}
              totalItems={usersPagination.totalItems}
              startItem={usersPagination.startItem}
              endItem={usersPagination.endItem}
              canPrev={usersPagination.canPrev}
              canNext={usersPagination.canNext}
              onPrev={usersPagination.goPrev}
              onNext={usersPagination.goNext}
              variant="card"
              itemLabel="merchants"
            />
          </div>
        </>
      )}
        </>
      ) : (
        <div className="space-y-4">
          {/* Buyers per Store Breakdown */}
          <section className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#0f172a]">Buyer Users per Store</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tap a store to filter its registered template customers
                </p>
              </div>
              {selectedBuyerStoreId !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBuyerStoreId('all');
                    onClearBuyerStoreFilter?.();
                  }}
                  className="text-xs font-semibold text-[#1d4ed8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Show All ({buyers.length})
                </button>
              )}
            </div>

            {buyersPerStore.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No stores available.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {buyersPerStore.map(({ store, count }) => {
                  const isSelected = selectedBuyerStoreId === store.id;
                  return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedBuyerStoreId('all');
                          onClearBuyerStoreFilter?.();
                        } else {
                          setSelectedBuyerStoreId(store.id);
                        }
                      }}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#0f172a] border-[#0f172a] text-white shadow-xs'
                          : 'bg-slate-50/70 border-[#e2e8f0] hover:border-slate-300 text-slate-900'
                      }`}
                    >
                      <p className="text-xs font-semibold truncate">{store.name}</p>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <span className="font-mono font-bold text-lg tabular-nums">{count}</span>
                        <span
                          className={`text-[11px] ${
                            isSelected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {count === 1 ? 'buyer' : 'buyers'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Store Buyers Search */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search store buyers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search buyer name, email, or store..."
              className="w-full min-h-[42px] pl-10 pr-3.5 py-2 text-sm bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {filteredBuyers.length === 0 ? (
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                No registered buyers found for this filter.
              </p>
              {(selectedBuyerStoreId !== 'all' || search.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedBuyerStoreId('all');
                    onClearBuyerStoreFilter?.();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Read-Only Buyer Table */}
              <div className="hidden lg:block bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Full Name</th>
                        <th className="py-3 px-4">Email Address</th>
                        <th className="py-3 px-4">Storefront</th>
                        <th className="py-3 px-4">Joined</th>
                        <th className="py-3 px-4 text-right">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {buyersPagination.paginatedItems.map((buyer) => {
                        const storeName =
                          (buyer.storeId ? storeById.get(buyer.storeId)?.name : undefined) ??
                          buyer.storeName ??
                          'Storefront';
                        return (
                          <tr key={buyer.id} className="hover:bg-slate-50/60">
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              {buyer.name}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                              {buyer.email}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200/80 rounded-lg">
                                <StoreIcon className="w-3.5 h-3.5 text-slate-500" />
                                <span>{storeName}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                              {formatDate(buyer.createdAt)}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                                <UserCheck className="w-3 h-3" />
                                <span>{buyer.role ?? Roles.Buyer}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={buyersPagination.page}
                  totalPages={buyersPagination.totalPages}
                  totalItems={buyersPagination.totalItems}
                  startItem={buyersPagination.startItem}
                  endItem={buyersPagination.endItem}
                  canPrev={buyersPagination.canPrev}
                  canNext={buyersPagination.canNext}
                  onPrev={buyersPagination.goPrev}
                  onNext={buyersPagination.goNext}
                  itemLabel="buyers"
                />
              </div>

              {/* Mobile Read-Only Buyer Cards */}
              <div className="lg:hidden space-y-2.5">
                {buyersPagination.paginatedItems.map((buyer) => {
                  const storeName =
                    (buyer.storeId ? storeById.get(buyer.storeId)?.name : undefined) ??
                    buyer.storeName ??
                    'Storefront';
                  return (
                    <div
                      key={buyer.id}
                      className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 space-y-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{buyer.name}</p>
                          <p className="text-xs text-slate-500 truncate">{buyer.email}</p>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                          <UserCheck className="w-3 h-3" />
                          {buyer.role ?? Roles.Buyer}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-800 truncate">
                          <StoreIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{storeName}</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                          Joined {formatDate(buyer.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <TablePagination
                  page={buyersPagination.page}
                  totalPages={buyersPagination.totalPages}
                  totalItems={buyersPagination.totalItems}
                  startItem={buyersPagination.startItem}
                  endItem={buyersPagination.endItem}
                  canPrev={buyersPagination.canPrev}
                  canNext={buyersPagination.canNext}
                  onPrev={buyersPagination.goPrev}
                  onNext={buyersPagination.goNext}
                  variant="card"
                  itemLabel="buyers"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Restrict User Modal */}
      <AdminModalWrapper
        isOpen={Boolean(restrictModalUser)}
        onClose={() => setRestrictModalUser(null)}
      >
        {restrictModalUser && (
          <form
            onSubmit={confirmRestrict}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden my-auto"
          >
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Restrict {restrictModalUser.name}?
                </h2>
                <p className="text-xs text-slate-500">{restrictModalUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setRestrictModalUser(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Restricting this user blocks them from creating new stores and flags their account
                across the platform until lifted by an admin.
              </p>
              <div className="space-y-1">
                <label htmlFor="admin-user-restrict-reason" className="block text-xs font-semibold text-slate-700">
                  Restriction Reason
                </label>
                <textarea
                  id="admin-user-restrict-reason"
                  rows={3}
                  value={restrictReason}
                  onChange={(e) => setRestrictReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200/80 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRestrictModalUser(null)}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer"
              >
                Confirm Restrict
              </button>
            </div>
          </form>
        )}
      </AdminModalWrapper>

      {/* Delete User Confirmation Modal */}
      <AdminModalWrapper
        isOpen={Boolean(deleteModalUser)}
        onClose={() => setDeleteModalUser(null)}
      >
        {deleteModalUser && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden my-auto"
          >
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Delete Merchant Account?</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {deleteModalUser.name} ({deleteModalUser.email})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteModalUser(null)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-900 leading-relaxed">
                This permanently deletes <strong>{deleteModalUser.name}</strong> along with all{' '}
                <strong>{storeCountByUser.get(deleteModalUser.id) ?? 0}</strong> of their stores,
                products, and store orders.
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200/80 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteUser(deleteModalUser.id);
                  setDeleteModalUser(null);
                }}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        )}
      </AdminModalWrapper>
    </div>
  );
}
