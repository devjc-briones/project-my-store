import {
  AppNotification,
  BuyerAccount,
  CustomerOrder,
  OrderItemSummary,
  OrderPaymentStatus,
  PaymentSettings,
  PlatformPaymentChannel,
  PreferredCheckoutPaymentKey,
  Product,
  ProductVariant,
  ROLE_TO_ID,
  Roles,
  Store,
  SubscriptionTransaction,
  User,
} from '../types/schema';
import { generateUuid, isUuid } from './supabaseClient';

export function clampNonNegative(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value * 100) / 100);
}

export function clampPercent(value: number | undefined, max = 100, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.round(value * 100) / 100));
}

export function clampStock(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export function derivePaymentMethodKey(
  methodKey?: PreferredCheckoutPaymentKey,
  paymentMethodLabel?: string
): PreferredCheckoutPaymentKey {
  if (methodKey) return methodKey;
  const normalized = (paymentMethodLabel ?? '').toLowerCase();
  if (normalized.includes('gcash')) return 'gcash';
  if (normalized.includes('maya')) return 'maya';
  if (normalized.includes('bank')) return 'bank';
  return 'cod';
}

export function deriveOrderPaymentStatus(
  methodKey: PreferredCheckoutPaymentKey,
  explicitStatus?: OrderPaymentStatus
): OrderPaymentStatus {
  if (explicitStatus) return explicitStatus;
  return methodKey === 'cod' ? 'unpaid' : 'pending_verification';
}

export function toDbUserRow(user: User | BuyerAccount) {
  const isBuyer = 'savedCheckoutInfo' in user || user.role === Roles.Buyer;
  const role: Roles = user.role ?? Roles.Seller;
  const roleId = user.roleId ?? ROLE_TO_ID[role];
  const safeUserId = isUuid(user.id) ? user.id : generateUuid();

  if (isBuyer) {
    const buyer = user as BuyerAccount;
    return {
      id: safeUserId,
      role_id: roleId,
      name: buyer.name.trim(),
      email: buyer.email.trim().toLowerCase(),
      status: 'active' as const,
      plan: 'starter' as const,
      cancel_at_period_end: false,
      phone_number: buyer.savedCheckoutInfo?.phoneNumber?.trim() || null,
      address: buyer.savedCheckoutInfo?.deliveryAddress?.trim() || null,
      delivery_notes: buyer.savedCheckoutInfo?.notes?.trim() || null,
      preferred_payment_method: buyer.savedCheckoutInfo?.preferredPaymentMethod ?? null,
      checkout_info_updated_at: buyer.savedCheckoutInfo?.updatedAt ?? null,
      registered_store_id: isUuid(buyer.storeId) ? buyer.storeId : null,
      created_at: buyer.createdAt,
      updated_at: buyer.updatedAt ?? buyer.createdAt,
    };
  }

  const merchantOrAdmin = user as User;
  return {
    id: safeUserId,
    role_id: roleId,
    name: merchantOrAdmin.name.trim(),
    email: merchantOrAdmin.email.trim().toLowerCase(),
    avatar_url: merchantOrAdmin.avatarUrl ?? null,
    status: merchantOrAdmin.status ?? 'active',
    restricted_reason: merchantOrAdmin.restrictedReason ?? null,
    plan: merchantOrAdmin.plan ?? 'starter',
    plan_period_ends_at: merchantOrAdmin.planPeriodEndsAt ?? null,
    cancel_at_period_end: Boolean(merchantOrAdmin.cancelAtPeriodEnd),
    phone_number: merchantOrAdmin.phoneNumber?.trim() || null,
    address: merchantOrAdmin.address?.trim() || null,
    delivery_notes: merchantOrAdmin.deliveryNotes?.trim() || null,
    preferred_payment_method: merchantOrAdmin.preferredPaymentMethod ?? null,
    checkout_info_updated_at: merchantOrAdmin.checkoutInfoUpdatedAt ?? null,
    registered_store_id: isUuid(merchantOrAdmin.registeredStoreId) ? merchantOrAdmin.registeredStoreId : null,
    last_active_at: merchantOrAdmin.lastActiveAt ?? merchantOrAdmin.createdAt,
    created_at: merchantOrAdmin.createdAt,
    updated_at: merchantOrAdmin.updatedAt ?? merchantOrAdmin.createdAt,
  };
}

export function toDbStoreRow(store: Store) {
  return {
    id: isUuid(store.id) ? store.id : generateUuid(),
    user_id: isUuid(store.ownerId) ? store.ownerId : generateUuid(),
    name: store.name.trim(),
    slug: store.slug.trim().toLowerCase(),
    template_id: store.templateId,
    status: store.status,
    restricted_reason: store.restrictedReason ?? null,
    primary_color: store.branding.primaryColor,
    secondary_color: store.branding.secondaryColor,
    accent_color: store.branding.accentColor,
    surface_color: store.branding.surfaceColor,
    text_color: store.branding.textColor,
    background_mode: store.branding.backgroundMode ?? 'light',
    button_style: store.branding.buttonStyle ?? 'rounded',
    font_pairing: store.branding.fontPairing ?? 'modern-sans',
    logo_text: store.branding.logoText ?? '',
    logo_image_url: store.branding.logoImageUrl ?? null,
    hero_title: store.branding.heroTitle ?? '',
    hero_subtitle: store.branding.heroSubtitle ?? '',
    hero_cta_label: store.branding.heroCtaLabel ?? 'Shop Now',
    hero_banner_url: store.branding.heroBannerUrl ?? null,
    bio: store.branding.bio ?? '',
    announcement_enabled: Boolean(store.branding.announcementEnabled),
    announcement_text: store.branding.announcementText ?? '',
    contact_address: store.branding.address ?? null,
    contact_number: store.branding.contactNumber ?? null,
    social_instagram: store.branding.socialLinks?.instagram ?? null,
    social_facebook: store.branding.socialLinks?.facebook ?? null,
    social_tiktok: store.branding.socialLinks?.tiktok ?? null,
    social_website: store.branding.socialLinks?.website ?? null,
    created_at: store.createdAt,
    updated_at: store.updatedAt,
  };
}

export function toDbProductRow(product: Product) {
  const cleanSku =
    product.sku.trim() || `PRD-${generateUuid().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  return {
    id: isUuid(product.id) ? product.id : generateUuid(),
    store_id: isUuid(product.storeId) ? product.storeId : generateUuid(),
    name: product.name.trim(),
    description: product.description ?? '',
    category: product.category.trim() || 'General',
    sku: cleanSku,
    base_price: clampNonNegative(product.basePrice),
    discount_type: product.discountType ?? 'none',
    discount_value: clampNonNegative(product.discountValue),
    discount_percent: clampPercent(product.discountPercent, 95),
    cost_price:
      typeof product.costPrice === 'number' && Number.isFinite(product.costPrice)
        ? clampNonNegative(product.costPrice)
        : null,
    final_price: clampNonNegative(product.finalPrice),
    stock: clampStock(product.stock),
    image_url: product.imageUrl ?? null,
    is_featured: Boolean(product.isFeatured),
    is_available: Boolean(product.isAvailable),
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  };
}

export function toDbVariantRows(productId: string, variants: ProductVariant[]) {
  const safeProdId = isUuid(productId) ? productId : generateUuid();
  return variants.map((variant, index) => ({
    id: isUuid(variant.id) ? variant.id : generateUuid(),
    product_id: safeProdId,
    label: variant.label.trim(),
    attribute_name: variant.attributeName.trim() || 'Option',
    value: variant.value.trim(),
    price_delta: Number.isFinite(variant.priceDelta) ? Math.round(variant.priceDelta * 100) / 100 : 0,
    stock: clampStock(variant.stock),
    sku: variant.sku?.trim() || null,
    sort_order: variant.sortOrder ?? index,
  }));
}

export function toDbCheckoutSettingsRow(settings: PaymentSettings) {
  return {
    store_id: isUuid(settings.storeId) ? settings.storeId : generateUuid(),
    currency: settings.currency,
    shipping_fee: clampNonNegative(settings.shippingFee),
    free_shipping_threshold: clampNonNegative(settings.freeShippingThreshold),
    tax_percent: clampPercent(settings.taxPercent, 100),
    service_charge_percent: clampPercent(settings.serviceChargePercent, 100),
    updated_at: settings.updatedAt,
  };
}

export function toDbStorePaymentMethodRows(settings: PaymentSettings) {
  const safeStoreId = isUuid(settings.storeId) ? settings.storeId : generateUuid();
  return [
    {
      store_id: safeStoreId,
      method_key: 'gcash' as const,
      is_enabled: Boolean(settings.gcashEnabled),
      bank_name: null,
      account_name: settings.gcashDetails.accountName.trim() || null,
      account_number: settings.gcashDetails.mobileNumber.trim() || null,
      instructions: settings.gcashDetails.qrNote?.trim() || null,
      qr_image_url: settings.gcashDetails.qrImageUrl ?? null,
      updated_at: settings.updatedAt,
    },
    {
      store_id: safeStoreId,
      method_key: 'maya' as const,
      is_enabled: Boolean(settings.mayaEnabled),
      bank_name: null,
      account_name: settings.mayaDetails.accountName.trim() || null,
      account_number: settings.mayaDetails.mobileNumber.trim() || null,
      instructions: settings.mayaDetails.qrNote?.trim() || null,
      qr_image_url: settings.mayaDetails.qrImageUrl ?? null,
      updated_at: settings.updatedAt,
    },
    {
      store_id: safeStoreId,
      method_key: 'bank' as const,
      is_enabled: Boolean(settings.bankTransferEnabled),
      bank_name: settings.bankDetails.bankName.trim() || null,
      account_name: settings.bankDetails.accountName.trim() || null,
      account_number: settings.bankDetails.accountNumber.trim() || null,
      instructions: null,
      qr_image_url: settings.bankDetails.qrImageUrl ?? null,
      updated_at: settings.updatedAt,
    },
    {
      store_id: safeStoreId,
      method_key: 'cod' as const,
      is_enabled: Boolean(settings.codEnabled),
      bank_name: null,
      account_name: null,
      account_number: null,
      instructions: settings.codInstructions?.trim() || null,
      qr_image_url: null,
      updated_at: settings.updatedAt,
    },
  ];
}

export function toDbPlaceOrderRpcPayload(order: CustomerOrder) {
  const methodKey = derivePaymentMethodKey(order.paymentMethodKey, order.paymentMethod);
  return {
    p_store_id: isUuid(order.storeId) ? order.storeId : generateUuid(),
    p_customer_name: order.customerName.trim(),
    p_phone_number: order.phoneNumber.trim(),
    p_delivery_address: order.deliveryAddress.trim(),
    p_method_key: methodKey,
    p_items: order.items.map((item) => ({
      store_product_id: isUuid(item.productId) ? item.productId : generateUuid(),
      variant_id: isUuid(item.variantId) ? item.variantId : null,
      variant_label: item.variant ?? null,
      quantity: Math.max(1, Math.floor(item.quantity)),
    })),
    p_notes: order.notes?.trim() || null,
    p_reference_number: order.paymentReferenceNumber?.trim() || null,
    p_payment_proof_url: order.paymentProofUrl ?? null,
  };
}

export function toDbOrderRow(order: CustomerOrder, resolvedOrderUuid?: string) {
  const safeOrderId =
    resolvedOrderUuid && isUuid(resolvedOrderUuid)
      ? resolvedOrderUuid
      : isUuid(order.dbId)
        ? order.dbId!
        : isUuid(order.id)
          ? order.id
          : generateUuid();

  return {
    id: safeOrderId,
    order_code: order.id,
    store_id: isUuid(order.storeId) ? order.storeId : generateUuid(),
    user_id: isUuid(order.buyerId) ? order.buyerId : null,
    customer_name: order.customerName.trim(),
    phone_number: order.phoneNumber.trim(),
    delivery_address: order.deliveryAddress.trim(),
    notes: order.notes?.trim() || null,
    currency: order.currency ?? 'PHP',
    subtotal: clampNonNegative(order.subtotal),
    delivery_fee: clampNonNegative(order.deliveryFee),
    tax_amount: clampNonNegative(order.taxAmount),
    service_charge_amount: clampNonNegative(order.serviceChargeAmount),
    grand_total: clampNonNegative(order.grandTotal),
    status: order.status,
    created_at: order.createdAt,
    updated_at: order.updatedAt ?? order.createdAt,
  };
}

export function toDbOrderItemRows(orderUuid: string, items: OrderItemSummary[]) {
  return items.map((item) => {
    const qty = Math.max(1, Math.floor(item.quantity));
    const unitPrice = clampNonNegative(item.unitPrice);
    return {
      id: generateUuid(),
      order_id: orderUuid,
      store_product_id: isUuid(item.productId) ? item.productId : null,
      variant_id: isUuid(item.variantId) ? item.variantId : null,
      product_name: item.name.trim(),
      variant_label: item.variant?.trim() || null,
      quantity: qty,
      unit_price: unitPrice,
      line_total:
        item.lineTotal !== undefined
          ? clampNonNegative(item.lineTotal)
          : Math.round(unitPrice * qty * 100) / 100,
    };
  });
}

export function toDbStoreProductPaymentRow(order: CustomerOrder, resolvedOrderUuid?: string) {
  const methodKey = derivePaymentMethodKey(order.paymentMethodKey, order.paymentMethod);
  const paymentStatus = deriveOrderPaymentStatus(methodKey, order.paymentStatus);
  const firstItem = order.items[0];
  const safeOrderId =
    resolvedOrderUuid && isUuid(resolvedOrderUuid)
      ? resolvedOrderUuid
      : isUuid(order.dbId)
        ? order.dbId!
        : isUuid(order.id)
          ? order.id
          : generateUuid();
  return {
    id: generateUuid(),
    order_id: safeOrderId,
    store_id: isUuid(order.storeId) ? order.storeId : generateUuid(),
    user_id: isUuid(order.buyerId) ? order.buyerId : null,
    store_product_id: isUuid(firstItem?.productId) ? firstItem.productId : null,
    method_key: methodKey,
    method_label: order.paymentMethod,
    payment_status: paymentStatus,
    currency: order.currency ?? 'PHP',
    amount_due: clampNonNegative(order.grandTotal),
    amount_paid: clampNonNegative(order.amountPaid),
    reference_number: order.paymentReferenceNumber?.trim() || null,
    payment_proof_url: order.paymentProofUrl ?? null,
    paid_at: order.paidAt ?? null,
    verified_by: isUuid(order.verifiedBy) ? order.verifiedBy : null,
    created_at: order.createdAt,
    updated_at: order.updatedAt ?? order.createdAt,
  };
}

export function toDbSubscriptionRow(tx: SubscriptionTransaction) {
  return {
    id: isUuid(tx.id) ? tx.id : generateUuid(),
    reference_id: tx.referenceId,
    user_id: isUuid(tx.userId) ? tx.userId : generateUuid(),
    plan_id: tx.planId,
    amount: clampNonNegative(tx.amount),
    payment_method: tx.paymentMethod,
    status: tx.status,
    due_date: tx.dueDate ?? null,
    period_start: tx.periodStart ?? null,
    period_end: tx.periodEnd ?? null,
    proof_url: tx.proofUrl ?? null,
    approved_by: isUuid(tx.approvedBy) ? tx.approvedBy : null,
    approved_at: tx.approvedAt ?? null,
    created_at: tx.createdAt,
    updated_at: tx.updatedAt ?? tx.createdAt,
  };
}

export function toDbPlatformChannelRows(channels: PlatformPaymentChannel[]) {
  return channels.map((channel, index) => ({
    id: channel.id,
    channel_type: channel.type,
    label: channel.label.trim(),
    subtitle: channel.subtitle.trim(),
    is_enabled: Boolean(channel.enabled),
    requires_receipt: Boolean(channel.requiresReceipt),
    account_name: channel.accountName.trim(),
    number_label: channel.numberLabel.trim() || 'Account Number',
    account_number: channel.accountNumber.trim(),
    note: channel.note?.trim() || null,
    qr_image_url: channel.qrImageUrl ?? null,
    sort_order: channel.sortOrder ?? index,
  }));
}

export function toDbNotificationRow(notification: AppNotification) {
  return {
    id: notification.id,
    user_id: notification.userId,
    store_id: notification.storeId ?? null,
    order_id: notification.orderId ?? null,
    subscription_id: notification.subscriptionId ?? null,
    notification_key: notification.notificationKey ?? null,
    category: notification.category,
    title: notification.title,
    message: notification.message,
    target_path: notification.targetPath,
    is_read: Boolean(notification.isRead),
    read_at: notification.readAt ?? null,
    is_dismissed: Boolean(notification.isDismissed),
    dismissed_at: notification.dismissedAt ?? null,
    created_at: notification.createdAt,
    updated_at: notification.updatedAt ?? notification.createdAt,
  };
}
