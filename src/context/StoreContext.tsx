import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppNotification,
  BuyerAccount,
  BuyerCheckoutInfo,
  CustomerOrder,
  DiscountType,
  GlobalAppState,
  IndustryTemplateId,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  PaymentSettings,
  PlatformPaymentChannel,
  PlatformPaymentSettings,
  Product,
  ROLE_TO_ID,
  Roles,
  Store,
  StoreBranding,
  SubscriptionTransaction,
  ToastMessage,
  User,
} from '../types/schema';
import { INITIAL_SEED_STATE, createDefaultPaymentSettings } from '../data/mockSeed';
import { createDefaultPlatformPaymentSettings, PRO_PLAN_PRICE_ROW_ID } from '../data/platformPayments';
import { DEFAULT_PRO_MONTHLY_PRICE, getPlanLimits } from '../data/plans';
import { INDUSTRY_TEMPLATES, isProTemplate } from '../data/templates';
import { resolveTemplateAssetUrl } from '../data/templateAssets';
import { buildStoreDomainUrl, generateUniqueStoreSlug, validateStoreSlug } from '../utils/domain';
import { calculateSmartPricing } from '../utils/pricing';
import { isUserPlanPastDue } from '../utils/billing';
import {
  clampNonNegative,
  clampPercent,
  clampStock,
  deriveOrderPaymentStatus,
  derivePaymentMethodKey,
  toDbUserRow,
} from '../utils/supabaseMappers';
import {
  deleteProductFromSupabase,
  deleteStoreFromSupabase,
  deleteUserFromSupabase,
  syncOrderPaymentStatusToSupabase,
  syncOrderStatusToSupabase,
  syncOrderToSupabase,
  syncPaymentSettingsToSupabase,
  syncPlatformChannelsToSupabase,
  syncProductToSupabase,
  syncProPlanPriceToSupabase,
  syncStoreToSupabase,
  syncSubscriptionToSupabase,
  syncUserNotificationStatesToSupabase,
  syncUserToSupabase,
} from '../utils/supabaseSync';
import { setAdminProPlanPrice } from '../utils/paymentGateway';
import { formatAuthError, generateUuid, getSupabaseClient, getSupabaseConfigStatus, isSupabaseConfigured, isUuid } from '../utils/supabaseClient';
import { AppRoute, buildRoutePath, parseRoute } from '../router/routes';

const STORAGE_KEY = 'mystore_saas_state_v2';
const NOTIF_STATE_STORAGE_PREFIX = 'mystore_notif_state_v1:';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveUserRole(u: any): { role: Roles; roleId: 1 | 2 | 3 } {
  const numRoleId = Number(u?.role_id);
  if (numRoleId === 1) return { role: Roles.Admin, roleId: 1 };
  if (numRoleId === 2) return { role: Roles.Seller, roleId: 2 };
  if (numRoleId === 3) return { role: Roles.Buyer, roleId: 3 };

  const textRole = String(u?.role ?? u?.account_type ?? '').trim().toLowerCase();
  if (textRole === 'admin' || textRole === 'superadmin' || textRole === 'super_admin') {
    return { role: Roles.Admin, roleId: 1 };
  }
  if (textRole === 'seller' || textRole === 'merchant') {
    return { role: Roles.Seller, roleId: 2 };
  }
  if (textRole === 'buyer' || textRole === 'customer') {
    return { role: Roles.Buyer, roleId: 3 };
  }
  if (u?.registered_store_id) {
    return { role: Roles.Buyer, roleId: 3 };
  }
  return { role: Roles.Buyer, roleId: 3 };
}

function resolveTemplateId(raw: unknown): IndustryTemplateId {
  if (typeof raw === 'string' && raw in INDUSTRY_TEMPLATES) {
    return raw as IndustryTemplateId;
  }
  return 'food-restaurant';
}

interface LocalNotificationState {
  readIds: string[];
  dismissedIds: string[];
}

function loadLocalNotificationState(userId?: string | null): LocalNotificationState {
  if (!userId || typeof window === 'undefined') {
    return { readIds: [], dismissedIds: [] };
  }
  try {
    const raw = window.localStorage.getItem(`${NOTIF_STATE_STORAGE_PREFIX}${userId}`);
    if (!raw) return { readIds: [], dismissedIds: [] };
    const parsed = JSON.parse(raw) as Partial<LocalNotificationState>;
    return {
      readIds: Array.isArray(parsed.readIds)
        ? parsed.readIds.filter((v): v is string => typeof v === 'string')
        : [],
      dismissedIds: Array.isArray(parsed.dismissedIds)
        ? parsed.dismissedIds.filter((v): v is string => typeof v === 'string')
        : [],
    };
  } catch {
    return { readIds: [], dismissedIds: [] };
  }
}

