import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  ShieldAlert,
  ShoppingBag,
  Store as StoreIcon,
  Users,
} from 'lucide-react';
import { Store, SubscriptionTransaction, User } from '../../types/schema';
import { formatCurrency } from '../../utils/pricing';
import { DEFAULT_PRO_MONTHLY_PRICE } from '../../data/plans';

export type AdminTabId =
  | 'overview'
  | 'users'
  | 'stores'
  | 'revenue'
  | 'payment-settings'
  | 'orders';

interface AdminOverviewTabProps {
  users: User[];
  buyersCount: number;
  stores: Store[];
  productsCount: number;
  transactions: SubscriptionTransaction[];
  ordersCount: number;
  ordersGmv: number;
  proPrice?: number;
  onNavigateTab: (tab: AdminTabId) => void;
  onQuickUnrestrictUser: (userId: string) => void;
  onQuickUnrestrictStore: (storeId: string) => void;
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AdminOverviewTab({
  users,
  buyersCount,
  stores,
  productsCount,
  transactions,
  ordersCount,
  ordersGmv,
  proPrice = DEFAULT_PRO_MONTHLY_PRICE,
  onNavigateTab,
  onQuickUnrestrictUser,
  onQuickUnrestrictStore,
}: AdminOverviewTabProps) {
  const proUsers = users.filter((u) => u.plan === 'pro');
  const activeProUsers = proUsers.filter((u) => u.status !== 'restricted');
  const freeUsers = users.filter((u) => u.plan === 'starter');
  const restrictedUsers = users.filter((u) => u.status === 'restricted');

  const publishedStores = stores.filter((s) => s.status === 'published');
  const draftStores = stores.filter((s) => s.status === 'draft');
  const restrictedStores = stores.filter((s) => s.status === 'restricted');

  const pendingTransactions = transactions.filter((t) => t.status === 'pending');
  const paidTransactions = transactions.filter((t) => t.status === 'paid');
  const refundedTransactions = transactions.filter((t) => t.status === 'refunded');
  const totalPlanRevenue = paidTransactions.reduce((sum, t) => sum + t.amount, 0);
  const currentMrr = activeProUsers.length * proPrice;
  const proSharePercent = users.length > 0 ? Math.round((proUsers.length / users.length) * 100) : 0;

  const userById = new Map(users.map((u) => [u.id, u]));

  const paymentMethodBreakdown = paidTransactions.reduce<
    Record<string, { count: number; total: number }>
  >((acc, tx) => {
    const key = tx.paymentMethod || 'Other';
    const prev = acc[key] ?? { count: 0, total: 0 };
    acc[key] = { count: prev.count + 1, total: prev.total + tx.amount };
    return acc;
  }, {});

  const methodEntries = Object.entries(paymentMethodBreakdown).sort(
    (a, b) => b[1].total - a[1].total
  );
  const recentTransactions = transactions.slice(0, 5);
  const previewStores = [...restrictedStores, ...publishedStores, ...draftStores].slice(0, 4);

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Compact 2-Column Mobile / 4-Column Desktop KPI Grid */}
      <section
        aria-label="Platform metrics summary"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5"
      >
        <article className="bg-white rounded-2xl border border-[#e2e8f0] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-2.5 hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between gap-1.5">
            <h2 className="text-[12px] sm:text-[13px] font-medium text-slate-600 leading-snug">
              Plan Revenue Collected
            </h2>
            <span className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-xl sm:text-2xl tracking-tight text-[#0f172a] tabular-nums">
              {formatCurrency(totalPlanRevenue, 'PHP')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight mt-1 tabular-nums">
              MRR {formatCurrency(currentMrr, 'PHP')}/mo · {paidTransactions.length} paid ·{' '}
              {pendingTransactions.length > 0
                ? `${pendingTransactions.length} pending`
                : `${refundedTransactions.length} refunded`}
            </p>
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-[#e2e8f0] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-2.5 hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between gap-1.5">
            <h2 className="text-[12px] sm:text-[13px] font-medium text-slate-600 leading-snug">
              Platform Users
            </h2>
            <span className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-xl sm:text-2xl tracking-tight text-[#0f172a] tabular-nums">
              {users.length}{' '}
              <span className="text-xs font-sans font-medium text-slate-400">
                + {buyersCount} buyers
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight mt-1 tabular-nums">
              {proUsers.length} Pro · {freeUsers.length} Free · {restrictedUsers.length} Restricted
            </p>
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-[#e2e8f0] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-2.5 hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between gap-1.5">
            <h2 className="text-[12px] sm:text-[13px] font-medium text-slate-600 leading-snug">
              Managed Stores
            </h2>
            <span className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400">
              <StoreIcon className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-xl sm:text-2xl tracking-tight text-[#0f172a] tabular-nums">
              {stores.length}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight mt-1 tabular-nums">
              {publishedStores.length} Published · {draftStores.length} Draft ·{' '}
              {restrictedStores.length} Restricted
            </p>
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-[#e2e8f0] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-2.5 hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between gap-1.5">
            <h2 className="text-[12px] sm:text-[13px] font-medium text-slate-600 leading-snug">
              Catalog &amp; Live Orders
            </h2>
            <span className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-400">
              <ShoppingBag className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="font-mono font-bold text-xl sm:text-2xl tracking-tight text-[#0f172a] tabular-nums">
              {formatCurrency(ordersGmv, 'PHP')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight mt-1 tabular-nums">
              {ordersCount} live orders · {productsCount} catalog items
            </p>
          </div>
        </article>
      </section>

      {/* Moderation & Store Status Quick Panel */}
      <section className="bg-white rounded-2xl border border-[#e2e8f0] p-3.5 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a]">
              Moderation &amp; Store Status
            </h3>
            <p className="text-[11px] text-slate-500">
              Quick overview across active and flagged storefronts
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('stores')}
            className="text-xs font-semibold text-[#1d4ed8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            View all &rarr;
          </button>
        </div>

        {previewStores.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No storefronts created yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {previewStores.map((store) => {
              const owner = userById.get(store.ownerId);
              const ownerPlanLabel = owner?.plan === 'pro' ? 'Pro Plan' : 'Free Plan';
              return (
                <div
                  key={store.id}
                  className="py-2.5 first:pt-1 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{store.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Owner: {owner?.email ?? store.ownerId} · {ownerPlanLabel}
                    </p>
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
              );
            })}
          </div>
        )}
      </section>

      {/* Main Split: Plan Revenue Breakdown + Flagged Restrictions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        <section className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#0f172a]">Plan Revenue &amp; Tier Mix</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Income from Pro subscriptions ({formatCurrency(proPrice, 'PHP')}/mo)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('revenue')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1d4ed8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Full Ledger</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Pro Plan Conversion</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900">
                  {proUsers.length} of {users.length} users ({proSharePercent}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0f172a] transition-all duration-300"
                  style={{ width: `${proSharePercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                <span>
                  Pro Tier ({proUsers.length} · {formatCurrency(currentMrr, 'PHP')}/mo est.)
                </span>
                <span>Free Tier ({freeUsers.length} · ₱0/mo)</span>
              </div>
            </div>

            <div className="pt-3.5 border-t border-slate-100 space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-700">Revenue by Payment Channel</h3>
              {methodEntries.length === 0 ? (
                <p className="text-xs text-slate-500 py-1">
                  No paid subscription transactions recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {methodEntries.map(([method, stats]) => {
                    const share =
                      totalPlanRevenue > 0
                        ? Math.round((stats.total / totalPlanRevenue) * 100)
                        : 0;
                    return (
                      <div key={method} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">
                            {method}{' '}
                            <span className="text-slate-400 tabular-nums">· {stats.count} tx</span>
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-slate-900">
                            {formatCurrency(stats.total, 'PHP')} ({share}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600" style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3.5 border-t border-slate-100 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700">Recent Plan Payments</h3>
              {recentTransactions.length === 0 ? (
                <p className="text-xs text-slate-500">No subscription activity yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-medium">
                        <th className="py-2 pr-3">Merchant</th>
                        <th className="py-2 px-2">Channel</th>
                        <th className="py-2 px-2">Date</th>
                        <th className="py-2 pl-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/70">
                          <td className="py-2 pr-3">
                            <p className="font-semibold text-slate-900 truncate max-w-[140px]">
                              {tx.userName}
                            </p>
                            <p className="text-[11px] font-mono text-slate-500">{tx.referenceId}</p>
                          </td>
                          <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                            {tx.paymentMethod}
                          </td>
                          <td className="py-2 px-2 text-slate-500 tabular-nums whitespace-nowrap">
                            {formatShortDate(tx.createdAt)}
                          </td>
                          <td className="py-2 pl-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                            <span
                              className={
                                tx.status === 'refunded'
                                  ? 'text-rose-600 line-through'
                                  : tx.status === 'pending'
                                    ? 'text-amber-600'
                                    : 'text-emerald-700'
                              }
                            >
                              {formatCurrency(tx.amount, 'PHP')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#0f172a]">Restricted Queue</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Flagged accounts and storefronts
              </p>
            </div>
            <span className="text-xs font-mono font-semibold tabular-nums text-slate-700">
              {restrictedUsers.length + restrictedStores.length} flagged
            </span>
          </div>

          <div className="p-4 space-y-4">
            {restrictedUsers.length === 0 && restrictedStores.length === 0 ? (
              <div className="py-5 text-center space-y-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-900">All clear</p>
                <p className="text-xs text-slate-500">
                  No users or stores are currently restricted.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {restrictedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="py-2.5 first:pt-0 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>User · {u.name}</span>
                      </p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      {u.restrictedReason && (
                        <p className="text-[11px] text-slate-600">{u.restrictedReason}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickUnrestrictUser(u.id)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Unrestrict
                    </button>
                  </div>
                ))}

                {restrictedStores.map((s) => (
                  <div
                    key={s.id}
                    className="py-2.5 last:pb-0 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Store · {s.name}</span>
                      </p>
                      <p className="text-xs font-mono text-slate-500 truncate">{s.domainUrl}</p>
                      {s.restrictedReason && (
                        <p className="text-[11px] text-slate-600">{s.restrictedReason}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickUnrestrictStore(s.id)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Restore Draft
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onNavigateTab('users')}
                className="min-h-[38px] px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Manage Users
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('stores')}
                className="min-h-[38px] px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Manage Stores
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
