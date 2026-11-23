import { useMemo, useState } from 'react';
import { AdminModalWrapper } from './AdminModalWrapper';
import {
  CheckCircle2,
  Clock,
  Eye,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { Store, SubscriptionTransaction, User } from '../../types/schema';
import { formatCurrency } from '../../utils/pricing';
import { PLATFORM_PLANS } from '../../data/plans';
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TablePagination,
  usePagination,
} from '../common/TablePagination';

type TxFilter = 'all' | 'pending' | 'dues' | 'paid' | 'refunded';

interface AdminRevenueTabProps {
  users: User[];
  stores: Store[];
  transactions: SubscriptionTransaction[];
  paymentMethodLabels?: string[];
  onToggleTxStatus: (txId: string, nextStatus: SubscriptionTransaction['status']) => void;
  onRecordManualProPayment: (
    user: User,
    paymentMethod: string,
    status: SubscriptionTransaction['status']
  ) => void;
}

const PRO_PRICE = PLATFORM_PLANS.find((p) => p.id === 'pro')?.monthlyPrice ?? 369;

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AdminRevenueTab({
  users,
  stores,
  transactions,
  paymentMethodLabels,
  onToggleTxStatus,
  onRecordManualProPayment,
}: AdminRevenueTabProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TxFilter>('all');
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id ?? '');
  const [paymentChannel, setPaymentChannel] = useState(
    paymentMethodLabels?.[0] ?? 'GCash'
  );
  const [manualTxStatus, setManualTxStatus] = useState<'pending' | 'paid'>('paid');
  const [proofPreviewTx, setProofPreviewTx] = useState<SubscriptionTransaction | null>(null);

  const stats = useMemo(() => {
    const pending = transactions.filter((t) => t.status === 'pending');
    const paid = transactions.filter((t) => t.status === 'paid');
    const refunded = transactions.filter((t) => t.status === 'refunded');

    const nowMs = Date.now();
    const duesUsers = users.filter((u) => {
      if (u.plan === 'starter' || u.cancelAtPeriodEnd) return false;
      if (!u.planPeriodEndsAt) return false;
      const dueMs = new Date(u.planPeriodEndsAt).getTime();
      return !Number.isNaN(dueMs) && nowMs >= dueMs;
    });

    const pendingTotal = pending.reduce((sum, t) => sum + t.amount, 0);
    const paidTotal = paid.reduce((sum, t) => sum + t.amount, 0);
    const refundedTotal = refunded.reduce((sum, t) => sum + t.amount, 0);
    const activeProCount = users.filter((u) => u.plan === 'pro' && u.status !== 'restricted').length;
    const mrr = activeProCount * PRO_PRICE;
    return {
      pendingCount: pending.length,
      duesCount: duesUsers.length,
      paidCount: paid.length,
      refundedCount: refunded.length,
      pendingTotal,
      duesTotal: duesUsers.length * PRO_PRICE,
      paidTotal,
      refundedTotal,
      activeProCount,
      mrr,
      duesUsers,
    };
  }, [transactions, users]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();

    const buildDueRow = (u: User): SubscriptionTransaction => {
      const pendingTx = transactions.find(
        (t) =>
          t.status === 'pending' &&
          (t.userId === u.id || t.userEmail.toLowerCase() === u.email.toLowerCase())
      );
      if (pendingTx) {
        return pendingTx;
      }
      return {
        id: `due_${u.id}`,
        referenceId: `DUE-${u.id.slice(-6).toUpperCase()}`,
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        planId: 'pro',
        amount: PRO_PRICE,
        paymentMethod: 'Unpaid / Overdue',
        status: 'dues',
        createdAt: u.planPeriodEndsAt ?? new Date().toISOString(),
      };
    };

    const matchesQuery = (tx: SubscriptionTransaction) => {
      if (!q) return true;
      return (
        tx.userName.toLowerCase().includes(q) ||
        tx.userEmail.toLowerCase().includes(q) ||
        tx.referenceId.toLowerCase().includes(q) ||
        tx.paymentMethod.toLowerCase().includes(q)
      );
    };

    if (filter === 'dues') {
      return stats.duesUsers
        .map(buildDueRow)
        .filter(matchesQuery)
        .sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (b.status === 'pending' && a.status !== 'pending') return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }

    const txList = transactions.filter((tx) => {
      if (filter !== 'all' && tx.status !== filter) return false;
      return matchesQuery(tx);
    });

    const extraUnpaidDues =
      filter === 'all'
        ? stats.duesUsers
            .map(buildDueRow)
            .filter((row) => row.status === 'dues' && matchesQuery(row))
        : [];

    return [...txList, ...extraUnpaidDues].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      if (a.status === 'dues' && b.status !== 'dues') return -1;
      if (b.status === 'dues' && a.status !== 'dues') return 1;
      const timeA = new Date(a.approvedAt ?? a.createdAt).getTime();
      const timeB = new Date(b.approvedAt ?? b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [transactions, filter, search, stats.duesUsers]);

  const txPagination = usePagination(
    filteredTransactions,
    DEFAULT_TABLE_PAGE_SIZE,
    `${filter}::${search}`
  );

  const handleConfirmManualPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const target = users.find((u) => u.id === selectedUserId) ?? users[0];
    if (!target) return;
    onRecordManualProPayment(target, paymentChannel, manualTxStatus);
    setRecordModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Compact 2-Column Mobile / 4-Column Desktop KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-1">
          <p className="text-[12px] font-medium text-slate-600">Collected Plan Revenue</p>
          <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#0f172a]">
            {formatCurrency(stats.paidTotal, 'PHP')}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {stats.paidCount} paid transactions
          </p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-1">
          <p className="text-[12px] font-medium text-slate-600">Pending Approvals</p>
          <p
            className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              stats.pendingCount > 0 ? 'text-amber-700' : 'text-[#0f172a]'
            }`}
          >
            {stats.pendingCount}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {formatCurrency(stats.pendingTotal, 'PHP')} awaiting review
          </p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-1">
          <p className="text-[12px] font-medium text-slate-600">Projected Monthly MRR</p>
          <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#0f172a]">
            {formatCurrency(stats.mrr, 'PHP')}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {stats.activeProCount} Pro × {formatCurrency(PRO_PRICE, 'PHP')}
          </p>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-1">
          <p className="text-[12px] font-medium text-slate-600">Refunded Amount</p>
          <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-700">
            {formatCurrency(stats.refundedTotal, 'PHP')}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {stats.refundedCount} refunded entries
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search transactions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, merchant, method..."
              className="w-full min-h-[42px] pl-10 pr-3.5 py-2 text-sm bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter transactions"
            className="inline-flex items-center p-1 bg-white border border-[#e2e8f0] rounded-xl self-start sm:self-auto"
          >
            {(['all', 'pending', 'dues', 'paid', 'refunded'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={filter === tab}
                onClick={() => setFilter(tab)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                  filter === tab
                    ? 'bg-[#0f172a] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab === 'dues' ? 'Dues' : tab}</span>
                {tab === 'pending' && stats.pendingCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                      filter === tab
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {stats.pendingCount}
                  </span>
                )}
                {tab === 'dues' && stats.duesCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                      filter === tab
                        ? 'bg-rose-500 text-white'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {stats.duesCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={users.length === 0}
            onClick={() => {
              setSelectedUserId(users[0]?.id ?? '');
              setManualTxStatus('paid');
              setRecordModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-[#0f172a] hover:bg-slate-800 disabled:bg-slate-300 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Pro Payment</span>
          </button>
        </div>
      </div>

      {/* Ledger */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            {filter === 'dues'
              ? 'No merchants currently have unpaid overdue plans.'
              : 'No plan transactions match your filter.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Merchant</th>
                  <th className="py-3 px-4">Plan &amp; Channel</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txPagination.paginatedItems.map((tx) => (
                  <tr
                    key={tx.id}
                    className={
                      tx.status === 'pending'
                        ? 'bg-amber-50/35 hover:bg-amber-50/60'
                        : 'hover:bg-slate-50/60'
                    }
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {tx.referenceId}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 text-xs sm:text-sm">{tx.userName}</p>
                      <p className="text-[11px] text-slate-500">{tx.userEmail}</p>
                      {(tx.status === 'dues' ||
                        (filter === 'dues' && tx.status === 'pending')) && (
                        <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                          {
                            stores.filter(
                              (s) => s.ownerId === tx.userId && s.status === 'published'
                            ).length
                          }{' '}
                          active stores temporarily closed
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      Pro · {tx.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatDateTime(tx.approvedAt ?? tx.createdAt)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {tx.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                          <Clock className="w-3.5 h-3.5" />
                          Pending
                        </span>
                      ) : tx.status === 'dues' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
                          <Clock className="w-3.5 h-3.5" />
                          Dues (Overdue)
                        </span>
                      ) : tx.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                          <RotateCcw className="w-3.5 h-3.5" />
                          Refunded
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      {formatCurrency(tx.amount, 'PHP')}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {'proofUrl' in tx && tx.proofUrl && (
                          <button
                            type="button"
                            onClick={() => setProofPreviewTx(tx as SubscriptionTransaction)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        )}
                        {tx.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => onToggleTxStatus(tx.id, 'paid')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        ) : tx.status === 'dues' ? (
                          <span className="text-[11px] font-medium text-slate-500">
                            No admin action
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onToggleTxStatus(tx.id, tx.status === 'paid' ? 'refunded' : 'paid')
                            }
                            className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            {tx.status === 'paid' ? 'Mark Refunded' : 'Restore Paid'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={txPagination.page}
            totalPages={txPagination.totalPages}
            totalItems={txPagination.totalItems}
            startItem={txPagination.startItem}
            endItem={txPagination.endItem}
            canPrev={txPagination.canPrev}
            canNext={txPagination.canNext}
            onPrev={txPagination.goPrev}
            onNext={txPagination.goNext}
            itemLabel="entries"
          />
        </div>
      )}

      {/* Payment Receipt Preview Modal */}
      <AdminModalWrapper
        isOpen={Boolean(proofPreviewTx)}
        onClose={() => setProofPreviewTx(null)}
      >
        {proofPreviewTx && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden my-auto"
          >
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Payment Proof</h2>
                <p className="text-xs text-slate-500">
                  {proofPreviewTx.referenceId} · {proofPreviewTx.userName} (
                  {proofPreviewTx.paymentMethod})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProofPreviewTx(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 bg-slate-50 flex justify-center">
              {proofPreviewTx.proofUrl && (
                <img
                  src={proofPreviewTx.proofUrl}
                  alt={`Payment proof for ${proofPreviewTx.referenceId}`}
                  className="max-h-[340px] w-auto rounded-xl border border-slate-200 object-contain bg-white"
                />
              )}
            </div>
            <div className="px-5 py-3.5 bg-white border-t border-slate-200/80 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setProofPreviewTx(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Close
              </button>
              {proofPreviewTx.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleTxStatus(proofPreviewTx.id, 'paid');
                    setProofPreviewTx(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve Payment</span>
                </button>
              )}
            </div>
          </div>
        )}
      </AdminModalWrapper>

      {/* Record Manual Pro Payment Modal */}
      <AdminModalWrapper
        isOpen={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
      >
        <form
          onSubmit={handleConfirmManualPayment}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden my-auto"
        >
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Record Pro Payment</h2>
              <p className="text-xs text-slate-500">
                Log a {formatCurrency(PRO_PRICE, 'PHP')}/mo billing entry for a merchant
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRecordModalOpen(false)}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1">
              <label htmlFor="manual-tx-user" className="block text-xs font-semibold text-slate-700">
                Merchant Account
              </label>
              <select
                id="manual-tx-user"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — {u.plan === 'pro' ? 'Pro' : 'Free'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="manual-tx-method" className="block text-xs font-semibold text-slate-700">
                Payment Method
              </label>
              <select
                id="manual-tx-method"
                value={paymentChannel}
                onChange={(e) => setPaymentChannel(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {(paymentMethodLabels && paymentMethodLabels.length > 0
                  ? paymentMethodLabels
                  : ['GCash', 'Maya', 'Bank Transfer']
                ).map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
                <option value="Admin Grant">Admin Grant</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="manual-tx-status" className="block text-xs font-semibold text-slate-700">
                Payment Status
              </label>
              <select
                id="manual-tx-status"
                value={manualTxStatus}
                onChange={(e) => setManualTxStatus(e.target.value as 'pending' | 'paid')}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="paid">Paid (Approve &amp; Activate Pro immediately)</option>
                <option value="pending">Pending (Requires admin approval later)</option>
              </select>
            </div>
          </div>
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200/80 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRecordModalOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Save ({formatCurrency(PRO_PRICE, 'PHP')})
            </button>
          </div>
        </form>
      </AdminModalWrapper>
    </div>
  );
}