function saveLocalNotificationState(
  userId: string | null | undefined,
  readIds: string[],
  dismissedIds: string[]
): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    const dedupRead = Array.from(new Set(readIds)).slice(-500);
    const dedupDismissed = Array.from(new Set(dismissedIds)).slice(-500);
    window.localStorage.setItem(
      `${NOTIF_STATE_STORAGE_PREFIX}${userId}`,
      JSON.stringify({ readIds: dedupRead, dismissedIds: dedupDismissed })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export interface CreateStoreInput {
  name: string;
  customSlug?: string;
  templateId: IndustryTemplateId;
  status?: Store['status'];
  branding?: StoreBranding;
}

export interface CreateProductInput {
  storeId: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountPercent?: number;
  costPrice?: number;
  sku: string;
  stock: number;
  imageUrl?: string;
  variants?: Product['variants'];
  isFeatured?: boolean;
  isAvailable?: boolean;
}

interface StoreContextValue {
  state: GlobalAppState;
  isHydrating: boolean;
  isAuthChecking: boolean;
  route: AppRoute;
  navigate: (next: AppRoute, options?: { replace?: boolean }) => void;
  goBack: (fallback?: AppRoute) => void;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Auth / User actions (Strictly direct to Supabase Database)
  signInUser: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; user?: User; error?: string; isSystemError?: boolean }>;
  signUpUser: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; user?: User; requiresEmailConfirmation?: boolean; error?: string; isSystemError?: boolean }>;
  signInAdminUser: (email: string, password: string) => Promise<{ success: boolean; error?: string; isSystemError?: boolean }>;
  resetUserPassword: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string; isSystemError?: boolean }>;
  signOut: () => void;
  updateUserProfile: (
    updates: Partial<Pick<User, 'name' | 'email' | 'plan' | 'planPeriodEndsAt' | 'cancelAtPeriodEnd'>>
  ) => void;

  // Store actions
  setActiveStore: (storeId: string | null) => void;
  createStore: (input: CreateStoreInput) => Promise<{ store?: Store; error?: string }>;
  updateStoreMeta: (
    storeId: string,
    updates: {
      name?: string;
      slug?: string;
      status?: Store['status'];
      templateId?: IndustryTemplateId;
      branding?: StoreBranding;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  updateStoreBranding: (
    storeId: string,
    brandingUpdates: Partial<StoreBranding>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteStore: (storeId: string) => Promise<{ success: boolean; error?: string }>;
  getStoreBySlug: (slug: string) => Store | undefined;

  // Product actions
  getStoreProducts: (storeId: string) => Product[];
  createProduct: (
    input: CreateProductInput
  ) => Promise<{ success: boolean; product?: Product; error?: string }>;
  updateProduct: (
    productId: string,
    updates: Partial<Omit<Product, 'id' | 'storeId'>>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteProduct: (productId: string) => Promise<{ success: boolean; error?: string }>;

  // Payment settings actions
  getPaymentSettings: (storeId: string) => PaymentSettings;
  updatePaymentSettings: (
    storeId: string,
    updates: Partial<PaymentSettings>
  ) => Promise<{ success: boolean; error?: string }>;

  // Customer order actions
  getStoreOrders: (storeId: string) => CustomerOrder[];
  placeCustomerOrder: (
    order: Omit<CustomerOrder, 'id' | 'status' | 'createdAt'>
  ) => CustomerOrder;
  updateOrderStatus: (orderId: string, status: OrderFulfillmentStatus) => void;
  updateOrderPaymentStatus: (
    orderId: string,
    paymentStatus: OrderPaymentStatus,
    verifiedBy?: string
  ) => void;

  // Buyer Auth & Orders (Direct to Supabase)
  buyerSignUp: (input: {
    name: string;
    email: string;
    password: string;
    storeId?: string;
    storeName?: string;
  }) => Promise<{ success: boolean; buyer?: BuyerAccount; requiresEmailConfirmation?: boolean; error?: string; isSystemError?: boolean }>;
  buyerSignIn: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; buyer?: BuyerAccount; error?: string; isSystemError?: boolean }>;
  buyerResetPassword: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string; isSystemError?: boolean }>;
  buyerSignOut: () => void;
  getBuyerOrders: () => CustomerOrder[];
  getBuyerCheckoutInfo: () => BuyerCheckoutInfo | null;
  saveBuyerCheckoutInfo: (info: Omit<BuyerCheckoutInfo, 'updatedAt'>) => BuyerCheckoutInfo | null;
  clearBuyerCheckoutInfo: () => void;

  // Subscription Revenue & Admin Actions
  recordSubscriptionPayment: (input: {
    userId: string;
    userName: string;
    userEmail: string;
    planId: 'starter' | 'pro';
    amount: number;
    paymentMethod: string;
    referenceId?: string;
    status?: SubscriptionTransaction['status'];
    dueDate?: string;
    proofUrl?: string;
  }) => Promise<{ success: boolean; tx?: SubscriptionTransaction; error?: string }>;
  confirmGatewaySubscription: (input: {
    referenceId: string;
    planId: 'pro';
    amount: number;
    paymentMethod: string;
  }) => Promise<void>;
  adminUpdateUser: (
    userId: string,
    updates: Partial<
      Pick<
        User,
        'name' | 'email' | 'plan' | 'status' | 'restrictedReason' | 'cancelAtPeriodEnd' | 'planPeriodEndsAt'
      >
    >
  ) => void;
  adminDeleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  adminUpdateStore: (
    storeId: string,
    updates: {
      name?: string;
      slug?: string;
      status?: Store['status'];
      restrictedReason?: string;
      templateId?: IndustryTemplateId;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  adminToggleSubscriptionTxStatus: (
    txId: string,
    status: SubscriptionTransaction['status']
  ) => void;
  adminDeleteBuyer: (buyerId: string) => void;

  // Platform Subscription Payment Settings (Admin)
  platformPaymentSettings: PlatformPaymentSettings;
  proMonthlyPrice: number;
  updatePlatformPaymentSettings: (channels: PlatformPaymentChannel[], nextProPrice?: number) => void;
  updateProMonthlyPrice: (price: number) => Promise<{ success: boolean; error?: string }>;

  // Seller notification read/dismiss actions
  markNotificationsRead: (ids: string[]) => void;
  dismissNotifications: (ids: string[]) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function loadInitialState(): GlobalAppState {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return INITIAL_SEED_STATE;
}

function generateId(prefix: string): string {
  if (prefix === 'tst') {
    return `tst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }
  return generateUuid();
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GlobalAppState>(loadInitialState);
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined'
      ? parseRoute(window.location.pathname, window.location.search)
      : { name: 'landing' }
  );
  const [routeHistory, setRouteHistory] = useState<AppRoute[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isHydrating, setIsHydrating] = useState<boolean>(
    () => isSupabaseConfigured && Boolean(getSupabaseClient())
  );
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(
    () => isSupabaseConfigured && Boolean(getSupabaseClient())
  );
  const isInitialHydrationRef = useRef(true);
  const authValidationLockRef = useRef(false);
  const hydrateSessionRef = useRef<((explicitSession?: any) => Promise<void>) | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  activeUserIdRef.current = state.currentUser?.id ?? state.currentBuyer?.id ?? null;

  // Sync route on browser Back/Forward navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setRoute(parseRoute(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Hydrate state from Supabase on mount if configured
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsHydrating(false);
      setIsAuthChecking(false);
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      setIsHydrating(false);
      setIsAuthChecking(false);
      return;
    }

    const authSafetyTimer =
      typeof window !== 'undefined'
        ? window.setTimeout(() => {
            if (isInitialHydrationRef.current) {
              isInitialHydrationRef.current = false;
              setIsAuthChecking(false);
              setIsHydrating(false);
            }
          }, 12000)
        : undefined;

    async function hydrateFromSupabase(explicitSession?: any) {
      try {
        let activeSession = explicitSession;
        if (!activeSession) {
          const { data: sessionData } = await client!.auth.getSession();
          activeSession = sessionData?.session ?? null;
        }
        const sessionUserId: string | undefined = activeSession?.user?.id;
        const hasSession = Boolean(sessionUserId);
        if (!hasSession && isInitialHydrationRef.current) {
          setIsAuthChecking(false);
        }

        const [
          { data: dbStores },
          { data: dbProducts },
          { data: dbVariants },
          { data: dbCheckoutSettings },
          { data: dbPaymentSettings },
          { data: dbChannels },
        ] = await Promise.all([
          client!.from('stores').select('*'),
          client!.from('store_products').select('*'),
          client!.from('store_product_variants').select('*'),
          client!.from('store_checkout_settings').select('*'),
          client!.from('store_payments_settings').select('*'),
          client!.from('platform_payment_channels').select('*'),
        ]);

        let dbUsers: any[] | null = null;
        let dbOrders: any[] | null = null;
        let dbOrderItems: any[] | null = null;
        let dbPayments: any[] | null = null;
        let dbSubs: any[] | null = null;
        let dbNotifications: any[] | null = null;
        let dbNotifStates: any[] | null = null;
        let usersFetchFailed = false;

        if (hasSession && sessionUserId) {
          const [
            usersRes,
            ordersRes,
            orderItemsRes,
            paymentsRes,
            subsRes,
            notificationsRes,
            notifStatesRes,
          ] = await Promise.all([
            client!.from('users').select('*'),
            client!.from('buyer_orders').select('*'),
            client!.from('order_items').select('*'),
            client!.from('store_product_payments').select('*'),
            client!.from('subscriptions').select('*'),
            client!.from('notifications').select('*'),
            client!
              .from('user_notification_states')
              .select('notification_key, is_read, is_dismissed')
              .eq('user_id', sessionUserId),
          ]);

          if (usersRes.error) {
            usersFetchFailed = true;
            console.error('Supabase users fetch error during hydration:', usersRes.error);
          }

          dbUsers = usersRes.data || [];

          if (!dbUsers.some((u: any) => u.id === sessionUserId)) {
            const { data: selfUser, error: selfErr } = await client!
              .from('users')
              .select('*')
              .eq('id', sessionUserId)
              .maybeSingle();
            if (selfErr) {
              usersFetchFailed = true;
              console.error('Supabase self user fetch error during hydration:', selfErr);
            } else if (selfUser) {
              dbUsers = [selfUser, ...dbUsers];
            }
          }

          dbOrders = ordersRes.data;
          dbOrderItems = orderItemsRes.data;
          dbPayments = paymentsRes.data;
          dbSubs = subsRes.data;
          dbNotifications = notificationsRes.data;
          dbNotifStates = notifStatesRes.error ? null : notifStatesRes.data;
        }

        const mappedUsers: User[] = (dbUsers || []).map((u: any) => {
          const resolvedRole = resolveUserRole(u);
          return {
            id: u.id,
            name: typeof u.name === 'string' && u.name.trim() ? u.name : (u.email || 'User'),
            email: typeof u.email === 'string' ? u.email : '',
            role: resolvedRole.role,
            roleId: resolvedRole.roleId,
            plan: u.plan === 'pro' ? 'pro' : 'starter',
            status: u.status === 'restricted' ? 'restricted' : 'active',
            restrictedReason: u.restricted_reason || undefined,
            cancelAtPeriodEnd: Boolean(u.cancel_at_period_end),
            planPeriodEndsAt: u.plan_period_ends_at || undefined,
            phoneNumber: u.phone_number || undefined,
            address: u.address || undefined,
            deliveryNotes: u.delivery_notes || undefined,
            preferredPaymentMethod: u.preferred_payment_method || undefined,
            checkoutInfoUpdatedAt: u.checkout_info_updated_at || undefined,
            registeredStoreId: u.registered_store_id || undefined,
            lastActiveAt: u.last_active_at || u.created_at || new Date().toISOString(),
            createdAt: u.created_at || new Date().toISOString(),
            updatedAt: u.updated_at || undefined,
          };
        });

        const mappedStores: Store[] = (dbStores || []).map((s: any) => {
            const safeTemplateId = resolveTemplateId(s.template_id);
            const fallbackBranding = INDUSTRY_TEMPLATES[safeTemplateId].defaultBranding;
            const safeName = typeof s.name === 'string' && s.name.trim() ? s.name : 'Untitled Store';
            const safeSlug = typeof s.slug === 'string' ? s.slug : '';
            const safeStatus: Store['status'] =
              s.status === 'published' || s.status === 'restricted' ? s.status : 'draft';
            return {
              id: s.id,
              ownerId: s.user_id || '',
              name: safeName,
              slug: safeSlug,
              domainUrl: buildStoreDomainUrl(safeSlug),
              templateId: safeTemplateId,
              status: safeStatus,
              restrictedReason: s.restricted_reason || undefined,
              branding: {
                primaryColor: s.primary_color || fallbackBranding.primaryColor,
                secondaryColor: s.secondary_color || fallbackBranding.secondaryColor,
                accentColor: s.accent_color || fallbackBranding.accentColor,
                surfaceColor: s.surface_color || fallbackBranding.surfaceColor,
                textColor: s.text_color || fallbackBranding.textColor,
                backgroundMode: s.background_mode || fallbackBranding.backgroundMode,
                buttonStyle: s.button_style || fallbackBranding.buttonStyle,
                fontPairing: s.font_pairing || fallbackBranding.fontPairing,
                logoText: s.logo_text ?? safeName,
                logoImageUrl: s.logo_image_url || undefined,
                heroTitle: s.hero_title ?? safeName,
                heroSubtitle: s.hero_subtitle ?? '',
                heroCtaLabel: s.hero_cta_label || 'Shop Now',
                heroBannerUrl: s.hero_banner_url || undefined,
                bio: s.bio ?? '',
                announcementEnabled: Boolean(s.announcement_enabled),
                announcementText: s.announcement_text ?? '',
                address: s.contact_address || undefined,
                contactNumber: s.contact_number || undefined,
                socialLinks: {
                  instagram: s.social_instagram || undefined,
                  facebook: s.social_facebook || undefined,
                  tiktok: s.social_tiktok || undefined,
                  website: s.social_website || undefined,
                },
              },
              createdAt: s.created_at || new Date().toISOString(),
              updatedAt: s.updated_at || s.created_at || new Date().toISOString(),
            };
          });

          const variantsMap = new Map<string, any[]>();
          (dbVariants || []).forEach((v: any) => {
            const list = variantsMap.get(v.product_id) || [];
            list.push({
              id: v.id,
              productId: v.product_id,
              label: v.label || '',
              attributeName: v.attribute_name || 'Option',
              value: v.value || '',
              priceDelta: Number(v.price_delta || 0),
              stock: Number.isFinite(Number(v.stock)) ? Number(v.stock) : 0,
              sku: v.sku || undefined,
              sortOrder: v.sort_order ?? 0,
            });
            variantsMap.set(v.product_id, list);
          });

          const mappedProducts: Product[] = (dbProducts || []).map((p: any) => ({
            id: p.id,
            storeId: p.store_id || '',
            name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Untitled Product',
            description: typeof p.description === 'string' ? p.description : '',
            category: typeof p.category === 'string' && p.category.trim() ? p.category : 'General',
            sku: typeof p.sku === 'string' ? p.sku : '',
            basePrice: Number(p.base_price || 0),
            discountType: p.discount_type || 'none',
            discountValue: Number(p.discount_value || 0),
            discountPercent: Number(p.discount_percent || 0),
            costPrice: p.cost_price != null ? Number(p.cost_price) : undefined,
            finalPrice: Number(p.final_price || p.base_price || 0),
            stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0,
            imageUrl: p.image_url || undefined,
            variants: variantsMap.get(p.id) || [],
            isFeatured: Boolean(p.is_featured),
            isAvailable: p.is_available !== false,
            createdAt: p.created_at || new Date().toISOString(),
            updatedAt: p.updated_at || p.created_at || new Date().toISOString(),
          }));

          const paymentSettingsByStore: Record<string, PaymentSettings> = {};
          const checkoutMap = new Map<string, any>();
          (dbCheckoutSettings || []).forEach((c: any) => checkoutMap.set(c.store_id, c));
          const paymentsMap = new Map<string, any[]>();
          (dbPaymentSettings || []).forEach((ps: any) => {
            const list = paymentsMap.get(ps.store_id) || [];
            list.push(ps);
            paymentsMap.set(ps.store_id, list);
          });

          (dbStores || []).forEach((s: any) => {
            const co = checkoutMap.get(s.id) || {};
            const pmList = paymentsMap.get(s.id) || [];
            const getPm = (key: string) => pmList.find((p: any) => p.method_key === key) || {};
            const codRec = getPm('cod');
            const gcashRec = getPm('gcash');
            const mayaRec = getPm('maya');
            const bankRec = getPm('bank');

            paymentSettingsByStore[s.id] = {
              storeId: s.id,
              currency: co.currency || 'PHP',
              shippingFee: Number(co.shipping_fee || 0),
              freeShippingThreshold: Number(co.free_shipping_threshold || 0),
              taxPercent: Number(co.tax_percent || 0),
              serviceChargePercent: Number(co.service_charge_percent || 0),
              codEnabled: Boolean(codRec.is_enabled),
              codInstructions: codRec.instructions || undefined,
              gcashEnabled: Boolean(gcashRec.is_enabled),
              gcashDetails: {
                accountName: gcashRec.account_name || '',
                mobileNumber: gcashRec.account_number || '',
                qrNote: gcashRec.instructions || undefined,
                qrImageUrl: gcashRec.qr_image_url || undefined,
              },
              mayaEnabled: Boolean(mayaRec.is_enabled),
              mayaDetails: {
                accountName: mayaRec.account_name || '',
                mobileNumber: mayaRec.account_number || '',
                qrNote: mayaRec.instructions || undefined,
                qrImageUrl: mayaRec.qr_image_url || undefined,
              },
              bankTransferEnabled: Boolean(bankRec.is_enabled),
              bankDetails: {
                bankName: bankRec.bank_name || '',
                accountName: bankRec.account_name || '',
                accountNumber: bankRec.account_number || '',
                qrImageUrl: bankRec.qr_image_url || undefined,
              },
              updatedAt: co.updated_at || s.updated_at,
            };
          });

          const itemsMap = new Map<string, any[]>();
          (dbOrderItems || []).forEach((oi: any) => {
            const list = itemsMap.get(oi.order_id) || [];
            list.push({
              productId: oi.store_product_id || '',
              variantId: oi.variant_id || undefined,
              name: oi.product_name,
              variant: oi.variant_label || undefined,
              quantity: oi.quantity,
              unitPrice: Number(oi.unit_price || 0),
              lineTotal: Number(oi.line_total || 0),
            });
            itemsMap.set(oi.order_id, list);
          });

          const paymentsMapByOrder = new Map<string, any>();
          (dbPayments || []).forEach((pay: any) => {
            paymentsMapByOrder.set(pay.order_id, pay);
          });

          const mappedOrders: CustomerOrder[] = (dbOrders || []).map((o: any) => {
            const payInfo = paymentsMapByOrder.get(o.id) || {};
            const methodKey = payInfo.method_key || 'cod';
            return {
              id: o.order_code || o.id,
              dbId: o.id,
              storeId: o.store_id || '',
              buyerId: o.user_id || undefined,
              customerName: typeof o.customer_name === 'string' ? o.customer_name : 'Customer',
              phoneNumber: typeof o.phone_number === 'string' ? o.phone_number : '',
              deliveryAddress: typeof o.delivery_address === 'string' ? o.delivery_address : '',
              notes: o.notes || undefined,
              items: itemsMap.get(o.id) || [],
              currency: o.currency || 'PHP',
              subtotal: Number(o.subtotal || 0),
              deliveryFee: Number(o.delivery_fee || 0),
              taxAmount: Number(o.tax_amount || 0),
              serviceChargeAmount: Number(o.service_charge_amount || 0),
              grandTotal: Number(o.grand_total || 0),
              paymentMethod: payInfo.method_label || (methodKey === 'gcash' ? 'GCash' : methodKey === 'maya' ? 'Maya' : methodKey === 'bank' ? 'Bank Transfer' : 'Cash on Delivery'),
              paymentMethodKey: methodKey,
              paymentStatus: payInfo.payment_status || 'unpaid',
              paymentReferenceNumber: payInfo.reference_number || undefined,
              paymentProofUrl: payInfo.payment_proof_url || undefined,
              amountPaid: Number(payInfo.amount_paid || 0),
              status: o.status || 'pending',
              createdAt: o.created_at || new Date().toISOString(),
              updatedAt: o.updated_at || o.created_at || new Date().toISOString(),
            };
          });

          const userEmailMap = new Map<string, { name: string; email: string }>();
          (dbUsers || []).forEach((u: any) =>
            userEmailMap.set(u.id, {
              name: typeof u.name === 'string' && u.name.trim() ? u.name : 'Merchant',
              email: typeof u.email === 'string' ? u.email : '',
            })
          );

          const mappedSubs: SubscriptionTransaction[] = (dbSubs || []).map((sub: any) => {
            const uInfo = userEmailMap.get(sub.user_id) || { name: 'Merchant', email: '' };
            return {
              id: sub.id,
              referenceId: sub.reference_id || sub.id || '',
              userId: sub.user_id || '',
              userName: uInfo.name,
              userEmail: uInfo.email,
              planId: sub.plan_id === 'starter' ? 'starter' : 'pro',
              amount: Number(sub.amount || 0),
              paymentMethod: sub.payment_method || 'GCash',
              status: sub.status || 'pending',
              dueDate: sub.due_date || undefined,
              periodStart: sub.period_start || undefined,
              periodEnd: sub.period_end || undefined,
              proofUrl: sub.proof_url || undefined,
              approvedBy: sub.approved_by || undefined,
              approvedAt: sub.approved_at || undefined,
              createdAt: sub.created_at || new Date().toISOString(),
              updatedAt: sub.updated_at || undefined,
            };
          });

          const proPriceRow = (dbChannels || []).find(
            (ch: any) => ch.id === PRO_PLAN_PRICE_ROW_ID
          );
          const parsedProPrice = Number(proPriceRow?.account_number);
          const hydratedProPrice =
            Number.isFinite(parsedProPrice) && parsedProPrice >= 1 && parsedProPrice <= 1_000_000
              ? Math.round(parsedProPrice * 100) / 100
              : undefined;

          const mappedChannels: PlatformPaymentChannel[] = (dbChannels || [])
            .filter((ch: any) => ch.id !== PRO_PLAN_PRICE_ROW_ID)
            .map((ch: any) => ({
              id: ch.id,
              type: ch.channel_type || 'ewallet',
              label: ch.label || 'Payment Channel',
              subtitle: ch.subtitle || '',
              enabled: Boolean(ch.is_enabled),
              requiresReceipt: Boolean(ch.requires_receipt),
              accountName: ch.account_name || '',
              numberLabel: ch.number_label || 'Account Number',
              accountNumber: ch.account_number || '',
              note: ch.note || undefined,
              qrImageUrl: ch.qr_image_url || undefined,
              sortOrder: ch.sort_order || 0,
            }));

          const mappedNotifications: AppNotification[] = (dbNotifications || []).map((n: any) => ({
            id: n.id,
            userId: n.user_id || '',
            storeId: n.store_id || undefined,
            orderId: n.order_id || undefined,
            subscriptionId: n.subscription_id || undefined,
            notificationKey: n.notification_key || undefined,
            category: n.category || 'system',
            title: n.title || '',
            message: n.message || '',
            targetPath: n.target_path || '/dashboard',
            isRead: Boolean(n.is_read),
            readAt: n.read_at || undefined,
            isDismissed: Boolean(n.is_dismissed),
            dismissedAt: n.dismissed_at || undefined,
            createdAt: n.created_at || new Date().toISOString(),
            updatedAt: n.updated_at || undefined,
          }));

          const mappedBuyers: BuyerAccount[] = (dbUsers || [])
            .filter((u: any) => resolveUserRole(u).role === Roles.Buyer)
            .map((u: any) => ({
              id: u.id,
              name: typeof u.name === 'string' && u.name.trim() ? u.name : (u.email || 'Customer'),
              email: typeof u.email === 'string' ? u.email : '',
              role: Roles.Buyer,
              roleId: 3 as const,
              storeId: u.registered_store_id || undefined,
              savedCheckoutInfo:
                u.phone_number || u.address
                  ? {
                      fullName: u.name || 'Customer',
                      phoneNumber: u.phone_number || '',
                      deliveryAddress: u.address || '',
                      notes: u.delivery_notes || undefined,
                      preferredPaymentMethod: u.preferred_payment_method || undefined,
                      updatedAt: u.checkout_info_updated_at || u.updated_at || u.created_at || new Date().toISOString(),
                    }
                  : undefined,
              createdAt: u.created_at || new Date().toISOString(),
              updatedAt: u.updated_at || undefined,
            }));

          const { data: latestSessionData } = await client!.auth.getSession();
          const latestSessionUserId = latestSessionData?.session?.user?.id;
          if (hasSession && latestSessionUserId !== sessionUserId) {
            return;
          }

          let currentSessionUser = sessionUserId
            ? mappedUsers.find((u) => u.id === sessionUserId) || null
            : null;
          let currentSessionBuyer = sessionUserId
            ? mappedBuyers.find((b) => b.id === sessionUserId) || null
            : null;

          // If Supabase Auth has an active session for a seller/admin whose public.users row is missing
          // or temporarily unreadable (e.g., RLS / replication delay), construct a resilient session profile
          // so reloading never logs them out onto the landing page.
          let fallbackAuthUser: User | null = null;
          let fallbackAuthBuyer: BuyerAccount | null = null;
          if (hasSession && sessionUserId && !currentSessionUser && !currentSessionBuyer && activeSession?.user) {
            const authUser = activeSession.user;
            const metaRole = resolveUserRole({
              role_id: authUser.app_metadata?.role_id ?? authUser.user_metadata?.role_id,
              role: authUser.app_metadata?.role ?? authUser.user_metadata?.role,
              account_type: authUser.user_metadata?.account_type,
              registered_store_id: authUser.user_metadata?.registered_store_id,
            });
            const isExplicitBuyer =
              authUser.user_metadata?.account_type === 'buyer' ||
              Boolean(authUser.user_metadata?.registered_store_id) ||
              (authUser.user_metadata?.role === 'buyer' || authUser.app_metadata?.role === 'buyer');
            const emailStr = typeof authUser.email === 'string' ? authUser.email : '';
            const displayName =
              (typeof authUser.user_metadata?.name === 'string' && authUser.user_metadata.name.trim()) ||
              (emailStr ? emailStr.split('@')[0] : 'Merchant');
            const nowIso = new Date().toISOString();

            if (isExplicitBuyer) {
              fallbackAuthBuyer = {
                id: sessionUserId,
                name: displayName,
                email: emailStr,
                role: Roles.Buyer,
                roleId: 3,
                storeId: authUser.user_metadata?.registered_store_id || undefined,
                createdAt: authUser.created_at || nowIso,
                updatedAt: nowIso,
              };
            } else {
              const resolvedFallbackRole =
                metaRole.role === Roles.Admin ? Roles.Admin : Roles.Seller;
              const resolvedFallbackRoleId: 1 | 2 = resolvedFallbackRole === Roles.Admin ? 1 : 2;
              fallbackAuthUser = {
                id: sessionUserId,
                name: displayName,
                email: emailStr,
                role: resolvedFallbackRole,
                roleId: resolvedFallbackRoleId,
                plan: resolvedFallbackRole === Roles.Admin ? 'pro' : 'starter',
                status: 'active',
                lastActiveAt: nowIso,
                createdAt: authUser.created_at || nowIso,
                updatedAt: nowIso,
              };

              if (!usersFetchFailed && resolvedFallbackRole === Roles.Seller) {
                client!
                  .from('users')
                  .upsert(toDbUserRow(fallbackAuthUser) as any, { onConflict: 'id' })
                  .then();
              }
            }
          }

          setState((prev) => {
            let nextCurrentUser: User | null = null;
            if (currentSessionUser) {
              nextCurrentUser =
                currentSessionUser.role === Roles.Admin || currentSessionUser.role === Roles.Seller
                  ? currentSessionUser
                  : null;
            } else if (hasSession && sessionUserId && prev.currentUser?.id === sessionUserId) {
              nextCurrentUser = prev.currentUser;
            } else if (fallbackAuthUser) {
              nextCurrentUser = fallbackAuthUser;
            }

            let nextCurrentBuyer: BuyerAccount | null = currentSessionBuyer;
            if (!nextCurrentBuyer && hasSession && sessionUserId && prev.currentBuyer?.id === sessionUserId) {
              nextCurrentBuyer = prev.currentBuyer;
            } else if (!nextCurrentBuyer && fallbackAuthBuyer) {
              nextCurrentBuyer = fallbackAuthBuyer;
            }

            const resolvedUserId =
              nextCurrentUser?.id ?? nextCurrentBuyer?.id ?? sessionUserId ?? null;
            let nextReadNotificationIds: string[] = [];
            let nextDismissedNotificationIds: string[] = [];

            if (resolvedUserId) {
              const localNotif = loadLocalNotificationState(resolvedUserId);
              const readSet = new Set<string>(localNotif.readIds);
              const dismissedSet = new Set<string>(localNotif.dismissedIds);

              const prevActiveId = prev.currentUser?.id ?? prev.currentBuyer?.id ?? null;
              if (prevActiveId === resolvedUserId) {
                (prev.readNotificationIds ?? []).forEach((id) => readSet.add(id));
                (prev.dismissedNotificationIds ?? []).forEach((id) => dismissedSet.add(id));
              }

              (dbNotifStates || []).forEach((st: any) => {
                if (typeof st.notification_key === 'string' && st.notification_key) {
                  if (st.is_read) readSet.add(st.notification_key);
                  if (st.is_dismissed) {
                    dismissedSet.add(st.notification_key);
                    readSet.add(st.notification_key);
                  }
                }
              });

              mappedNotifications.forEach((n) => {
                if (n.isRead) {
                  readSet.add(n.id);
                  if (n.notificationKey) readSet.add(n.notificationKey);
                }
                if (n.isDismissed) {
                  dismissedSet.add(n.id);
                  readSet.add(n.id);
                  if (n.notificationKey) {
                    dismissedSet.add(n.notificationKey);
                    readSet.add(n.notificationKey);
                  }
                }
              });

              nextReadNotificationIds = Array.from(readSet);
              nextDismissedNotificationIds = Array.from(dismissedSet);
              saveLocalNotificationState(
                resolvedUserId,
                nextReadNotificationIds,
                nextDismissedNotificationIds
              );
            }

            return {
              ...prev,
              users: mappedUsers,
              buyers: mappedBuyers,
              stores: mappedStores,
              products: mappedProducts,
              paymentSettingsByStore,
              placedOrders: mappedOrders,
              subscriptionTransactions: mappedSubs,
              platformPaymentSettings: {
                channels: dbChannels ? mappedChannels : (prev.platformPaymentSettings?.channels || []),
                proMonthlyPrice:
                  hydratedProPrice ??
                  prev.platformPaymentSettings?.proMonthlyPrice ??
                  DEFAULT_PRO_MONTHLY_PRICE,
                updatedAt: new Date().toISOString(),
              },
              notifications: mappedNotifications,
              readNotificationIds: nextReadNotificationIds,
              dismissedNotificationIds: nextDismissedNotificationIds,
              currentUser: nextCurrentUser,
              currentBuyer: nextCurrentBuyer,
            };
          });
        } catch (err) {
          console.error('Error hydrating from Supabase:', err);
        } finally {
          if (isInitialHydrationRef.current) {
            isInitialHydrationRef.current = false;
            if (authSafetyTimer !== undefined && typeof window !== 'undefined') {
              window.clearTimeout(authSafetyTimer);
            }
            setIsAuthChecking(false);
            setIsHydrating(false);
          }
        }
      }

      hydrateSessionRef.current = hydrateFromSupabase;
      let lastHydrateAt = Date.now();
      hydrateFromSupabase();

      const handleFocusOrVisible = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        if (authValidationLockRef.current) return;
        const now = Date.now();
        if (now - lastHydrateAt < 5000) return;
        lastHydrateAt = now;
        hydrateFromSupabase();
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('focus', handleFocusOrVisible);
      }
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleFocusOrVisible);
      }

      const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
        if (authValidationLockRef.current) {
          return;
        }
        if (event === 'SIGNED_OUT' || !session) {
          setState((prev) => ({
            ...prev,
            currentUser: null,
            currentBuyer: null,
            notifications: [],
            readNotificationIds: [],
            dismissedNotificationIds: [],
            placedOrders: [],
            subscriptionTransactions: [],
          }));
        } else if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED' ||
          (event === 'INITIAL_SESSION' && session && !activeUserIdRef.current)
        ) {
          lastHydrateAt = Date.now();
          hydrateFromSupabase(session);
        }
      });

      return () => {
        if (authSafetyTimer !== undefined && typeof window !== 'undefined') {
          window.clearTimeout(authSafetyTimer);
        }
        hydrateSessionRef.current = null;
        authListener?.subscription?.unsubscribe();
        if (typeof window !== 'undefined') {
          window.removeEventListener('focus', handleFocusOrVisible);
        }
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleFocusOrVisible);
        }
      };
    }, []);

  const navigate = useCallback(
    (next: AppRoute, options?: { replace?: boolean }) => {
      const nextPath = buildRoutePath(next);
      const currentPath = buildRoutePath(route);
      if (!options?.replace && currentPath !== nextPath) {
        setRouteHistory((prev) => [...prev.slice(-19), route]);
      }
      if (
        typeof window !== 'undefined' &&
        `${window.location.pathname}${window.location.search}` !== nextPath
      ) {
        if (options?.replace) {
          window.history.replaceState({}, '', nextPath);
        } else {
          window.history.pushState({}, '', nextPath);
        }
      }
      setRoute(next);
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [route]
  );

  const goBack = useCallback(
    (fallback: AppRoute = { name: 'dashboard' }) => {
      const previous = routeHistory[routeHistory.length - 1];
      if (previous) {
        setRouteHistory((prev) => prev.slice(0, -1));
        const prevPath = buildRoutePath(previous);
        if (
          typeof window !== 'undefined' &&
          `${window.location.pathname}${window.location.search}` !== prevPath
        ) {
          window.history.pushState({}, '', prevPath);
        }
        setRoute(previous);
        window.scrollTo({ top: 0, behavior: 'auto' });
        return;
      }
      navigate(fallback);
    },
    [routeHistory, navigate]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = generateId('tst');
      setToasts((prev) => [...prev, { ...toast, id }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 3600);
    },
    [dismissToast]
  );

  const notifySync = useCallback(
    (promise: Promise<{ success: boolean; error?: string }>) => {
      promise.then((res) => {
        if (!res.success && res.error) {
          pushToast({
            type: 'error',
            title: 'Database Error',
            description: res.error,
          });
        }
      });
    },
    [pushToast]
  );

  const signUpUser = useCallback(
    async (
      name: string,
      email: string,
      password: string
    ): Promise<{ success: boolean; user?: User; requiresEmailConfirmation?: boolean; error?: string; isSystemError?: boolean }> => {
      const cleanName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();

      if (!cleanName || cleanName.length < 2) {
        return { success: false, error: 'Please enter your full name.' };
      }
      if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      if (!password || password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }

      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.configured) {
        return { success: false, error: configStatus.reason, isSystemError: true };
      }

      const client = getSupabaseClient();
      if (!client) {
        return {
          success: false,
          error: 'Unable to initialize database connection.',
          isSystemError: true,
        };
      }

      authValidationLockRef.current = true;
      try {
        const { data: authData, error: authError } = await client.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name: cleanName,
              account_type: 'seller',
            },
          },
        });

        if (authError) {
          const formatted = formatAuthError(authError.message);
          return { success: false, error: formatted.message, isSystemError: formatted.isSystemError };
        }

        if (!authData.user?.id) {
          return { success: false, error: 'Unable to create account. Please try again.', isSystemError: true };
        }

        if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
          return {
            success: false,
            error: 'An account with this email address already exists. Please sign in instead.',
            isSystemError: false,
          };
        }

        const authId = authData.user.id;
        const now = new Date().toISOString();

        // Ensure user row exists in public.users table with Seller role (role_id = 2)
        const userRow = {
          id: authId,
          role_id: 2, // seller
          name: cleanName,
          email: normalizedEmail,
          plan: 'starter',
          status: 'active',
          last_active_at: now,
          created_at: now,
          updated_at: now,
        };

        const { error: dbError } = await client
          .from('users')
          .insert(userRow as any);
        if (dbError) {
          console.error('Supabase users table insert error:', dbError);
          if (authData.session) {
            const { data: existingRow } = await client
              .from('users')
              .select('role_id, role')
              .eq('id', authId)
              .maybeSingle();
            if (existingRow && resolveUserRole(existingRow).role !== Roles.Seller) {
              await client.auth.signOut();
              return {
                success: false,
                error: 'An account with this email address already exists under another role.',
                isSystemError: false,
              };
            }
            if (!existingRow) {
              await client.auth.signOut();
              return {
                success: false,
                error: `Database Error (public.users): ${dbError.message}`,
                isSystemError: true,
              };
            }
          }
        }

        const newUser: User = {
          id: authId,
          name: cleanName,
          email: normalizedEmail,
          role: Roles.Seller,
          roleId: 2,
          plan: 'starter',
          status: 'active',
          lastActiveAt: now,
          createdAt: now,
          updatedAt: now,
        };

        if (authData.session === null) {
          return {
            success: true,
            requiresEmailConfirmation: true,
            user: newUser,
          };
        }

        const localNotif = loadLocalNotificationState(newUser.id);
        setState((prev) => ({
          ...prev,
          currentBuyer: null,
          currentUser: newUser,
          readNotificationIds: localNotif.readIds,
          dismissedNotificationIds: localNotif.dismissedIds,
          users: [newUser, ...(prev.users ?? []).filter((u) => u.id !== newUser.id)],
        }));

        authValidationLockRef.current = false;
        hydrateSessionRef.current?.(authData.session);
        return { success: true, user: newUser };
      } catch (err: any) {
        return {
          success: false,
          error: `Database connection error: ${err?.message || 'Unable to sign up.'}`,
          isSystemError: true,
        };
      } finally {
        authValidationLockRef.current = false;
      }
    },
    []
  );

  const signInUser = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ success: boolean; user?: User; error?: string; isSystemError?: boolean }> => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      if (!password) {
        return { success: false, error: 'Please enter your password.' };
      }

      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.configured) {
        return { success: false, error: configStatus.reason, isSystemError: true };
      }

      const client = getSupabaseClient();
      if (!client) {
        return {
          success: false,
          error: 'Unable to initialize database connection.',
          isSystemError: true,
        };
      }

      authValidationLockRef.current = true;
      try {
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (authError) {
          const formatted = formatAuthError(authError.message);
          return { success: false, error: formatted.message, isSystemError: formatted.isSystemError };
        }

        if (!authData.user?.id) {
          return { success: false, error: 'No account record returned from database.', isSystemError: true };
        }

        const authId = authData.user.id;
        const { data: dbUser, error: dbErr } = await client
          .from('users')
          .select('*')
          .eq('id', authId)
          .maybeSingle();

        if (dbErr) {
          await client.auth.signOut();
          setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
          return { success: false, error: `Database Error: ${dbErr.message}`, isSystemError: true };
        }

        const now = new Date().toISOString();
        let resolvedRow = dbUser;

        if (!resolvedRow) {
          const accountType = authData.user.user_metadata?.account_type;
          const hasRegisteredStore = Boolean(authData.user.user_metadata?.registered_store_id);
          if (accountType === 'buyer' || hasRegisteredStore) {
            await client.auth.signOut();
            setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
            return {
              success: false,
              error: 'Customer accounts cannot sign in on the main website. Please sign in through a store page instead.',
              isSystemError: false,
            };
          }

          const displayName = authData.user.user_metadata?.name || normalizedEmail.split('@')[0];
          const fallbackUser: User = {
            id: authId,
            name: displayName,
            email: normalizedEmail,
            role: Roles.Seller,
            roleId: 2,
            plan: 'starter',
            status: 'active',
            lastActiveAt: now,
            createdAt: now,
            updatedAt: now,
          };
          const { data: createdRow, error: insertErr } = await client
            .from('users')
            .insert(toDbUserRow(fallbackUser) as any)
            .select('*')
            .maybeSingle();

          if (insertErr?.code === '23505') {
            const { data: existingRow } = await client
              .from('users')
              .select('*')
              .eq('id', authId)
              .maybeSingle();
            resolvedRow = existingRow;
          } else if (insertErr || !createdRow) {
            await client.auth.signOut();
            setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
            return {
              success: false,
              error: `Database Error (public.users): ${insertErr?.message || 'Account profile could not be read or created. Check RLS policies on public.users.'}`,
              isSystemError: true,
            };
          } else {
            resolvedRow = createdRow;
          }
        }

        const resolvedSignInRole = resolvedRow ? resolveUserRole(resolvedRow) : null;
        if (!resolvedRow || !resolvedSignInRole || (resolvedSignInRole.role !== Roles.Admin && resolvedSignInRole.role !== Roles.Seller)) {
          await client.auth.signOut();
          setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
          return {
            success: false,
            error: 'Customer accounts cannot sign in on the main website. Please sign in through a store page instead.',
            isSystemError: false,
          };
        }

        const activeUser: User = {
          id: resolvedRow.id,
          name: resolvedRow.name || authData.user.user_metadata?.name || normalizedEmail.split('@')[0],
          email: resolvedRow.email || normalizedEmail,
          role: resolvedSignInRole.role,
          roleId: resolvedSignInRole.roleId,
          plan: resolvedRow.plan || 'starter',
          status: resolvedRow.status || 'active',
          restrictedReason: resolvedRow.restricted_reason || undefined,
          cancelAtPeriodEnd: resolvedRow.cancel_at_period_end || false,
          planPeriodEndsAt: resolvedRow.plan_period_ends_at || undefined,
          phoneNumber: resolvedRow.phone_number || undefined,
          address: resolvedRow.address || undefined,
          deliveryNotes: resolvedRow.delivery_notes || undefined,
          preferredPaymentMethod: resolvedRow.preferred_payment_method || undefined,
          checkoutInfoUpdatedAt: resolvedRow.checkout_info_updated_at || undefined,
          registeredStoreId: resolvedRow.registered_store_id || undefined,
          lastActiveAt: now,
          createdAt: resolvedRow.created_at || now,
          updatedAt: resolvedRow.updated_at || now,
        };
        client.from('users').update({ last_active_at: now }).eq('id', authId).then();

        const localNotif = loadLocalNotificationState(activeUser.id);
        setState((prev) => ({
          ...prev,
          currentBuyer: null,
          currentUser: activeUser,
          readNotificationIds: localNotif.readIds,
          dismissedNotificationIds: localNotif.dismissedIds,
          users: [activeUser, ...(prev.users ?? []).filter((u) => u.id !== activeUser.id)],
        }));

        authValidationLockRef.current = false;
        hydrateSessionRef.current?.(authData.session);
        return { success: true, user: activeUser };
      } catch (err: any) {
        return {
          success: false,
          error: `Database connection error: ${err?.message || 'Sign in failed.'}`,
          isSystemError: true,
        };
      } finally {
        authValidationLockRef.current = false;
      }
    },
    []
  );

  const signInAdminUser = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string; isSystemError?: boolean }> => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
        return { success: false, error: 'Please enter a valid admin email address.' };
      }
      if (!password) {
        return { success: false, error: 'Please enter your admin password.' };
      }

      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.configured) {
        return { success: false, error: configStatus.reason, isSystemError: true };
      }

      const client = getSupabaseClient();
      if (!client) {
        return {
          success: false,
          error: 'Unable to initialize database connection.',
          isSystemError: true,
        };
      }

      authValidationLockRef.current = true;
      try {
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (authError) {
          const formatted = formatAuthError(authError.message);
          return { success: false, error: formatted.message, isSystemError: formatted.isSystemError };
        }

        if (!authData.user?.id) {
          return { success: false, error: 'No administrator record returned from database.', isSystemError: true };
        }

        const authId = authData.user.id;
        const { data: dbUser, error: dbErr } = await client
          .from('users')
          .select('*')
          .eq('id', authId)
          .maybeSingle();

        if (dbErr) {
          await client.auth.signOut();
          setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
          return { success: false, error: `Database Error: ${dbErr.message}`, isSystemError: true };
        }

        const resolvedAdminRole = dbUser ? resolveUserRole(dbUser) : null;
        if (!dbUser || resolvedAdminRole?.role !== Roles.Admin) {
          const isBuyerRole =
            resolvedAdminRole?.role === Roles.Buyer ||
            authData.user.user_metadata?.account_type === 'buyer';
          await client.auth.signOut();
          setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
          return {
            success: false,
            error: isBuyerRole
              ? 'Access denied: Customer accounts cannot sign in to the Admin Console.'
              : 'Access denied: This account does not have administrator privileges.',
            isSystemError: false,
          };
        }

        const now = new Date().toISOString();
        const adminUser: User = {
          id: dbUser.id,
          name: dbUser.name || 'Admin',
          email: dbUser.email || normalizedEmail,
          role: Roles.Admin,
          roleId: 1,
          plan: 'pro',
          status: 'active',
          lastActiveAt: now,
          createdAt: dbUser.created_at || now,
          updatedAt: dbUser.updated_at || now,
        };

        client.from('users').update({ last_active_at: now }).eq('id', authId).then();

        const localNotif = loadLocalNotificationState(adminUser.id);
        setState((prev) => ({
          ...prev,
          currentBuyer: null,
          currentUser: adminUser,
          readNotificationIds: localNotif.readIds,
          dismissedNotificationIds: localNotif.dismissedIds,
          users: [adminUser, ...(prev.users ?? []).filter((u) => u.id !== adminUser.id)],
        }));

        authValidationLockRef.current = false;
        hydrateSessionRef.current?.(authData.session);
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: `Database connection error: ${err?.message || 'Failed to authenticate admin account.'}`,
          isSystemError: true,
        };
      } finally {
        authValidationLockRef.current = false;
      }
    },
    []
  );

  const resetUserPassword = useCallback(
    async (email: string, newPassword: string): Promise<{ success: boolean; error?: string; isSystemError?: boolean }> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !newPassword || newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }

      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.configured) {
        return { success: false, error: configStatus.reason, isSystemError: true };
      }

      const client = getSupabaseClient();
      if (!client) {
        return { success: false, error: 'Database client not initialized.', isSystemError: true };
      }

      try {
        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) {
          const formatted = formatAuthError(error.message);
          return { success: false, error: formatted.message, isSystemError: formatted.isSystemError };
        }
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: `Database connection error: ${err?.message || 'Password update failed.'}`,
          isSystemError: true,
        };
      }
    },
    []
  );

  const signOut = useCallback(() => {
    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      if (client) {
        client.auth.signOut().catch((err) => console.error('Supabase sign-out error:', err));
      }
    }
    setState((prev) => ({
      ...prev,
      currentUser: null,
      notifications: [],
      readNotificationIds: [],
      dismissedNotificationIds: [],
    }));
  }, []);

  const buyerSignUp = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      storeId?: string;
      storeName?: string;
    }): Promise<{ success: boolean; buyer?: BuyerAccount; requiresEmailConfirmation?: boolean; error?: string; isSystemError?: boolean }> => {
      const cleanName = input.name.trim();
      const cleanEmail = input.email.trim().toLowerCase();

      if (!cleanName || cleanName.length < 2) {
        return { success: false, error: 'Please enter your full name.' };
      }
      if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      if (!input.password || input.password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }

      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.configured) {
        return { success: false, error: configStatus.reason, isSystemError: true };
      }

      const client = getSupabaseClient();
      if (!client) {
        return {
          success: false,
          error: 'Unable to initialize database connection.',
          isSystemError: true,
        };
      }

      authValidationLockRef.current = true;
      try {
        const { data: authData, error: authError } = await client.auth.signUp({
          email: cleanEmail,
          password: input.password,
          options: {
            data: {
              name: cleanName,
              account_type: 'buyer',
              registered_store_id: input.storeId || null,
            },
          },
        });

        if (authError) {
          const formatted = formatAuthError(authError.message);
          return { success: false, error: formatted.message, isSystemError: formatted.isSystemError };
        }

        if (!authData.user?.id) {
          return { success: false, error: 'Unable to create account. Please try again.', isSystemError: true };
        }

        if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
          return {
            success: false,
            error: 'An account with this email address already exists. Please sign in instead.',
            isSystemError: false,
          };
        }

        const authId = authData.user.id;
        const now = new Date().toISOString();

        const buyerRow = {
          id: authId,
          role_id: 3, // buyer
          name: cleanName,
          email: cleanEmail,
          status: 'active',
          registered_store_id: input.storeId || null,
          last_active_at: now,
          created_at: now,
          updated_at: now,
        };

        const { error: dbError } = await client
          .from('users')
          .insert(buyerRow as any);
        if (dbError) {
          console.error('Supabase buyer insert error:', dbError);
          if (authData.session) {
            const { data: existingRow } = await client
              .from('users')
              .select('role_id, role')
              .eq('id', authId)
              .maybeSingle();
            if (existingRow && resolveUserRole(existingRow).role !== Roles.Buyer) {
              await client.auth.signOut();
              setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
              return {
                success: false,
                error: 'Merchant and admin accounts cannot register as a customer account.',
                isSystemError: false,
              };
            }
            if (!existingRow) {
              await client.auth.signOut();
              setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
              return {
                success: false,
                error: `Database Error (public.users): ${dbError.message}`,
                isSystemError: true,
              };
            }
          }
        }

        const newBuyer: BuyerAccount = {
          id: authId,
          name: cleanName,
          email: cleanEmail,
          role: Roles.Buyer,
          roleId: 3,
          storeId: input.storeId,
          storeName: input.storeName,
          createdAt: now,
          updatedAt: now,
        };

        if (authData.session === null) {
          return {
            success: true,
            requiresEmailConfirmation: true,
            buyer: newBuyer,
          };
        }

        setState((prev) => ({
          ...prev,
          currentUser: null,
          buyers: [...(prev.buyers ?? []).filter((b) => b.id !== authId), newBuyer],
          currentBuyer: newBuyer,
        }));

        authValidationLockRef.current = false;
        hydrateSessionRef.current?.(authData.session);
        return { success: true, buyer: newBuyer };
      } catch (err: any) {
        return {
          success: false,
          error: `Database connection error: ${err?.message || 'Failed to create customer account.'}`,
          isSystemError: true,
        };
      } finally {
        authValidationLockRef.current = false;
      }
    },
    []
  );

  const buyerSignIn = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ success: boolean; buyer?: BuyerAccount; error?: string; isSystemError?: boolean }> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      if (!password) {
        return { success: false, error: 'Please enter your password.' };
      }

      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.configured) {
        return { success: false, error: configStatus.reason, isSystemError: true };
      }

      const client = getSupabaseClient();
      if (!client) {
        return {
          success: false,
          error: 'Unable to initialize database connection.',
          isSystemError: true,
        };
      }

      authValidationLockRef.current = true;
      try {
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (authError) {
          const formatted = formatAuthError(authError.message);
          return { success: false, error: formatted.message, isSystemError: formatted.isSystemError };
        }

        if (!authData.user?.id) {
          return { success: false, error: 'No account record returned from database.', isSystemError: true };
        }

        const authId = authData.user.id;
        const { data: dbUser, error: dbErr } = await client
          .from('users')
          .select('*')
          .eq('id', authId)
          .maybeSingle();

        if (dbErr) {
          await client.auth.signOut();
          setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
          return { success: false, error: `Database Error: ${dbErr.message}`, isSystemError: true };
        }

        const now = new Date().toISOString();
        let activeDbBuyer = dbUser;

        if (!activeDbBuyer) {
          const accountType = authData.user.user_metadata?.account_type;
          if (accountType && accountType !== 'buyer') {
            await client.auth.signOut();
            setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
            return {
              success: false,
              error: 'Invalid user credentials or the user is not existing',
              isSystemError: false,
            };
          }

          const displayName = authData.user.user_metadata?.name || cleanEmail.split('@')[0];
          const fallbackBuyer: BuyerAccount = {
            id: authId,
            name: displayName,
            email: cleanEmail,
            role: Roles.Buyer,
            roleId: 3,
            createdAt: now,
            updatedAt: now,
          };
          const { data: createdBuyerRow, error: buyerInsertErr } = await client
            .from('users')
            .insert(toDbUserRow(fallbackBuyer) as any)
            .select('*')
            .maybeSingle();

          if (buyerInsertErr?.code === '23505') {
            const { data: existingRow } = await client
              .from('users')
              .select('*')
              .eq('id', authId)
              .maybeSingle();
            activeDbBuyer = existingRow;
          } else if (buyerInsertErr || !createdBuyerRow) {
            await client.auth.signOut();
            setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
            return {
              success: false,
              error: `Database Error (public.users): ${buyerInsertErr?.message || 'Account profile could not be read or created.'}`,
              isSystemError: true,
            };
          } else {
            activeDbBuyer = createdBuyerRow;
          }
        }

        // Strict role enforcement: storefront customer login only allows Buyer role
        if (!activeDbBuyer || resolveUserRole(activeDbBuyer).role !== Roles.Buyer) {
          await client.auth.signOut();
          setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
          return {
            success: false,
            error: 'Invalid user credentials or the user is not existing',
            isSystemError: false,
          };
        }

        if (activeDbBuyer.status === 'restricted') {
          await client.auth.signOut();
          setState((prev) => ({ ...prev, currentUser: null, currentBuyer: null }));
          return {
            success: false,
            error: activeDbBuyer.restricted_reason || 'This customer account has been restricted.',
            isSystemError: false,
          };
        }

        const buyer: BuyerAccount = {
          id: authId,
          name: activeDbBuyer.name || authData.user.user_metadata?.name || cleanEmail.split('@')[0],
          email: activeDbBuyer.email || cleanEmail,
          role: Roles.Buyer,
          roleId: 3,
          storeId: activeDbBuyer.registered_store_id || undefined,
          savedCheckoutInfo:
            activeDbBuyer.phone_number || activeDbBuyer.address
              ? {
                  fullName: activeDbBuyer.name,
                  phoneNumber: activeDbBuyer.phone_number || '',
                  deliveryAddress: activeDbBuyer.address || '',
                  notes: activeDbBuyer.delivery_notes || undefined,
                  preferredPaymentMethod: activeDbBuyer.preferred_payment_method || undefined,
                  updatedAt: activeDbBuyer.checkout_info_updated_at || now,
                }
              : undefined,
          createdAt: activeDbBuyer.created_at || now,
          updatedAt: activeDbBuyer.updated_at || now,
        };

        client.from('users').update({ last_active_at: now }).eq('id', authId).then();

        setState((prev) => ({
          ...prev,
          currentUser: null,
          currentBuyer: buyer,
          buyers: [...(prev.buyers ?? []).filter((b) => b.id !== authId), buyer],
        }));

        authValidationLockRef.current = false;
        hydrateSessionRef.current?.(authData.session);
        return { success: true, buyer };
      } catch (err: any) {
        return {
          success: false,
          error: `Database connection error: ${err?.message || 'Failed to sign in.'}`,
          isSystemError: true,
        };
      } finally {
        authValidationLockRef.current = false;
      }
    },
    []
  );

  const buyerResetPassword = useCallback(
    async (email: string, newPassword: string): Promise<{ success: boolean; error?: string; isSystemError?: boolean }> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !newPassword || newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }

      const configStatus = getSupabaseConfigStatus();
      if (!configStatus.configured) {
        return { success: false, error: configStatus.reason, isSystemError: true };
      }

      const client = getSupabaseClient();
      if (!client) {
        return { success: false, error: 'Database client not initialized.', isSystemError: true };
      }

      try {
        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) {
          const formatted = formatAuthError(error.message);
          return { success: false, error: formatted.message, isSystemError: formatted.isSystemError };
        }
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: `Database connection error: ${err?.message || 'Password update failed.'}`,
          isSystemError: true,
        };
      }
    },
    []
  );

  const buyerSignOut = useCallback(() => {
    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      if (client) {
        client.auth.signOut().catch((err) => console.error('Supabase buyer sign-out error:', err));
      }
    }
    setState((prev) => ({ ...prev, currentBuyer: null }));
  }, []);

  const getBuyerOrders = useCallback(() => {
    if (!state.currentBuyer) return [];
    return (state.placedOrders ?? []).filter(
      (o) => o.buyerId === state.currentBuyer?.id
    );
  }, [state.currentBuyer, state.placedOrders]);

  const getBuyerCheckoutInfo = useCallback((): BuyerCheckoutInfo | null => {
    if (!state.currentBuyer) return null;
    return state.currentBuyer.savedCheckoutInfo ?? null;
  }, [state.currentBuyer]);

  const saveBuyerCheckoutInfo = useCallback(
    (info: Omit<BuyerCheckoutInfo, 'updatedAt'>): BuyerCheckoutInfo | null => {
      if (!state.currentBuyer) return null;
      const saved: BuyerCheckoutInfo = {
        fullName: info.fullName.trim(),
        phoneNumber: info.phoneNumber.trim(),
        deliveryAddress: info.deliveryAddress.trim(),
        notes: info.notes?.trim() || undefined,
        preferredPaymentMethod: info.preferredPaymentMethod,
        updatedAt: new Date().toISOString(),
      };

      const now = new Date().toISOString();
      const updatedBuyer: BuyerAccount = {
        ...state.currentBuyer,
        savedCheckoutInfo: saved,
        updatedAt: now,
      };
      setState((prev) => {
        if (!prev.currentBuyer) return prev;
        return {
          ...prev,
          currentBuyer: updatedBuyer,
          buyers: (prev.buyers ?? []).map((b) => (b.id === updatedBuyer.id ? updatedBuyer : b)),
        };
      });

      syncUserToSupabase(updatedBuyer).then((res) => {
        if (!res.success && res.error) {
          pushToast({
            type: 'error',
            title: 'Database Sync Error',
            description: res.error,
          });
        }
      });

      return saved;
    },
    [pushToast, state.currentBuyer]
  );

  const clearBuyerCheckoutInfo = useCallback(() => {
    const now = new Date().toISOString();
    setState((prev) => {
      if (!prev.currentBuyer) return prev;
      const clearedBuyer: BuyerAccount = {
        ...prev.currentBuyer,
        savedCheckoutInfo: undefined,
        updatedAt: now,
      };
      syncUserToSupabase(clearedBuyer).then((res) => {
        if (!res.success && res.error) {
          pushToast({
            type: 'error',
            title: 'Database Sync Error',
            description: res.error,
          });
        }
      });
      return {
        ...prev,
        currentBuyer: clearedBuyer,
        buyers: (prev.buyers ?? []).map((b) => (b.id === clearedBuyer.id ? clearedBuyer : b)),
      };
    });
  }, [pushToast]);

  const updateUserProfile = useCallback(
    (
      updates: Partial<
        Pick<User, 'name' | 'email' | 'plan' | 'planPeriodEndsAt' | 'cancelAtPeriodEnd'>
      >
    ) => {
      const now = new Date().toISOString();
      setState((prev) => {
        if (!prev.currentUser) return prev;
        const updatedUser: User = { ...prev.currentUser, ...updates, updatedAt: now };
        syncUserToSupabase(updatedUser).then((res) => {
          if (!res.success && res.error) {
            pushToast({
              type: 'error',
              title: 'Database Sync Error',
              description: res.error,
            });
          }
        });
        return {
          ...prev,
          currentUser: updatedUser,
          users: (prev.users ?? []).map((u) => (u.id === updatedUser.id ? updatedUser : u)),
        };
      });
    },
    [pushToast]
  );

  const setActiveStore = useCallback((storeId: string | null) => {
    setState((prev) => ({ ...prev, activeStoreId: storeId }));
  }, []);

  const createStore = useCallback(
    async (input: CreateStoreInput): Promise<{ store?: Store; error?: string }> => {
      if (state.currentUser?.status === 'restricted') {
        return {
          error: 'Your merchant account is currently restricted. Contact platform admin.',
        };
      }
      if (isUserPlanPastDue(state.currentUser)) {
        return {
          error: 'Your Pro plan payment is past due. Please settle your due balance before creating a new store.',
        };
      }
      if (!state.currentUser) {
        return { error: 'Please sign in first before creating a store.' };
      }
      if (input.name.trim().length < 2) {
        return { error: 'Store name must be at least 2 characters.' };
      }
      const ownerId = state.currentUser.id;
      const ownerStoreCount = state.stores.filter((s) => s.ownerId === ownerId).length;
      const limits = getPlanLimits(state.currentUser.plan ?? 'starter');
      if (ownerStoreCount >= limits.maxStores) {
        return {
          error: `Your ${limits.label} plan allows up to ${limits.maxStores} active store${
            limits.maxStores === 1 ? '' : 's'
          }. Upgrade your plan to add more stores.`,
        };
      }
      if (
        isProTemplate(input.templateId) &&
        state.currentUser.plan !== 'pro' &&
        state.currentUser.role !== Roles.Admin
      ) {
        return {
          error: 'Upgrade to Pro to create a store using a Premium Pro template.',
        };
      }

      const existingSlugs = state.stores.map((s) => s.slug);
      let finalSlug: string;

      if (input.customSlug && input.customSlug.trim().length > 0) {
        const validation = validateStoreSlug(input.customSlug, existingSlugs);
        if (!validation.valid) {
          return { error: validation.error };
        }
        finalSlug = validation.normalizedSlug;
      } else {
        finalSlug = generateUniqueStoreSlug(input.name, existingSlugs);
      }

      const now = new Date().toISOString();
      const templateMeta = INDUSTRY_TEMPLATES[input.templateId];
      const newStoreId = generateUuid();

      const newStore: Store = {
        id: newStoreId,
        ownerId,
        name: input.name.trim(),
        slug: finalSlug,
        domainUrl: buildStoreDomainUrl(finalSlug),
        templateId: input.templateId,
        status: input.status ?? 'draft',
        branding: input.branding
          ? {
              ...input.branding,
              backgroundMode: input.branding.backgroundMode ?? 'light',
              buttonStyle: input.branding.buttonStyle ?? 'rounded',
              fontPairing: input.branding.fontPairing ?? 'modern-sans',
              heroCtaLabel: input.branding.heroCtaLabel ?? 'Shop Now',
              logoText: input.branding.logoText?.trim() ?? '',
            }
          : {
              primaryColor: templateMeta.defaultBranding.primaryColor,
              secondaryColor: templateMeta.defaultBranding.secondaryColor,
              accentColor: templateMeta.defaultBranding.accentColor,
              surfaceColor: templateMeta.defaultBranding.surfaceColor,
              textColor: templateMeta.defaultBranding.textColor,
              backgroundMode: templateMeta.defaultBranding.backgroundMode ?? 'light',
              buttonStyle: templateMeta.defaultBranding.buttonStyle ?? 'rounded',
              fontPairing: templateMeta.defaultBranding.fontPairing ?? 'modern-sans',
              logoText: '',
              heroTitle: '',
              heroSubtitle: '',
              heroCtaLabel: '',
              bio: '',
              announcementEnabled: false,
              announcementText: '',
              address: '',
              contactNumber: '',
              socialLinks: {},
            },
        createdAt: now,
        updatedAt: now,
      };

      const defaultPayments = createDefaultPaymentSettings(newStoreId);

      // Step 1: Persist store record first so child tables satisfy FK & RLS cleanly
      const storeRes = await syncStoreToSupabase(newStore);
      if (!storeRes.success) {
        return { error: storeRes.error || 'Could not save store to database.' };
      }

      // Step 2: Dynamically seed checkout & payment settings from app (no DB trigger required)
      const payRes = await syncPaymentSettingsToSupabase(defaultPayments);
      if (!payRes.success) {
        await deleteStoreFromSupabase(newStoreId);
        return {
          error:
            payRes.error ||
            'Could not save default store checkout & payment settings to database.',
        };
      }

      setState((prev) => ({
        ...prev,
        stores: [newStore, ...prev.stores],
        paymentSettingsByStore: {
          ...prev.paymentSettingsByStore,
          [newStoreId]: defaultPayments,
        },
        activeStoreId: newStoreId,
      }));

      return { store: newStore };
    },
    [state.currentUser, state.stores]
  );

  const updateStoreMeta = useCallback(
    async (
      storeId: string,
      updates: {
        name?: string;
        slug?: string;
        status?: Store['status'];
        templateId?: IndustryTemplateId;
        branding?: StoreBranding;
      }
    ): Promise<{ success: boolean; error?: string }> => {
      const target = state.stores.find((s) => s.id === storeId);
      if (!target) {
        return { success: false, error: 'Store not found.' };
      }

      if (updates.name !== undefined && updates.name.trim().length < 2) {
        return { success: false, error: 'Store name must be at least 2 characters.' };
      }

      if (
        target.status === 'restricted' &&
        updates.status === 'published' &&
        state.currentUser?.role !== Roles.Admin
      ) {
        return {
          success: false,
          error: 'This store is restricted by platform admin and cannot be published.',
        };
      }

      if (
        updates.templateId &&
        updates.templateId !== target.templateId &&
        isProTemplate(updates.templateId) &&
        state.currentUser?.plan !== 'pro' &&
        state.currentUser?.role !== Roles.Admin
      ) {
        return {
          success: false,
          error: 'Upgrade to Pro to save and publish using a Premium Pro template.',
        };
      }

      let nextSlug = target.slug;
      if (updates.slug !== undefined) {
        const existingSlugs = state.stores.map((s) => s.slug);
        const validation = validateStoreSlug(updates.slug, existingSlugs, target.slug);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
        nextSlug = validation.normalizedSlug;
      }

      const now = new Date().toISOString();
      const updatedStore: Store = {
        ...target,
        name: updates.name !== undefined ? updates.name.trim() : target.name,
        slug: nextSlug,
        domainUrl: buildStoreDomainUrl(nextSlug),
        status: updates.status ?? target.status,
        templateId: updates.templateId ?? target.templateId,
        branding: updates.branding ? { ...target.branding, ...updates.branding } : target.branding,
        updatedAt: now,
      };

      const res = await syncStoreToSupabase(updatedStore);
      if (!res.success) {
        return { success: false, error: res.error || 'Could not update store in database.' };
      }

      setState((prev) => ({
        ...prev,
        stores: prev.stores.map((s) => (s.id === storeId ? updatedStore : s)),
      }));

      return { success: true };
    },
    [state.currentUser?.plan, state.currentUser?.role, state.stores]
  );

  const updateStoreBranding = useCallback(
    async (
      storeId: string,
      brandingUpdates: Partial<StoreBranding>
    ): Promise<{ success: boolean; error?: string }> => {
      const target = state.stores.find((s) => s.id === storeId);
      if (!target) {
        return { success: false, error: 'Store not found.' };
      }
      const now = new Date().toISOString();
      const updatedStore: Store = {
        ...target,
        branding: { ...target.branding, ...brandingUpdates },
        updatedAt: now,
      };

      const res = await syncStoreToSupabase(updatedStore);
      if (!res.success) {
        return { success: false, error: res.error || 'Could not save store branding.' };
      }

      setState((prev) => ({
        ...prev,
        stores: prev.stores.map((s) => (s.id === storeId ? updatedStore : s)),
      }));
      return { success: true };
    },
    [state.stores]
  );

  const deleteStore = useCallback(async (storeId: string): Promise<{ success: boolean; error?: string }> => {
    const res = await deleteStoreFromSupabase(storeId);
    if (!res.success) {
      return { success: false, error: res.error || 'Could not delete store from database.' };
    }

    setState((prev) => {
      const nextStores = prev.stores.filter((s) => s.id !== storeId);
      const nextProducts = prev.products.filter((p) => p.storeId !== storeId);
      const nextPayments = { ...prev.paymentSettingsByStore };
      delete nextPayments[storeId];
      const nextOrders = (prev.placedOrders ?? []).filter((o) => o.storeId !== storeId);
      return {
        ...prev,
        stores: nextStores,
        products: nextProducts,
        paymentSettingsByStore: nextPayments,
        placedOrders: nextOrders,
        activeStoreId:
          prev.activeStoreId === storeId ? nextStores[0]?.id ?? null : prev.activeStoreId,
      };
    });
    return { success: true };
  }, []);

  const getStoreBySlug = useCallback(
    (slug: string) => state.stores.find((s) => s.slug.toLowerCase() === slug.toLowerCase()),
    [state.stores]
  );

  const getStoreProducts = useCallback(
    (storeId: string) => state.products.filter((p) => p.storeId === storeId),
    [state.products]
  );

  const createProduct = useCallback(
    async (
      input: CreateProductInput
    ): Promise<{ success: boolean; product?: Product; error?: string }> => {
      const now = new Date().toISOString();
      const safeBasePrice = clampNonNegative(input.basePrice);
      const safeCostPrice =
        input.costPrice !== undefined ? clampNonNegative(input.costPrice) : undefined;
      const discountType: DiscountType =
        input.discountType ?? ((input.discountPercent ?? 0) > 0 ? 'percentage' : 'none');
      const rawDiscountValue =
        input.discountValue ?? (discountType === 'percentage' ? input.discountPercent ?? 0 : 0);
      const discountValue =
        discountType === 'percentage'
          ? clampPercent(rawDiscountValue, 95)
          : clampNonNegative(rawDiscountValue);
      const smart = calculateSmartPricing({
        basePrice: safeBasePrice,
        discountType,
        discountValue,
        costPrice: safeCostPrice,
      });

      const storeSkus = new Set(
        state.products
          .filter((p) => p.storeId === input.storeId)
          .map((p) => p.sku.trim().toLowerCase())
      );
      const baseSku =
        input.sku.trim() || `SKU-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      let uniqueSku = baseSku;
      let suffix = 2;
      while (storeSkus.has(uniqueSku.toLowerCase())) {
        uniqueSku = `${baseSku}-${suffix}`;
        suffix += 1;
      }

      const normalizedVariants = (input.variants ?? []).map((v, idx) => ({
        ...v,
        id: isUuid(v.id) ? v.id : generateUuid(),
        stock: clampStock(v.stock),
        sortOrder: v.sortOrder ?? idx,
      }));

      const product: Product = {
        id: generateUuid(),
        storeId: input.storeId,
        name: input.name.trim(),
        description: input.description.trim(),
        category: input.category.trim() || 'General',
        basePrice: safeBasePrice,
        discountType,
        discountValue,
        discountPercent: clampPercent(Math.round(smart.effectiveDiscountPercent), 95),
        costPrice: safeCostPrice,
        finalPrice: clampNonNegative(smart.finalPrice),
        sku: uniqueSku,
        stock: clampStock(input.stock),
        imageUrl: input.imageUrl,
        variants: normalizedVariants,
        isFeatured: input.isFeatured ?? false,
        isAvailable: input.isAvailable ?? true,
        createdAt: now,
        updatedAt: now,
      };

      const res = await syncProductToSupabase(product);
      if (!res.success) {
        return { success: false, error: res.error || 'Could not save product to database.' };
      }

      setState((prev) => ({
        ...prev,
        products: [product, ...prev.products],
      }));

      return { success: true, product };
    },
    [state.products]
  );

  const updateProduct = useCallback(
    async (
      productId: string,
      updates: Partial<Omit<Product, 'id' | 'storeId'>>
    ): Promise<{ success: boolean; error?: string }> => {
      const p = state.products.find((item) => item.id === productId);
      if (!p) {
        return { success: false, error: 'Product not found.' };
      }

      const now = new Date().toISOString();
      const nextBase = clampNonNegative(updates.basePrice ?? p.basePrice);
      const nextDiscountType: DiscountType =
        updates.discountType ??
        p.discountType ??
        ((updates.discountPercent ?? p.discountPercent) > 0 ? 'percentage' : 'none');
      const rawNextDiscountValue =
        updates.discountValue ??
        (updates.discountPercent !== undefined && nextDiscountType === 'percentage'
          ? updates.discountPercent
          : p.discountValue ?? p.discountPercent);
      const nextDiscountValue =
        nextDiscountType === 'percentage'
          ? clampPercent(rawNextDiscountValue, 95)
          : clampNonNegative(rawNextDiscountValue);
      const rawCostPrice = 'costPrice' in updates ? updates.costPrice : p.costPrice;
      const nextCostPrice =
        rawCostPrice !== undefined ? clampNonNegative(rawCostPrice) : undefined;

      const smart = calculateSmartPricing({
        basePrice: nextBase,
        discountType: nextDiscountType,
        discountValue: nextDiscountValue,
        costPrice: nextCostPrice,
      });

      const nextSku =
        updates.sku !== undefined && updates.sku.trim().length > 0
          ? updates.sku.trim()
          : p.sku;

      const nextVariants = updates.variants
        ? updates.variants.map((v, idx) => ({
            ...v,
            id: isUuid(v.id) ? v.id : generateUuid(),
            stock: clampStock(v.stock),
            sortOrder: v.sortOrder ?? idx,
          }))
        : p.variants;

      const updated: Product = {
        ...p,
        ...updates,
        name: updates.name !== undefined ? updates.name.trim() || p.name : p.name,
        category:
          updates.category !== undefined ? updates.category.trim() || 'General' : p.category,
        sku: nextSku,
        stock: updates.stock !== undefined ? clampStock(updates.stock) : p.stock,
        variants: nextVariants,
        basePrice: nextBase,
        discountType: nextDiscountType,
        discountValue: nextDiscountValue,
        discountPercent: clampPercent(Math.round(smart.effectiveDiscountPercent), 95),
        costPrice: nextCostPrice,
        finalPrice: clampNonNegative(smart.finalPrice),
        updatedAt: now,
      };

      const res = await syncProductToSupabase(updated);
      if (!res.success) {
        return { success: false, error: res.error || 'Could not update product in database.' };
      }

      setState((prev) => ({
        ...prev,
        products: prev.products.map((item) => (item.id === productId ? updated : item)),
      }));
      return { success: true };
    },
    [state.products]
  );

  const deleteProduct = useCallback(async (productId: string): Promise<{ success: boolean; error?: string }> => {
    const res = await deleteProductFromSupabase(productId);
    if (!res.success) {
      return { success: false, error: res.error || 'Could not delete product from database.' };
    }
    setState((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }));
    return { success: true };
  }, []);

  const getPaymentSettings = useCallback(
    (storeId: string): PaymentSettings =>
      state.paymentSettingsByStore[storeId] ?? createDefaultPaymentSettings(storeId),
    [state.paymentSettingsByStore]
  );

  const updatePaymentSettings = useCallback(
    async (
      storeId: string,
      updates: Partial<PaymentSettings>
    ): Promise<{ success: boolean; error?: string }> => {
      const now = new Date().toISOString();
      const current =
        state.paymentSettingsByStore[storeId] ?? createDefaultPaymentSettings(storeId);
      const merged: PaymentSettings = {
        ...current,
        ...updates,
        storeId,
        taxPercent: clampPercent(updates.taxPercent ?? current.taxPercent, 100),
        serviceChargePercent: clampPercent(
          updates.serviceChargePercent ?? current.serviceChargePercent ?? 0,
          100
        ),
        shippingFee: clampNonNegative(updates.shippingFee ?? current.shippingFee),
        freeShippingThreshold: clampNonNegative(
          updates.freeShippingThreshold ?? current.freeShippingThreshold
        ),
        updatedAt: now,
      };

      const res = await syncPaymentSettingsToSupabase(merged);
      if (!res.success) {
        return {
          success: false,
          error: res.error || 'Could not save payment settings to database.',
        };
      }

      setState((prev) => ({
        ...prev,
        paymentSettingsByStore: {
          ...prev.paymentSettingsByStore,
          [storeId]: merged,
        },
      }));
      return { success: true };
    },
    [state.paymentSettingsByStore]
  );

  const getStoreOrders = useCallback(
    (storeId: string): CustomerOrder[] =>
      (state.placedOrders ?? []).filter((o) => o.storeId === storeId),
    [state.placedOrders]
  );

  const placeCustomerOrder = useCallback(
    (input: Omit<CustomerOrder, 'id' | 'status' | 'createdAt'>): CustomerOrder => {
      const orderNum = Math.floor(1050 + Math.random() * 8900);
      const nowIso = new Date().toISOString();
      const storeObj = state.stores.find((s) => s.id === input.storeId);
      const storeCheckout =
        state.paymentSettingsByStore[input.storeId] ?? createDefaultPaymentSettings(input.storeId);
      const methodKey = derivePaymentMethodKey(input.paymentMethodKey, input.paymentMethod);
      const initialPaymentStatus = deriveOrderPaymentStatus(methodKey, input.paymentStatus);
      const normalizedItems = input.items.map((item) => ({
        ...item,
        lineTotal:
          item.lineTotal ?? Math.round(clampNonNegative(item.unitPrice) * item.quantity * 100) / 100,
      }));

      const newOrder: CustomerOrder = {
        ...input,
        id: `ORD-${orderNum}`,
        dbId: generateUuid(),
        storeName: storeObj?.name ?? 'Store',
        buyerId: state.currentBuyer?.id,
        phoneNumber: input.phoneNumber.trim(),
        customerName: input.customerName.trim() || state.currentBuyer?.name || 'Customer',
        deliveryAddress: input.deliveryAddress.trim(),
        currency: input.currency ?? storeCheckout.currency ?? 'PHP',
        paymentMethodKey: methodKey,
        paymentStatus: initialPaymentStatus,
        amountPaid: initialPaymentStatus === 'paid' ? input.grandTotal : 0,
        paidAt: initialPaymentStatus === 'paid' ? nowIso : input.paidAt,
        paymentReferenceNumber: input.paymentReferenceNumber?.trim() || undefined,
        items: normalizedItems,
        status: 'Pending',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const qtyByProduct = new Map<string, number>();
      const qtyByVariantKey = new Map<string, number>();

      normalizedItems.forEach((item) => {
        qtyByProduct.set(
          item.productId,
          (qtyByProduct.get(item.productId) ?? 0) + item.quantity
        );
        if (item.variantId) {
          qtyByVariantKey.set(
            `${item.productId}::id::${item.variantId}`,
            (qtyByVariantKey.get(`${item.productId}::id::${item.variantId}`) ?? 0) +
              item.quantity
          );
        } else if (item.variant) {
          qtyByVariantKey.set(
            `${item.productId}::label::${item.variant}`,
            (qtyByVariantKey.get(`${item.productId}::label::${item.variant}`) ?? 0) +
              item.quantity
          );
        }
      });

      const applyStockDecrement = (productsList: Product[]) =>
        productsList.map((product) => {
          const orderedQty = qtyByProduct.get(product.id);
          if (!orderedQty) return product;
          const nextStock = Math.max(0, product.stock - orderedQty);
          const nextVariants = product.variants.map((variant) => {
            const vQty =
              qtyByVariantKey.get(`${product.id}::id::${variant.id}`) ??
              qtyByVariantKey.get(`${product.id}::label::${variant.label}`) ??
              0;
            if (!vQty) return variant;
            return {
              ...variant,
              stock: Math.max(0, variant.stock - vQty),
            };
          });
          return {
            ...product,
            stock: nextStock,
            variants: nextVariants,
            updatedAt: nowIso,
          };
        });

      const updatedProductsSnapshot = applyStockDecrement(state.products);

      setState((prev) => ({
        ...prev,
        products: applyStockDecrement(prev.products),
        placedOrders: [newOrder, ...(prev.placedOrders ?? [])],
      }));
      notifySync(syncOrderToSupabase(newOrder, updatedProductsSnapshot));
      return newOrder;
    },
    [notifySync, state.currentBuyer, state.paymentSettingsByStore, state.products, state.stores]
  );

  const updateOrderStatus = useCallback(
    (orderId: string, status: OrderFulfillmentStatus) => {
      const nowIso = new Date().toISOString();
      const targetOrder = (state.placedOrders ?? []).find(
        (o) => o.id === orderId || o.dbId === orderId
      );
      setState((prev) => ({
        ...prev,
        placedOrders: (prev.placedOrders ?? []).map((o) =>
          o.id === orderId || o.dbId === orderId ? { ...o, status, updatedAt: nowIso } : o
        ),
      }));
      notifySync(syncOrderStatusToSupabase(orderId, status, targetOrder?.dbId));
    },
    [notifySync, state.placedOrders]
  );

  const updateOrderPaymentStatus = useCallback(
    (orderId: string, paymentStatus: OrderPaymentStatus, verifiedBy?: string) => {
      const nowIso = new Date().toISOString();
      const targetOrder = (state.placedOrders ?? []).find(
        (o) => o.id === orderId || o.dbId === orderId
      );
      const nextAmountPaid =
        paymentStatus === 'paid'
          ? targetOrder?.grandTotal ?? 0
          : paymentStatus === 'refunded'
            ? targetOrder?.amountPaid ?? targetOrder?.grandTotal ?? 0
            : 0;
      const nextPaidAt =
        paymentStatus === 'paid' ? targetOrder?.paidAt ?? nowIso : targetOrder?.paidAt;
      const nextVerifiedBy = verifiedBy ?? state.currentUser?.id ?? targetOrder?.verifiedBy;

      setState((prev) => ({
        ...prev,
        placedOrders: (prev.placedOrders ?? []).map((o) => {
          if (o.id !== orderId && o.dbId !== orderId) return o;
          return {
            ...o,
            paymentStatus,
            amountPaid:
              paymentStatus === 'paid'
                ? o.grandTotal
                : paymentStatus === 'refunded'
                  ? o.amountPaid ?? o.grandTotal
                  : 0,
            paidAt: paymentStatus === 'paid' ? o.paidAt ?? nowIso : o.paidAt,
            verifiedBy: verifiedBy ?? prev.currentUser?.id ?? o.verifiedBy,
            updatedAt: nowIso,
          };
        }),
      }));

      notifySync(
        syncOrderPaymentStatusToSupabase({
          orderCodeOrId: orderId,
          dbId: targetOrder?.dbId,
          paymentStatus,
          amountPaid: nextAmountPaid,
          paidAt: nextPaidAt,
          verifiedBy: nextVerifiedBy,
        })
      );
    },
    [notifySync, state.currentUser?.id, state.placedOrders]
  );

  const recordSubscriptionPayment = useCallback(
    async (input: {
      userId: string;
      userName: string;
      userEmail: string;
      planId: 'starter' | 'pro';
      amount: number;
      paymentMethod: string;
      referenceId?: string;
      status?: SubscriptionTransaction['status'];
      dueDate?: string;
      proofUrl?: string;
    }): Promise<{ success: boolean; tx?: SubscriptionTransaction; error?: string }> => {
      const nextStatus = input.status ?? 'paid';
      const nowIso = new Date().toISOString();
      const nextPeriodEndIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const tx: SubscriptionTransaction = {
        id: generateUuid(),
        referenceId: input.referenceId ?? `SUB-${Date.now().toString().slice(-6)}`,
        userId: input.userId,
        userName: input.userName,
        userEmail: input.userEmail,
        planId: input.planId,
        amount: clampNonNegative(input.amount),
        paymentMethod: input.paymentMethod,
        status: nextStatus,
        dueDate: input.dueDate ?? (nextStatus === 'dues' ? nowIso : undefined),
        periodStart: nextStatus === 'paid' ? nowIso : undefined,
        periodEnd: nextStatus === 'paid' ? nextPeriodEndIso : undefined,
        proofUrl: input.proofUrl,
        approvedAt: nextStatus === 'paid' ? nowIso : undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const res = await syncSubscriptionToSupabase(tx, true);
      if (!res.success) {
        pushToast({
          type: 'error',
          title: 'Database Error',
          description: res.error || 'Failed to save subscription payment to database.',
        });
        return { success: false, error: res.error };
      }
      setState((prev) => ({
        ...prev,
        subscriptionTransactions: [tx, ...(prev.subscriptionTransactions ?? [])],
      }));
      return { success: true, tx };
    },
    [pushToast]
  );

  const confirmGatewaySubscription = useCallback(
    async (input: {
      referenceId: string;
      planId: 'pro';
      amount: number;
      paymentMethod: string;
    }) => {
      const nowIso = new Date().toISOString();
      const nextPeriodEndIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await hydrateSessionRef.current?.();

      setState((prev) => {
        if (!prev.currentUser) return prev;
        const updatedUser: User = {
          ...prev.currentUser,
          plan: input.planId,
          planPeriodEndsAt: nextPeriodEndIso,
          cancelAtPeriodEnd: false,
          status:
            prev.currentUser.status === 'restricted' &&
            prev.currentUser.restrictedReason?.includes('Subscription billing')
              ? 'active'
              : prev.currentUser.status,
          restrictedReason:
            prev.currentUser.status === 'restricted' &&
            prev.currentUser.restrictedReason?.includes('Subscription billing')
              ? undefined
              : prev.currentUser.restrictedReason,
          updatedAt: nowIso,
        };

        const existingTxs = prev.subscriptionTransactions ?? [];
        const hasRef = existingTxs.some((t) => t.referenceId === input.referenceId);
        const nextTxs: SubscriptionTransaction[] = hasRef
          ? existingTxs.map((t) =>
              t.referenceId === input.referenceId
                ? {
                    ...t,
                    status: 'paid',
                    periodStart: t.periodStart ?? nowIso,
                    periodEnd: nextPeriodEndIso,
                    approvedAt: nowIso,
                    updatedAt: nowIso,
                  }
                : t
            )
          : [
              {
                id: generateUuid(),
                referenceId: input.referenceId,
                userId: prev.currentUser.id,
                userName: prev.currentUser.name,
                userEmail: prev.currentUser.email,
                planId: input.planId,
                amount: clampNonNegative(input.amount),
                paymentMethod: input.paymentMethod,
                status: 'paid',
                periodStart: nowIso,
                periodEnd: nextPeriodEndIso,
                approvedAt: nowIso,
                createdAt: nowIso,
                updatedAt: nowIso,
              },
              ...existingTxs,
            ];

        return {
          ...prev,
          currentUser: updatedUser,
          users: (prev.users ?? []).map((u) => (u.id === updatedUser.id ? updatedUser : u)),
          subscriptionTransactions: nextTxs,
        };
      });
    },
    []
  );

  const adminUpdateUser = useCallback(
    (
      userId: string,
      updates: Partial<
        Pick<
          User,
          | 'name'
          | 'email'
          | 'plan'
          | 'status'
          | 'restrictedReason'
          | 'cancelAtPeriodEnd'
          | 'planPeriodEndsAt'
        >
      >
    ) => {
      const target = (state.users ?? []).find((u) => u.id === userId);
      const updatedUser = target ? { ...target, ...updates, updatedAt: new Date().toISOString() } : undefined;
      setState((prev) => ({
        ...prev,
        users: (prev.users ?? []).map((u) => (u.id === userId ? { ...u, ...updates } : u)),
        currentUser:
          prev.currentUser?.id === userId ? { ...prev.currentUser, ...updates } : prev.currentUser,
      }));
      if (updatedUser) {
        notifySync(syncUserToSupabase(updatedUser));
      }
    },
    [notifySync, state.users]
  );

  const adminDeleteUser = useCallback(
    async (userId: string): Promise<{ success: boolean; error?: string }> => {
      const res = await deleteUserFromSupabase(userId);
      if (!res.success) {
        return { success: false, error: res.error || 'Could not delete user from database.' };
      }
      setState((prev) => {
        const removedStoreIds = new Set(
          prev.stores.filter((s) => s.ownerId === userId).map((s) => s.id)
        );
        const nextStores = prev.stores.filter((s) => s.ownerId !== userId);
        const nextProducts = prev.products.filter((p) => !removedStoreIds.has(p.storeId));
        const nextPayments = { ...prev.paymentSettingsByStore };
        removedStoreIds.forEach((id) => delete nextPayments[id]);
        const nextOrders = (prev.placedOrders ?? []).filter(
          (o) => !removedStoreIds.has(o.storeId)
        );

        return {
          ...prev,
          users: (prev.users ?? []).filter((u) => u.id !== userId),
          currentUser: prev.currentUser?.id === userId ? null : prev.currentUser,
          stores: nextStores,
          products: nextProducts,
          paymentSettingsByStore: nextPayments,
          placedOrders: nextOrders,
          activeStoreId:
            prev.activeStoreId && removedStoreIds.has(prev.activeStoreId)
              ? nextStores[0]?.id ?? null
              : prev.activeStoreId,
        };
      });
      return { success: true };
    },
    []
  );

  const adminUpdateStore = useCallback(
    async (
      storeId: string,
      updates: {
        name?: string;
        slug?: string;
        status?: Store['status'];
        restrictedReason?: string;
        templateId?: IndustryTemplateId;
      }
    ): Promise<{ success: boolean; error?: string }> => {
      const target = state.stores.find((s) => s.id === storeId);
      if (!target) {
        return { success: false, error: 'Store not found.' };
      }

      let nextSlug = target.slug;
      if (updates.slug !== undefined) {
        const existingSlugs = state.stores.map((s) => s.slug);
        const validation = validateStoreSlug(updates.slug, existingSlugs, target.slug);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
        nextSlug = validation.normalizedSlug;
      }

      const now = new Date().toISOString();
      const updatedStore: Store = {
        ...target,
        name: updates.name !== undefined ? updates.name.trim() : target.name,
        slug: nextSlug,
        domainUrl: buildStoreDomainUrl(nextSlug),
        status: updates.status ?? target.status,
        restrictedReason:
          updates.status && updates.status !== 'restricted'
            ? undefined
            : updates.restrictedReason !== undefined
              ? updates.restrictedReason
              : target.restrictedReason,
        templateId: updates.templateId ?? target.templateId,
        updatedAt: now,
      };

      const res = await syncStoreToSupabase(updatedStore);
      if (!res.success) {
        return { success: false, error: res.error || 'Could not update store in database.' };
      }

      setState((prev) => ({
        ...prev,
        stores: prev.stores.map((s) => (s.id === storeId ? updatedStore : s)),
      }));

      return { success: true };
    },
    [state.stores]
  );

  const adminToggleSubscriptionTxStatus = useCallback(
    (txId: string, status: SubscriptionTransaction['status']) => {
      const nowIso = new Date().toISOString();
      const nextPeriodEndIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const targetTx = (state.subscriptionTransactions ?? []).find((t) => t.id === txId);
      const updatedTx: SubscriptionTransaction | undefined = targetTx
        ? {
            ...targetTx,
            status,
            periodStart: status === 'paid' ? targetTx.periodStart ?? nowIso : targetTx.periodStart,
            periodEnd: status === 'paid' ? nextPeriodEndIso : targetTx.periodEnd,
            approvedBy:
              status === 'paid' ? state.currentUser?.id ?? targetTx.approvedBy : targetTx.approvedBy,
            approvedAt: status === 'paid' ? nowIso : targetTx.approvedAt,
            updatedAt: nowIso,
          }
        : undefined;

      const matchesTxUser = (u: User) =>
        Boolean(targetTx) &&
        (u.id === targetTx!.userId ||
          u.email.toLowerCase() === targetTx!.userEmail.toLowerCase());

      const applyPaidToUser = (u: User): User => ({
        ...u,
        plan: targetTx!.planId,
        status:
          u.status === 'restricted' && u.restrictedReason?.includes('Subscription billing')
            ? ('active' as const)
            : u.status,
        restrictedReason:
          u.status === 'restricted' && u.restrictedReason?.includes('Subscription billing')
            ? undefined
            : u.restrictedReason,
        cancelAtPeriodEnd: false,
        planPeriodEndsAt: nextPeriodEndIso,
        updatedAt: nowIso,
      });

      const updatedUsersToSync =
        targetTx && status === 'paid'
          ? (state.users ?? []).filter(matchesTxUser).map(applyPaidToUser)
          : [];

      setState((prev) => {
        const nextTransactions = (prev.subscriptionTransactions ?? []).map((tx) =>
          tx.id === txId && updatedTx ? updatedTx : tx
        );

        if (!targetTx || status !== 'paid') {
          return {
            ...prev,
            subscriptionTransactions: nextTransactions,
          };
        }

        const nextUsers = (prev.users ?? []).map((u) =>
          matchesTxUser(u) ? applyPaidToUser(u) : u
        );
        const nextCurrentUser =
          prev.currentUser && matchesTxUser(prev.currentUser)
            ? applyPaidToUser(prev.currentUser)
            : prev.currentUser;

        return {
          ...prev,
          users: nextUsers,
          currentUser: nextCurrentUser,
          subscriptionTransactions: nextTransactions,
        };
      });

      if (updatedTx) {
        notifySync(syncSubscriptionToSupabase(updatedTx));
      }

      if (targetTx && status === 'paid') {
        if (updatedUsersToSync.length > 0) {
          updatedUsersToSync.forEach((u) => {
            notifySync(syncUserToSupabase(u));
          });
        } else if (isSupabaseConfigured) {
          const client = getSupabaseClient();
          if (client && targetTx.userId) {
            client
              .from('users')
              .update({
                plan: targetTx.planId,
                cancel_at_period_end: false,
                plan_period_ends_at: nextPeriodEndIso,
                updated_at: nowIso,
              } as any)
              .eq('id', targetTx.userId)
              .then(({ error }) => {
                if (error) {
                  pushToast({
                    type: 'error',
                    title: 'Database Error',
                    description: `Failed to update user plan: ${error.message}`,
                  });
                }
              });
          }
        }
      }
    },
    [notifySync, pushToast, state.currentUser?.id, state.subscriptionTransactions, state.users]
  );

  const adminDeleteBuyer = useCallback((buyerId: string) => {
    setState((prev) => ({
      ...prev,
      buyers: (prev.buyers ?? []).filter((b) => b.id !== buyerId),
      currentBuyer: prev.currentBuyer?.id === buyerId ? null : prev.currentBuyer,
    }));
    if (isSupabaseConfigured) {
      const client = getSupabaseClient();
      if (client) {
        client.from('users').delete().eq('id', buyerId).then();
      }
    }
  }, []);

  const markNotificationsRead = useCallback((ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0)));
    if (uniqueIds.length === 0) return;

    const userId = activeUserIdRef.current;
    if (userId) {
      const local = loadLocalNotificationState(userId);
      const nextLocalRead = Array.from(new Set([...local.readIds, ...uniqueIds]));
      saveLocalNotificationState(userId, nextLocalRead, local.dismissedIds);
      void syncUserNotificationStatesToSupabase(userId, uniqueIds, 'read');
    }

    setState((prev) => {
      const next = new Set(prev.readNotificationIds ?? []);
      let changed = false;
      uniqueIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      if (!changed) return prev;
      return {
        ...prev,
        readNotificationIds: Array.from(next),
      };
    });
  }, []);

  const dismissNotifications = useCallback((ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0)));
    if (uniqueIds.length === 0) return;

    const userId = activeUserIdRef.current;
    if (userId) {
      const local = loadLocalNotificationState(userId);
      const nextLocalDismissed = Array.from(new Set([...local.dismissedIds, ...uniqueIds]));
      const nextLocalRead = Array.from(new Set([...local.readIds, ...uniqueIds]));
      saveLocalNotificationState(userId, nextLocalRead, nextLocalDismissed);
      void syncUserNotificationStatesToSupabase(userId, uniqueIds, 'dismiss');
    }

    setState((prev) => {
      const nextDismissed = new Set(prev.dismissedNotificationIds ?? []);
      const nextRead = new Set(prev.readNotificationIds ?? []);
      uniqueIds.forEach((id) => {
        nextDismissed.add(id);
        nextRead.add(id);
      });
      return {
        ...prev,
        dismissedNotificationIds: Array.from(nextDismissed),
        readNotificationIds: Array.from(nextRead),
      };
    });
  }, []);

  const platformPaymentSettings = useMemo<PlatformPaymentSettings>(
    () => state.platformPaymentSettings ?? createDefaultPlatformPaymentSettings(),
    [state.platformPaymentSettings]
  );

  const proMonthlyPrice = useMemo<number>(() => {
    const raw = Number(platformPaymentSettings.proMonthlyPrice);
    return Number.isFinite(raw) && raw >= 1 && raw <= 1_000_000 ? raw : DEFAULT_PRO_MONTHLY_PRICE;
  }, [platformPaymentSettings.proMonthlyPrice]);

  const updatePlatformPaymentSettings = useCallback(
    (channels: PlatformPaymentChannel[], nextProPrice?: number) => {
      const nowIso = new Date().toISOString();
      const cleanChannels = channels
        .filter((c) => c.id !== PRO_PLAN_PRICE_ROW_ID)
        .map((channel, index) => ({
          ...channel,
          sortOrder: channel.sortOrder ?? index,
        }));
      const resolvedPrice =
        typeof nextProPrice === 'number' &&
        Number.isFinite(nextProPrice) &&
        nextProPrice >= 1 &&
        nextProPrice <= 1_000_000
          ? Math.round(nextProPrice * 100) / 100
          : proMonthlyPrice;

      setState((prev) => ({
        ...prev,
        platformPaymentSettings: {
          channels: cleanChannels,
          proMonthlyPrice: resolvedPrice,
          updatedAt: nowIso,
        },
      }));
      notifySync(syncPlatformChannelsToSupabase(cleanChannels, resolvedPrice));
      if (typeof nextProPrice === 'number' && Number.isFinite(nextProPrice) && nextProPrice >= 1) {
        setAdminProPlanPrice(resolvedPrice).catch(() => {
          // Best-effort runtime sync for server session endpoint
        });
      }
    },
    [notifySync, proMonthlyPrice]
  );

  const updateProMonthlyPrice = useCallback(
    async (price: number): Promise<{ success: boolean; error?: string }> => {
      const parsed = Number(price);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1_000_000) {
        return {
          success: false,
          error: 'Pro plan price must be between ₱1 and ₱1,000,000.',
        };
      }
      const rounded = Math.round(parsed * 100) / 100;
      const nowIso = new Date().toISOString();

      setState((prev) => ({
        ...prev,
        platformPaymentSettings: {
          channels: prev.platformPaymentSettings?.channels ?? [],
          proMonthlyPrice: rounded,
          updatedAt: nowIso,
        },
      }));

      let dbResult: { success: boolean; error?: string } = { success: true };
      if (isSupabaseConfigured) {
        dbResult = await syncProPlanPriceToSupabase(rounded);
      }

      const apiResult = await setAdminProPlanPrice(rounded)
        .then(() => ({ success: true as const }))
        .catch((err) => ({
          success: false as const,
          error: err instanceof Error ? err.message : 'Unable to sync Pro price with server.',
        }));

      if (!dbResult.success && !apiResult.success) {
        return {
          success: false,
          error: dbResult.error || apiResult.error || 'Failed to save Pro plan price.',
        };
      }
      return { success: true };
    },
    []
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      isHydrating,
      isAuthChecking,
      route,
      navigate,
      goBack,
      toasts,
      pushToast,
      dismissToast,
      signInUser,
      signUpUser,
      signInAdminUser,
      resetUserPassword,
      signOut,
      updateUserProfile,
      buyerSignUp,
      buyerSignIn,
      buyerResetPassword,
      buyerSignOut,
      getBuyerOrders,
      getBuyerCheckoutInfo,
      saveBuyerCheckoutInfo,
      clearBuyerCheckoutInfo,
      setActiveStore,
      createStore,
      updateStoreMeta,
      updateStoreBranding,
      deleteStore,
      getStoreBySlug,
      getStoreProducts,
      createProduct,
      updateProduct,
      deleteProduct,
      getPaymentSettings,
      updatePaymentSettings,
      getStoreOrders,
      placeCustomerOrder,
      updateOrderStatus,
      updateOrderPaymentStatus,
      recordSubscriptionPayment,
      confirmGatewaySubscription,
      adminUpdateUser,
      adminDeleteUser,
      adminUpdateStore,
      adminToggleSubscriptionTxStatus,
      adminDeleteBuyer,
      platformPaymentSettings,
      proMonthlyPrice,
      updatePlatformPaymentSettings,
      updateProMonthlyPrice,
      markNotificationsRead,
      dismissNotifications,
    }),
    [
      state,
      isHydrating,
      isAuthChecking,
      route,
      navigate,
      goBack,
      toasts,
      pushToast,
      dismissToast,
      signInUser,
      signUpUser,
      signInAdminUser,
      resetUserPassword,
      signOut,
      updateUserProfile,
      buyerSignUp,
      buyerSignIn,
      buyerResetPassword,
      buyerSignOut,
      getBuyerOrders,
      getBuyerCheckoutInfo,
      saveBuyerCheckoutInfo,
      clearBuyerCheckoutInfo,
      setActiveStore,
      createStore,
      updateStoreMeta,
      updateStoreBranding,
      deleteStore,
      getStoreBySlug,
      getStoreProducts,
      createProduct,
      updateProduct,
      deleteProduct,
      getPaymentSettings,
      updatePaymentSettings,
      getStoreOrders,
      placeCustomerOrder,
      updateOrderStatus,
      updateOrderPaymentStatus,
      recordSubscriptionPayment,
      confirmGatewaySubscription,
      adminUpdateUser,
      adminDeleteUser,
      adminUpdateStore,
      adminToggleSubscriptionTxStatus,
      adminDeleteBuyer,
      platformPaymentSettings,
      proMonthlyPrice,
      updatePlatformPaymentSettings,
      updateProMonthlyPrice,
      markNotificationsRead,
      dismissNotifications,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return ctx;
}
