import { generateUuid, getSupabaseClient, isSupabaseConfigured, isUuid } from './supabaseClient';
import {
  BuyerAccount,
  CustomerOrder,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  PaymentSettings,
  PlatformPaymentChannel,
  Product,
  Store,
  SubscriptionTransaction,
  User,
} from '../types/schema';
import {
  toDbCheckoutSettingsRow,
  toDbOrderItemRows,
  toDbOrderRow,
  toDbPlaceOrderRpcPayload,
  toDbPlatformChannelRows,
  toDbProductRow,
  toDbStorePaymentMethodRows,
  toDbStoreProductPaymentRow,
  toDbStoreRow,
  toDbSubscriptionRow,
  toDbUserRow,
  toDbVariantRows,
} from './supabaseMappers';

export interface SyncResult {
  success: boolean;
  error?: string;
}

export async function syncUserToSupabase(user: User | BuyerAccount): Promise<SyncResult> {
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
    return { success: false, error: err?.message || 'Unable to save user to database.' };
  }
}

export async function syncStoreToSupabase(store: Store): Promise<SyncResult> {
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
    return { success: false, error: err?.message || 'Unable to save store to database.' };
  }
}

export async function deleteStoreFromSupabase(storeId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  if (!isUuid(storeId)) return { success: true };
  try {
    const { error } = await client.from('stores').delete().eq('id', storeId);
    if (error) {
      console.error('Supabase stores delete error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting store from Supabase:', err);
    return { success: false, error: err?.message || 'Unable to delete store from database.' };
  }
}

export async function syncProductToSupabase(product: Product): Promise<SyncResult> {
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

    const variantRows = toDbVariantRows(prodRow.id, product.variants ?? []);
    const { data: existingVars } = await client
      .from('store_product_variants')
      .select('id')
      .eq('product_id', prodRow.id);

    const keepIds = new Set(variantRows.map((v) => v.id));
    const staleIds = (existingVars || [])
      .map((v: { id: string }) => v.id)
      .filter((id: string) => !keepIds.has(id));

    if (staleIds.length > 0) {
      const { error: delVarErr } = await client
        .from('store_product_variants')
        .delete()
        .in('id', staleIds);
      if (delVarErr) {
        console.error('Supabase store_product_variants delete error:', delVarErr.message);
        return { success: false, error: delVarErr.message };
      }
    }

    if (variantRows.length > 0) {
      const { error: varErr } = await client
        .from('store_product_variants')
        .upsert(variantRows as any, { onConflict: 'id' });
      if (varErr) {
        console.error('Supabase store_product_variants upsert error:', varErr.message, varErr.details);
        return { success: false, error: varErr.message };
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error syncing product to Supabase:', err);
    return { success: false, error: err?.message || 'Unable to save product to database.' };
  }
}

export async function deleteProductFromSupabase(productId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  if (!isUuid(productId)) return { success: true };
  try {
    const { error } = await client.from('store_products').delete().eq('id', productId);
    if (error) {
      console.error('Supabase store_products delete error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting product from Supabase:', err);
    return { success: false, error: err?.message || 'Unable to delete product from database.' };
  }
}

export async function syncPaymentSettingsToSupabase(settings: PaymentSettings): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    const checkoutRow = toDbCheckoutSettingsRow(settings);
    const { error: chkErr } = await client
      .from('store_checkout_settings')
      .upsert(checkoutRow as any, { onConflict: 'store_id' });
    if (chkErr) {
      console.error('Supabase store_checkout_settings upsert error:', chkErr.message);
      return { success: false, error: chkErr.message };
    }

    const paymentRows = toDbStorePaymentMethodRows(settings);
    const { error: pmErr } = await client
      .from('store_payments_settings')
      .upsert(paymentRows as any, { onConflict: 'store_id,method_key' });
    if (pmErr) {
      console.error('Supabase store_payments_settings upsert error:', pmErr.message);
      return { success: false, error: pmErr.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error syncing payment settings to Supabase:', err);
    return { success: false, error: err?.message || 'Unable to save payment settings to database.' };
  }
}

export async function syncOrderToSupabase(
  order: CustomerOrder,
  updatedProductsSnapshot?: Product[]
): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };

  try {
    const orderUuid = isUuid(order.dbId)
      ? order.dbId!
      : isUuid(order.id)
        ? order.id
        : generateUuid();
    const orderRow = toDbOrderRow(order, orderUuid);

    // Dynamic direct table writes (no DB triggers or RPC required)
    const { error: orderErr } = await client
      .from('buyer_orders')
      .insert(orderRow as any);

    if (orderErr) {
      // Fallback to RPC only if an unauthenticated guest checkout is blocked by buyer_orders RLS
      const isRlsOrGuestError =
        orderErr.code === '42501' ||
        orderErr.message.toLowerCase().includes('row-level security') ||
        orderErr.message.toLowerCase().includes('permission denied');

      if (isRlsOrGuestError) {
        const rpcPayload = toDbPlaceOrderRpcPayload(order);
        const { data: rpcData, error: rpcErr } = await client.rpc(
          'place_storefront_order',
          rpcPayload as any
        );
        if (!rpcErr) {
          if (rpcData && typeof rpcData === 'object' && 'id' in rpcData && (order.paymentProofUrl || order.paymentReferenceNumber)) {
            const rpcOrderId = (rpcData as { id: string }).id;
            await client
              .from('store_product_payments')
              .update({
                payment_status: order.paymentStatus || 'pending_verification',
                reference_number: order.paymentReferenceNumber || null,
                payment_proof_url: order.paymentProofUrl || null,
                amount_paid: order.amountPaid || 0,
              } as any)
              .eq('order_id', rpcOrderId);
          }
          return { success: true };
        }
        return { success: false, error: rpcErr.message || orderErr.message };
      }

      console.error('Supabase buyer_orders insert error:', orderErr.message, orderErr.details);
      return { success: false, error: orderErr.message };
    }

    const itemRows = toDbOrderItemRows(orderUuid, order.items);
    if (itemRows.length > 0) {
      const { error: itemsErr } = await client.from('order_items').insert(itemRows as any);
      if (itemsErr) {
        console.error('Supabase order_items insert error:', itemsErr.message);
        return { success: false, error: itemsErr.message };
      }
    }

    const paymentRow = toDbStoreProductPaymentRow(order, orderUuid);
    const { error: payErr } = await client.from('store_product_payments').insert(paymentRow as any);
    if (payErr) {
      console.error('Supabase store_product_payments insert error:', payErr.message);
      return { success: false, error: payErr.message };
    }

    // Directly decrement ordered product/variant stock in DB (no trigger required)
    if (updatedProductsSnapshot && updatedProductsSnapshot.length > 0) {
      const orderedProductIds = new Set(order.items.map((i) => i.productId));
      const touchedProducts = updatedProductsSnapshot.filter((p) => orderedProductIds.has(p.id));
      for (const prod of touchedProducts) {
        if (isUuid(prod.id)) {
          await client
            .from('store_products')
            .update({ stock: Math.max(0, prod.stock), updated_at: new Date().toISOString() } as any)
            .eq('id', prod.id);
        }
        for (const variant of prod.variants ?? []) {
          if (isUuid(variant.id)) {
            await client
              .from('store_product_variants')
              .update({ stock: Math.max(0, variant.stock) } as any)
              .eq('id', variant.id);
          }
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error syncing order to Supabase:', err);
    return { success: false, error: err?.message || 'Unable to save order to database.' };
  }
}

export async function syncOrderStatusToSupabase(
  orderCodeOrId: string,
  status: OrderFulfillmentStatus,
  dbId?: string
): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    const nowIso = new Date().toISOString();
    const query = client
      .from('buyer_orders')
      .update({ status, updated_at: nowIso } as any);

    const { error } =
      dbId && isUuid(dbId)
        ? await query.eq('id', dbId)
        : isUuid(orderCodeOrId)
          ? await query.eq('id', orderCodeOrId)
          : await query.eq('order_code', orderCodeOrId);

    if (error) {
      console.error('Supabase buyer_orders status update error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error updating order status in Supabase:', err);
    return { success: false, error: err?.message || 'Unable to update order status.' };
  }
}

export async function syncOrderPaymentStatusToSupabase(params: {
  orderCodeOrId: string;
  dbId?: string;
  paymentStatus: OrderPaymentStatus;
  amountPaid: number;
  paidAt?: string;
  verifiedBy?: string;
}): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    let targetOrderUuid = params.dbId && isUuid(params.dbId) ? params.dbId : undefined;
    if (!targetOrderUuid) {
      if (isUuid(params.orderCodeOrId)) {
        targetOrderUuid = params.orderCodeOrId;
      } else {
        const { data: orderRec, error: lookupErr } = await client
          .from('buyer_orders')
          .select('id')
          .eq('order_code', params.orderCodeOrId)
          .maybeSingle();
        if (lookupErr) {
          return { success: false, error: lookupErr.message };
        }
        targetOrderUuid = orderRec?.id;
      }
    }

    if (!targetOrderUuid) {
      return { success: true };
    }

    const nowIso = new Date().toISOString();
    const { error } = await client
      .from('store_product_payments')
      .update({
        payment_status: params.paymentStatus,
        amount_paid: params.amountPaid,
        paid_at: params.paidAt ?? null,
        verified_by: params.verifiedBy && isUuid(params.verifiedBy) ? params.verifiedBy : null,
        updated_at: nowIso,
      } as any)
      .eq('order_id', targetOrderUuid);

    if (error) {
      console.error('Supabase store_product_payments update error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error updating order payment status in Supabase:', err);
    return { success: false, error: err?.message || 'Unable to update order payment status.' };
  }
}

export async function syncSubscriptionToSupabase(
  tx: SubscriptionTransaction,
  isNewInsert = false
): Promise<SyncResult> {
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
    return { success: false, error: err?.message || 'Unable to save subscription record.' };
  }
}

export async function syncPlatformChannelsToSupabase(
  channels: PlatformPaymentChannel[]
): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  try {
    const rows = toDbPlatformChannelRows(channels);
    const { data: existingChannels } = await client
      .from('platform_payment_channels')
      .select('id');
    const keepIds = new Set(rows.map((r) => r.id));
    const staleIds = (existingChannels || [])
      .map((c: { id: string }) => c.id)
      .filter((id: string) => !keepIds.has(id));

    if (staleIds.length > 0) {
      const { error: delErr } = await client
        .from('platform_payment_channels')
        .delete()
        .in('id', staleIds);
      if (delErr) {
        console.error('Supabase platform_payment_channels delete error:', delErr.message);
        return { success: false, error: delErr.message };
      }
    }

    if (rows.length > 0) {
      const { error } = await client
        .from('platform_payment_channels')
        .upsert(rows as any, { onConflict: 'id' });
      if (error) {
        console.error('Supabase platform_payment_channels upsert error:', error.message);
        return { success: false, error: error.message };
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error syncing platform payment channels to Supabase:', err);
    return { success: false, error: err?.message || 'Unable to save platform payment channels.' };
  }
}

export async function deleteUserFromSupabase(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Hindi nakakonekta sa Supabase database.' };
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Database client not initialized.' };
  if (!isUuid(userId)) return { success: true };
  try {
    const { error } = await client.from('users').delete().eq('id', userId);
    if (error) {
      console.error('Supabase users delete error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting user from Supabase:', err);
    return { success: false, error: err?.message || 'Unable to delete user from database.' };
  }
}
