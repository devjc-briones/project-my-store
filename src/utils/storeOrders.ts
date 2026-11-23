import {
  CustomerOrder,
  OrderFulfillmentStatus,
  OrderItemSummary,
  Product,
} from '../types/schema';

export interface UnifiedOrderRow {
  id: string;
  customer: string;
  phoneNumber: string;
  deliveryAddress: string;
  notes?: string;
  itemsCount: number;
  itemsSummary: string;
  items: OrderItemSummary[];
  paymentMethod: string;
  paymentProofUrl?: string;
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  serviceChargeAmount: number;
  total: number;
  placedAt: string;
  status: OrderFulfillmentStatus;
  isLivePlaced: boolean;
}

export function getCombinedStoreOrders(
  _storeName: string,
  _products: Product[],
  liveOrders: CustomerOrder[]
): UnifiedOrderRow[] {
  const mappedLive: UnifiedOrderRow[] = liveOrders.map((o) => ({
    id: o.id,
    customer: o.customerName,
    phoneNumber: o.phoneNumber,
    deliveryAddress: o.deliveryAddress,
    notes: o.notes,
    itemsCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
    itemsSummary: o.items
      .map((i) => `${i.quantity}× ${i.name}${i.variant ? ` (${i.variant})` : ''}`)
      .join(', '),
    items: o.items,
    paymentMethod: o.paymentMethod,
    paymentProofUrl: o.paymentProofUrl,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    taxAmount: o.taxAmount,
    serviceChargeAmount: o.serviceChargeAmount,
    total: o.grandTotal,
    placedAt: new Date(o.createdAt).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    status: o.status,
    isLivePlaced: true,
  }));

  const seenLiveIds = new Set<string>();
  return mappedLive.filter((o) => {
    if (seenLiveIds.has(o.id)) return false;
    seenLiveIds.add(o.id);
    return true;
  });
}
