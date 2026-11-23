import {
  CurrencyCode,
  CustomerOrder,
  OrderFulfillmentStatus,
  OrderItemSummary,
  OrderPaymentStatus,
  PreferredCheckoutPaymentKey,
  Product,
} from '../types/schema';
import { deriveOrderPaymentStatus, derivePaymentMethodKey } from './supabaseMappers';

export interface UnifiedOrderRow {
  id: string;
  customer: string;
  phoneNumber: string;
  deliveryAddress: string;
  notes?: string;
  currency: CurrencyCode;
  itemsCount: number;
  itemsSummary: string;
  items: OrderItemSummary[];
  paymentMethodKey: PreferredCheckoutPaymentKey;
  paymentMethod: string;
  paymentStatus: OrderPaymentStatus;
  amountPaid: number;
  paymentReferenceNumber?: string;
  paymentProofUrl?: string;
  paidAt?: string;
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
  const mappedLive: UnifiedOrderRow[] = liveOrders.map((o) => {
    const methodKey = derivePaymentMethodKey(o.paymentMethodKey, o.paymentMethod);
    const paymentStatus = deriveOrderPaymentStatus(methodKey, o.paymentStatus);
    return {
      id: o.id,
      customer: o.customerName,
      phoneNumber: o.phoneNumber,
      deliveryAddress: o.deliveryAddress,
      notes: o.notes,
      currency: o.currency ?? 'PHP',
      itemsCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
      itemsSummary: o.items
        .map((i) => `${i.quantity}× ${i.name}${i.variant ? ` (${i.variant})` : ''}`)
        .join(', '),
      items: o.items,
      paymentMethodKey: methodKey,
      paymentMethod: o.paymentMethod,
      paymentStatus,
      amountPaid: o.amountPaid ?? (paymentStatus === 'paid' ? o.grandTotal : 0),
      paymentReferenceNumber: o.paymentReferenceNumber,
      paymentProofUrl: o.paymentProofUrl,
      paidAt: o.paidAt,
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
    };
  });

  const seenLiveIds = new Set<string>();
  return mappedLive.filter((o) => {
    if (seenLiveIds.has(o.id)) return false;
    seenLiveIds.add(o.id);
    return true;
  });
}
