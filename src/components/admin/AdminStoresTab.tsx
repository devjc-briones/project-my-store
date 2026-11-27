import { useMemo, useState } from 'react';
import { AdminModalWrapper } from './AdminModalWrapper';
import {
  CheckCircle2,
  Eye,
  FileEdit,
  Globe,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { BuyerAccount, Product, Store, StoreStatus, User } from '../../types/schema';
import { INDUSTRY_TEMPLATES } from '../../data/templates';
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TablePagination,
  usePagination,
} from '../common/TablePagination';

type StoreFilter = 'all' | StoreStatus;

interface AdminStoresTabProps {
  stores: Store[];
  users: User[];
  buyers: BuyerAccount[];
  products: Product[];
  ownerFilterUserId: string | null;
  onClearOwnerFilter: () => void;
  onChangeStoreStatus: (store: Store, nextStatus: StoreStatus, reason?: string) => void;
  onDeleteStore: (storeId: string) => void;
  onOpenStorefront: (slug: string) => void;
  onManageStoreProducts: (storeId: string) => void;
  onViewStoreBuyers?: (storeId: string) => void;
}

export function AdminStoresTab({
  stores,
  users,
  buyers,
  products,
  ownerFilterUserId,
  onClearOwnerFilter,
  onChangeStoreStatus,
  onDeleteStore,
  onOpenStorefront,
  onManageStoreProducts,
  onViewStoreBuyers,
}: AdminStoresTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StoreFilter>('all');
  const [restrictModalStore, setRestrictModalStore] = useState<Store | null>(null);
  const [restrictReason, setRestrictReason] = useState('');
  const [deleteModalStore, setDeleteModalStore] = useState<Store | null>(null);

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const productCountByStore = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      map.set(p.storeId, (map.get(p.storeId) ?? 0) + 1);
    });
    return map;
  }, [products]);

  const buyerCountByStore = useMemo(() => {
    const map = new Map<string, number>();
    buyers.forEach((b) => {
      if (b.storeId) {
        map.set(b.storeId, (map.get(b.storeId) ?? 0) + 1);
      }
    });
    return map;
  }, [buyers]);

  const ownerFilterUser = ownerFilterUserId ? userById.get(ownerFilterUserId) : undefined;

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((s) => {
      if (ownerFilterUserId && s.ownerId !== ownerFilterUserId) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (q) {
        const owner = userById.get(s.ownerId);
        const matchesStore =
          (s.name ?? '').toLowerCase().includes(q) ||
          (s.slug ?? '').toLowerCase().includes(q) ||
          (s.domainUrl ?? '').toLowerCase().includes(q);
        const matchesOwner =
          (owner?.name ?? '').toLowerCase().includes(q) || (owner?.email ?? '').toLowerCase().includes(q);
        if (!matchesStore && !matchesOwner) return false;
      }
      return true;
    });
  }, [stores, ownerFilterUserId, statusFilter, search, userById]);

  const storesPagination = usePagination(
    filteredStores,
    DEFAULT_TABLE_PAGE_SIZE,
    `${statusFilter}::${search}::${ownerFilterUserId ?? ''}`
  );

  const handleOpenRestrict = (store: Store) => {
    if (store.status === 'restricted') {
      onChangeStoreStatus(store, 'draft');
      return;
    }
    setRestrictReason('Storefront restricted by platform admin pending compliance review.');
    setRestrictModalStore(store);
  };

  const handleConfirmRestrict = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restrictModalStore) return;
    onChangeStoreStatus(
      restrictModalStore,
      'restricted',
      restrictReason.trim() || 'Restricted by platform admin.'
    );
    setRestrictModalStore(null);
    setRestrictReason('');
  };

  return (
    <div className="space-y-5">
      {ownerFilterUser && (
        <div className="px-4 py-3 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
          <p className="text-slate-700">
            Showing stores owned by{' '}
            <strong className="text-slate-900">{ownerFilterUser.name}</strong> ({ownerFilterUser.email})
          </p>
          <button
            type="button"
            onClick={onClearOwnerFilter}
            className="font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer shrink-0"
          >
            Show All Stores
          </button>
        </div>
      )}

      {/* Search & Status Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Search stores"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search store name, slug, or owner..."
            className="w-full min-h-[42px] pl-10 pr-3.5 py-2 text-sm bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div
          role="tablist"
          aria-label="Filter stores by status"
          className="inline-flex items-center p-1 bg-white border border-[#e2e8f0] rounded-xl self-start sm:self-auto overflow-x-auto max-w-full shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {(
            [
              { id: 'all', label: `All (${stores.length})` },
              {
                id: 'published',
                label: `Published (${stores.filter((s) => s.status === 'published').length})`,
              },
              {
                id: 'draft',
                label: `Draft (${stores.filter((s) => s.status === 'draft').length})`,
              },
              {
                id: 'restricted',
                label: `Restricted (${stores.filter((s) => s.status === 'restricted').length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                statusFilter === tab.id
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
      {filteredStores.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">No stores match your current filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              onClearOwnerFilter();
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
                    <th className="py-3 px-4">Storefront</th>
                    <th className="py-3 px-4">Owner</th>
                    <th className="py-3 px-4">Template</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Buyers</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {storesPagination.paginatedItems.map((store) => {
                    const owner = userById.get(store.ownerId);
                    const templateName = INDUSTRY_TEMPLATES[store.templateId]?.name ?? store.templateId;
                    const itemCount = productCountByStore.get(store.id) ?? 0;
                    const buyerCount = buyerCountByStore.get(store.id) ?? 0;

                    return (
                      <tr key={store.id} className="hover:bg-slate-50/60">
                        <td className="py-3.5 px-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{store.name}</p>
                            <p className="text-xs font-mono text-slate-500 flex items-center gap-1">
                              <Globe className="w-3 h-3 shrink-0" />
                              <span>{store.domainUrl}</span>
                            </p>
                            {store.status === 'restricted' && store.restrictedReason && (
                              <p className="text-[11px] text-rose-600 mt-0.5">{store.restrictedReason}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-xs font-semibold text-slate-800">
                            {owner?.name ?? 'Unknown Owner'}
                          </p>
                          <p className="text-[11px] text-slate-500">{owner?.email ?? store.ownerId}</p>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {templateName}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono font-semibold tabular-nums text-slate-700 whitespace-nowrap">
                          {itemCount}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {onViewStoreBuyers ? (
                            <button
                              type="button"
                              onClick={() => onViewStoreBuyers(store.id)}
                              title={`View ${buyerCount} buyers in ${store.name}`}
                              className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold tabular-nums text-slate-700 hover:text-slate-900 underline decoration-slate-300 underline-offset-2 cursor-pointer"
                            >
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>{buyerCount}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold tabular-nums text-slate-700">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>{buyerCount}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {store.status === 'published' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Published
                            </span>
                          ) : store.status === 'restricted' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/70">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Restricted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenStorefront(store.slug)}
                              title="Preview Storefront"
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onManageStoreProducts(store.id)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                              Manage
                            </button>

                            {store.status === 'published' ? (
                              <button
                                type="button"
                                onClick={() => onChangeStoreStatus(store, 'draft')}
                                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                              >
                                Unpublish
                              </button>
                            ) : store.status === 'draft' ? (
                              <button
                                type="button"
                                onClick={() => onChangeStoreStatus(store, 'published')}
                                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                              >
                                Publish
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleOpenRestrict(store)}
                              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                                store.status === 'restricted'
                                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                  : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                              }`}
                            >
                              {store.status === 'restricted' ? 'Unrestrict' : 'Restrict'}
                            </button>

                            <button
                              type="button"
                              aria-label={`Delete ${store.name}`}
                              onClick={() => setDeleteModalStore(store)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg cursor-pointer"
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
              page={storesPagination.page}
              totalPages={storesPagination.totalPages}
              totalItems={storesPagination.totalItems}
              startItem={storesPagination.startItem}
              endItem={storesPagination.endItem}
              canPrev={storesPagination.canPrev}
              canNext={storesPagination.canNext}
              onPrev={storesPagination.goPrev}
              onNext={storesPagination.goNext}
              itemLabel="stores"
            />
          </div>

          {/* Mobile & Tablet Cards */}
          <div className="lg:hidden space-y-2.5">
            {storesPagination.paginatedItems.map((store) => {
              const owner = userById.get(store.ownerId);
              const templateName = INDUSTRY_TEMPLATES[store.templateId]?.name ?? store.templateId;
              const itemCount = productCountByStore.get(store.id) ?? 0;
              const buyerCount = buyerCountByStore.get(store.id) ?? 0;

              return (
                <div
                  key={store.id}
                  className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 space-y-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{store.name}</p>
                      <p className="text-xs font-mono text-slate-500 truncate">{store.domainUrl}</p>
                    </div>
                    {store.status === 'published' ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Published
                      </span>
                    ) : store.status === 'restricted' ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Restricted
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Draft
                      </span>
                    )}
                  </div>

                  {store.status === 'restricted' && store.restrictedReason && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg px-3 py-2">
                      {store.restrictedReason}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-600 tabular-nums">
                    <span>
                      Owner: <span className="font-semibold text-slate-800">{owner?.name ?? 'Unknown'}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{templateName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{itemCount} items</span>
                    <span aria-hidden="true">·</span>
                    {onViewStoreBuyers ? (
                      <button
                        type="button"
                        onClick={() => onViewStoreBuyers(store.id)}
                        className="inline-flex items-center gap-1 font-semibold text-slate-800 hover:text-slate-950 underline decoration-slate-300 underline-offset-2 cursor-pointer"
                      >
                        <Users className="w-3 h-3 text-slate-500" />
                        <span>
                          {buyerCount} {buyerCount === 1 ? 'buyer' : 'buyers'}
                        </span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        <Users className="w-3 h-3 text-slate-500" />
                        <span>
                          {buyerCount} {buyerCount === 1 ? 'buyer' : 'buyers'}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenStorefront(store.slug)}
                      className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      View Shop
                    </button>

                    {store.status === 'published' ? (
                      <button
                        type="button"
                        onClick={() => onChangeStoreStatus(store, 'draft')}
                        className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Unpublish
                      </button>
                    ) : store.status === 'draft' ? (
                      <button
                        type="button"
                        onClick={() => onChangeStoreStatus(store, 'published')}
                        className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer"
                      >
                        Publish
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onManageStoreProducts(store.id)}
                        className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        Inspect
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenRestrict(store)}
                      className={`min-h-[38px] px-2.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                        store.status === 'restricted'
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : 'text-amber-700 bg-amber-50 border border-amber-200'
                      }`}
                    >
                      {store.status === 'restricted' ? 'Unrestrict' : 'Restrict'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteModalStore(store)}
                      className="min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            <TablePagination
              page={storesPagination.page}
              totalPages={storesPagination.totalPages}
              totalItems={storesPagination.totalItems}
              startItem={storesPagination.startItem}
              endItem={storesPagination.endItem}
              canPrev={storesPagination.canPrev}
              canNext={storesPagination.canNext}
              onPrev={storesPagination.goPrev}
              onNext={storesPagination.goNext}
              variant="card"
              itemLabel="stores"
            />
          </div>
        </>
      )}

      {/* Restrict Store Modal */}
      <AdminModalWrapper
        isOpen={Boolean(restrictModalStore)}
        onClose={() => setRestrictModalStore(null)}
      >
        {restrictModalStore && (
          <form
            onSubmit={handleConfirmRestrict}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden my-auto"
          >
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Restrict {restrictModalStore.name}?
                </h2>
                <p className="text-xs font-mono text-slate-500">{restrictModalStore.domainUrl}</p>
              </div>
              <button
                type="button"
                onClick={() => setRestrictModalStore(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Restricting this store immediately blocks public visitors from accessing its
                storefront and prevents the merchant from publishing it until lifted.
              </p>
              <div className="space-y-1">
                <label htmlFor="admin-store-restrict-reason" className="block text-xs font-semibold text-slate-700">
                  Restriction Reason
                </label>
                <textarea
                  id="admin-store-restrict-reason"
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
                onClick={() => setRestrictModalStore(null)}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer"
              >
                Restrict Store
              </button>
            </div>
          </form>
        )}
      </AdminModalWrapper>

      {/* Delete Store Confirmation Modal */}
      <AdminModalWrapper
        isOpen={Boolean(deleteModalStore)}
        onClose={() => setDeleteModalStore(null)}
      >
        {deleteModalStore && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden my-auto"
          >
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Delete Store Permanently?</h2>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{deleteModalStore.domainUrl}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteModalStore(null)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-900 leading-relaxed">
                Warning: <strong>{deleteModalStore.name}</strong> and all{' '}
                <strong>{productCountByStore.get(deleteModalStore.id) ?? 0}</strong> catalog items,
                payment settings, and orders inside it will be permanently deleted.
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200/80 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalStore(null)}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteStore(deleteModalStore.id);
                  setDeleteModalStore(null);
                }}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                Delete Store
              </button>
            </div>
          </div>
        )}
      </AdminModalWrapper>
    </div>
  );
}
