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

export async function syncUserToSupabase(user: User | BuyerAccount): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    const row = toDbUserRow(user);
    const { error } = await client.from('users').upsert(row as any, { onConflict: 'id' });
    if (error) {
      console.error('Supabase users upsert error:', error.message, error.details);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error syncing user to Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function syncStoreToSupabase(store: Store): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    const row = toDbStoreRow(store);
    const { error } = await client.from('stores').upsert(row as any, { onConflict: 'id' });
    if (error) {
      console.error('Supabase stores upsert error:', error.message, error.details);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error syncing store to Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function syncProductToSupabase(product: Product): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    const prodRow = toDbProductRow(product);
    const { error: prodErr } = await client.from('store_products').upsert(prodRow as any, { onConflict: 'id' });
    if (prodErr) {
      console.error('Supabase store_products upsert error:', prodErr.message, prodErr.details);
      return { success: false, error: prodErr.message };
    }
    if (product.variants && product.variants.length > 0) {
      const variantRows = toDbVariantRows(product.id, product.variants);
      const { error: varErr } = await client.from('store_product_variants').upsert(variantRows as any, { onConflict: 'id' });
      if (varErr) {
        console.error('Supabase store_product_variants upsert error:', varErr.message, varErr.details);
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error syncing product to Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function syncPaymentSettingsToSupabase(settings: PaymentSettings): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    const checkoutRow = toDbCheckoutSettingsRow(settings);
    const { error: chkErr } = await client.from('store_checkout_settings').upsert(checkoutRow as any, { onConflict: 'store_id' });
    if (chkErr) {
      console.error('Supabase store_checkout_settings upsert error:', chkErr.message);
    }

    const paymentRows = toDbStorePaymentMethodRows(settings);
    for (const pRow of paymentRows) {
      const { error: pmErr } = await client.from('store_payments_settings').upsert(pRow as any, { onConflict: 'store_id,method_key' });
      if (pmErr) {
        console.error('Supabase store_payments_settings upsert error:', pmErr.message);
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error syncing payment settings to Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function syncOrderToSupabase(order: CustomerOrder): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    const rpcPayload = toDbPlaceOrderRpcPayload(order);
    const { data, error } = await client.rpc('place_storefront_order', rpcPayload as any);
    if (error) {
      console.error('Supabase place_storefront_order RPC error:', error.message, error.details);
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
      const { error: directErr } = await client.from('buyer_orders').upsert(boRow as any, { onConflict: 'order_code' });
      if (directErr) {
        console.error('Supabase buyer_orders fallback upsert error:', directErr.message);
        return { success: false, error: directErr.message };
      }
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
    return { success: true };
  } catch (err: any) {
    console.error('Error syncing order to Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function syncSubscriptionToSupabase(
  tx: SubscriptionTransaction,
  isNewInsert = false
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    const row = toDbSubscriptionRow(tx);
    const { error } = isNewInsert
      ? await client.from('subscriptions').insert(row as any)
      : await client.from('subscriptions').upsert(row as any, { onConflict: 'id' });
    if (error) {
      console.error('Supabase subscriptions write error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error syncing subscription to Supabase:', err);
    return { success: false, error: err.message };
  }
}

export async function syncPlatformChannelsToSupabase(channels: PlatformPaymentChannel[]): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    const rows = toDbPlatformChannelRows(channels);
    for (const row of rows) {
      const { error } = await client.from('platform_payment_channels').upsert(row as any, { onConflict: 'id' });
      if (error) {
        console.error('Supabase platform_payment_channels upsert error:', error.message);
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error syncing platform payment channels to Supabase:', err);
    return { success: false, error: err.message };
  }
}
