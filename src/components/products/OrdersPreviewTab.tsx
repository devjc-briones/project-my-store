import { useState } from 'react';
import { PackageCheck, Receipt, X } from 'lucide-react';
import { CurrencyCode, OrderFulfillmentStatus, OrderPaymentStatus } from '../../types/schema';
import { formatCurrency } from '../../utils/pricing';
import { UnifiedOrderRow } from '../../utils/storeOrders';
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TablePagination,
  usePagination,
} from '../common/TablePagination';

interface OrdersPreviewTabProps {
  storeName: string;
  currency: CurrencyCode;
  orders: UnifiedOrderRow[];
  onUpdateOrderStatus: (
    orderId: string,
    status: OrderFulfillmentStatus,
    isLivePlaced: boolean
  ) => void;
  onUpdateOrderPaymentStatus?: (
    orderId: string,
    paymentStatus: OrderPaymentStatus
  ) => void;
}

const PAYMENT_STATUS_LABEL: Record<OrderPaymentStatus, string> = {
  unpaid: 'Unpaid',
  pending_verification: 'Pending Verification',
  paid: 'Paid',
  refunded: 'Refunded',
};

export function OrdersPreviewTab({
  storeName,
  currency,
  orders,
  onUpdateOrderStatus,
  onUpdateOrderPaymentStatus,
}: OrdersPreviewTabProps) {
  const [previewReceiptOrder, setPreviewReceiptOrder] = useState<UnifiedOrderRow | null>(null);
  const pagination = usePagination(orders, DEFAULT_TABLE_PAGE_SIZE, storeName);

  return (
    <>
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="p-5 sm:p-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Storefront Orders ({orders.length})
              </h2>
              <p className="text-xs text-slate-500">
                Customer orders placed via {storeName}&apos;s public storefront appear here.
              </p>
            </div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="p-10 text-center space-y-1.5">
            <p className="text-sm font-semibold text-slate-900">No orders yet</p>
            <p className="text-xs text-slate-500">
              Orders placed by customers on {storeName}&apos;s storefront will appear here.
            </p>
          </div>
        ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">Order ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-5 text-right">Fulfillment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-sm">
              {pagination.paginatedItems.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                    <span>{order.id}</span>
                    {order.isLivePlaced && (
                      <span className="ml-2 text-[10px] font-sans font-semibold text-emerald-700">
                        New
                      </span>
                    )}
                    <span className="block font-sans font-normal text-[11px] text-slate-500">
                      {order.placedAt}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                    {order.customer}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[260px] truncate">
                    {order.itemsSummary}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span>{order.paymentMethod}</span>
                        {order.paymentReferenceNumber && (
                          <span className="font-mono text-[10px] text-slate-500">
                            #{order.paymentReferenceNumber}
                          </span>
                        )}
                      </div>
                      {onUpdateOrderPaymentStatus ? (
                        <select
                          aria-label={`Payment status for ${order.id}`}
                          value={order.paymentStatus}
                          onChange={(e) =>
                            onUpdateOrderPaymentStatus(
                              order.id,
                              e.target.value as OrderPaymentStatus
                            )
                          }
                          className={`min-h-[28px] px-2 py-0.5 text-[11px] font-semibold border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer ${
                            order.paymentStatus === 'paid'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : order.paymentStatus === 'pending_verification'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : order.paymentStatus === 'refunded'
                                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="pending_verification">Pending Verification</option>
                          <option value="paid">Paid</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      ) : (
                        <span className="inline-block text-[11px] font-semibold text-slate-600">
                          {PAYMENT_STATUS_LABEL[order.paymentStatus]}
                        </span>
                      )}
                      {order.paymentProofUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewReceiptOrder(order)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-600 cursor-pointer"
                        >
                          <Receipt className="w-3 h-3" />
                          View Receipt
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                    {formatCurrency(order.total, order.currency ?? currency)}
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <select
                      aria-label={`Status for ${order.id}`}
                      value={order.status}
                      onChange={(e) =>
                        onUpdateOrderStatus(
                          order.id,
                          e.target.value as OrderFulfillmentStatus,
                          order.isLivePlaced
                        )
                      }
                      className="min-h-[34px] px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-xs"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Preparing">Preparing</option>
                      <option value="Out for Delivery">Out for Delivery</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          startItem={pagination.startItem}
          endItem={pagination.endItem}
          canPrev={pagination.canPrev}
          canNext={pagination.canNext}
          onPrev={pagination.goPrev}
          onNext={pagination.goNext}
          itemLabel="orders"
        />
        </>
        )}
      </div>

      {previewReceiptOrder?.paymentProofUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Payment receipt for ${previewReceiptOrder.id}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
        >
          <div
            className="fixed inset-0"
            onClick={() => setPreviewReceiptOrder(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">Payment Receipt</p>
                <p className="text-xs text-slate-500">
                  {previewReceiptOrder.id} · {previewReceiptOrder.paymentMethod}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceiptOrder(null)}
                aria-label="Close receipt preview"
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex items-center justify-center">
              <img
                src={previewReceiptOrder.paymentProofUrl}
                alt={`Payment proof for ${previewReceiptOrder.id}`}
                className="max-h-[60vh] w-auto rounded-xl border border-slate-200 object-contain bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
