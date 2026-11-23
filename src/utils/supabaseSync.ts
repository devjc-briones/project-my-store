import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import {
  BuyerAccount,
  CustomerOrder,
  PaymentSettings,
  PlatformPaymentChannel,
  Product,
  Store,
  SubscriptionTransaction,
  User,
} from '../types/schema';
import {
  toDbCheckoutSettingsRow,
  toDbPlaceOrderRpcPayload,
  toDbPlatformChannelRows,
  toDbProductRow,
  toDbStorePaymentMethodRows,
  toDbStoreRow,
  toDbSubscriptionRow,
  toDbUserRow,
  toDbVariantRows,
} from './supabaseMappers';

export async function syncUserToSupabase(user: User | BuyerAccount): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const row = toDbUserRow(user);
    await client.from('users').upsert(row as any, { onConflict: 'id' });
  } catch (err) {
    console.error('Error syncing user to Supabase:', err);
  }
}

export async function syncStoreToSupabase(store: Store): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const row = toDbStoreRow(store);
    await client.from('stores').upsert(row as any, { onConflict: 'id' });
  } catch (err) {
    console.error('Error syncing store to Supabase:', err);
  }
}

export async function syncProductToSupabase(product: Product): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const prodRow = toDbProductRow(product);
    await client.from('store_products').upsert(prodRow as any, { onConflict: 'id' });
    if (product.variants && product.variants.length > 0) {
      const variantRows = toDbVariantRows(product.id, product.variants);
      await client.from('store_product_variants').upsert(variantRows as any, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('Error syncing product to Supabase:', err);
  }
}

export async function syncPaymentSettingsToSupabase(settings: PaymentSettings): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const checkoutRow = toDbCheckoutSettingsRow(settings);
    await client.from('store_checkout_settings').upsert(checkoutRow as any, { onConflict: 'store_id' });

    const paymentRows = toDbStorePaymentMethodRows(settings);
    for (const pRow of paymentRows) {
      await client.from('store_payments_settings').upsert(pRow as any, { onConflict: 'store_id,method_key' });
    }
  } catch (err) {
    console.error('Error syncing payment settings to Supabase:', err);
  }
}

export async function syncOrderToSupabase(order: CustomerOrder): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const rpcPayload = toDbPlaceOrderRpcPayload(order);
    const { data, error } = await client.rpc('place_storefront_order', rpcPayload as any);
    if (error) {
      console.error('Supabase place_storefront_order RPC error:', error);
      const boRow = {
        id: order.id.startsWith('ORD-') ? undefined : order.id,
        order_code: order.id,
        store_id: order.storeId,
        user_id: order.buyerId || null,
        customer_name: order.customerName,
        phone_number: order.phoneNumber,
        delivery_address: order.deliveryAddress,
        notes: order.notes || null,
        currency: order.currency || 'PHP',
        subtotal: order.subtotal,
        delivery_fee: order.deliveryFee,
        tax_amount: order.taxAmount,
        service_charge_amount: order.serviceChargeAmount,
        grand_total: order.grandTotal,
        status: order.status,
      };
      await client.from('buyer_orders').upsert(boRow as any, { onConflict: 'order_code' });
    } else if (data && typeof data === 'object' && 'id' in data) {
      const newOrderId = (data as { id: string }).id;
      if (order.paymentProofUrl || order.paymentReferenceNumber) {
        await client.from('store_product_payments').update({
          payment_status: order.paymentStatus || 'pending_verification',
          reference_number: order.paymentReferenceNumber || null,
          payment_proof_url: order.paymentProofUrl || null,
          amount_paid: order.amountPaid || 0,
        } as any).eq('order_id', newOrderId);
      }
    }
  } catch (err) {
    console.error('Error syncing order to Supabase:', err);
  }
}

export async function syncSubscriptionToSupabase(tx: SubscriptionTransaction): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const row = toDbSubscriptionRow(tx);
    await client.from('subscriptions').upsert(row as any, { onConflict: 'id' });
  } catch (err) {
    console.error('Error syncing subscription to Supabase:', err);
  }
}

export async function syncPlatformChannelsToSupabase(channels: PlatformPaymentChannel[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const rows = toDbPlatformChannelRows(channels);
    for (const row of rows) {
      await client.from('platform_payment_channels').upsert(row as any, { onConflict: 'id' });
    }
  } catch (err) {
    console.error('Error syncing platform payment channels to Supabase:', err);
  }
}
