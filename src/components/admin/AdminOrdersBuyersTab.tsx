import { useMemo, useState } from 'react';
import { Search, Store as StoreIcon, UserCheck } from 'lucide-react';
import { BuyerAccount, CustomerOrder, OrderFulfillmentStatus, Roles } from '../../types/schema';
import { formatCurrency } from '../../utils/pricing';
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TablePagination,
  usePagination,
} from '../common/TablePagination';

interface AdminOrdersBuyersTabProps {
  orders: CustomerOrder[];
  buyers: BuyerAccount[];
  onUpdateOrderStatus: (orderId: string, status: OrderFulfillmentStatus) => void;
  onDeleteBuyer?: (buyerId: string) => void;
}

const ORDER_STATUSES: OrderFulfillmentStatus[] = [
  'Pending',
  'Preparing',
  'Out for Delivery',
  'Completed',
];

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AdminOrdersBuyersTab({
  orders,
  buyers,
  onUpdateOrderStatus,
}: AdminOrdersBuyersTabProps) {
  const [search, setSearch] = useState('');

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.storeName ?? '').toLowerCase().includes(q) ||
        o.phoneNumber.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const filteredBuyers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        (b.storeName ?? '').toLowerCase().includes(q)
    );
  }, [buyers, search]);

  const ordersPagination = usePagination(filteredOrders, DEFAULT_TABLE_PAGE_SIZE, search);
  const buyersPagination = usePagination(filteredBuyers, DEFAULT_TABLE_PAGE_SIZE, search);

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          aria-label="Search orders and buyers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order ID, store, buyer name, or email..."
          className="w-full min-h-[42px] pl-10 pr-3.5 py-2 text-sm bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Live Storefront Orders */}
      <section className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Live Storefront Orders</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitor and override customer fulfillment states across all storefronts
            </p>
          </div>
          <span className="text-xs font-mono font-semibold tabular-nums text-slate-600">
            {filteredOrders.length} orders
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No live storefront orders placed yet. Orders placed via any public store checkout appear here.
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Store</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordersPagination.paginatedItems.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {order.id}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {order.storeName ?? order.storeId}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs font-semibold text-slate-900">{order.customerName}</p>
                      <p className="text-[11px] font-mono text-slate-500">{order.phoneNumber}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {order.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      {formatCurrency(order.grandTotal, 'PHP')}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <select
                        aria-label={`Order status for ${order.id}`}
                        value={order.status}
                        onChange={(e) =>
                          onUpdateOrderStatus(order.id, e.target.value as OrderFulfillmentStatus)
                        }
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                      >
                        {ORDER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={ordersPagination.page}
            totalPages={ordersPagination.totalPages}
            totalItems={ordersPagination.totalItems}
            startItem={ordersPagination.startItem}
            endItem={ordersPagination.endItem}
            canPrev={ordersPagination.canPrev}
            canNext={ordersPagination.canNext}
            onPrev={ordersPagination.goPrev}
            onNext={ordersPagination.goNext}
            itemLabel="orders"
          />
          </>
        )}
      </section>

      {/* Registered Buyer Accounts */}
      <section className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Registered Store Customers</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer accounts created on template storefronts (Read-only platform records)
            </p>
          </div>
          <span className="text-xs font-mono font-semibold tabular-nums text-slate-600">
            {filteredBuyers.length} customers
          </span>
        </div>

        {filteredBuyers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No registered store customers found.
          </div>
        ) : (
          <>
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
                {buyersPagination.paginatedItems.map((buyer) => (
                  <tr key={buyer.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 text-xs sm:text-sm font-semibold text-slate-900">
                      {buyer.name}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {buyer.email}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200/80 rounded-lg">
                        <StoreIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>{buyer.storeName ?? 'Storefront'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                      {formatDate(buyer.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-lg">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{buyer.role ?? Roles.Buyer}</span>
                      </span>
                    </td>
                  </tr>
                ))}
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
            itemLabel="customers"
          />
          </>
        )}
      </section>
    </div>
  );
}
