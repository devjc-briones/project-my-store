import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  BuyerAccount,
  BuyerCheckoutInfo,
  CustomerOrder,
  DiscountType,
  GlobalAppState,
  IndustryTemplateId,
  OrderFulfillmentStatus,
  PaymentSettings,
  PlatformPaymentChannel,
  PlatformPaymentSettings,
  Product,
  Roles,
  Store,
  StoreBranding,
  SubscriptionTransaction,
  ToastMessage,
  User,
} from '../types/schema';
import { INITIAL_SEED_STATE, createDefaultPaymentSettings } from '../data/mockSeed';
import { createDefaultPlatformPaymentSettings } from '../data/platformPayments';
import { getPlanLimits } from '../data/plans';
import { INDUSTRY_TEMPLATES, isProTemplate } from '../data/templates';
import { resolveTemplateAssetUrl } from '../data/templateAssets';
import { buildStoreDomainUrl, generateUniqueStoreSlug, validateStoreSlug } from '../utils/domain';
import { calculateSmartPricing } from '../utils/pricing';
import { isUserPlanPastDue } from '../utils/billing';
import { AppRoute, buildRoutePath, parseRoute } from '../router/routes';

const STORAGE_KEY = 'mystore_saas_state_v2';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  route: AppRoute;
  navigate: (next: AppRoute, options?: { replace?: boolean }) => void;
  goBack: (fallback?: AppRoute) => void;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Auth / User actions
  signInUser: (
    email: string,
    password: string
  ) => { success: boolean; user?: User; error?: string };
  signUpUser: (
    name: string,
    email: string,
    password: string
  ) => { success: boolean; user?: User; error?: string };
  signInAdminUser: (email: string, password: string) => { success: boolean; error?: string };
  signOut: () => void;
  updateUserProfile: (
    updates: Partial<Pick<User, 'name' | 'email' | 'plan' | 'planPeriodEndsAt' | 'cancelAtPeriodEnd'>>
  ) => void;

  // Store actions
  setActiveStore: (storeId: string | null) => void;
  createStore: (input: CreateStoreInput) => { store?: Store; error?: string };
  updateStoreMeta: (
    storeId: string,
    updates: {
      name?: string;
      slug?: string;
      status?: Store['status'];
      templateId?: IndustryTemplateId;
    }
  ) => { success: boolean; error?: string };
  updateStoreBranding: (storeId: string, brandingUpdates: Partial<StoreBranding>) => void;
  deleteStore: (storeId: string) => void;
  getStoreBySlug: (slug: string) => Store | undefined;

  // Product actions
  getStoreProducts: (storeId: string) => Product[];
  createProduct: (input: CreateProductInput) => Product;
  updateProduct: (productId: string, updates: Partial<Omit<Product, 'id' | 'storeId'>>) => void;
  deleteProduct: (productId: string) => void;

  // Payment settings actions
  getPaymentSettings: (storeId: string) => PaymentSettings;
  updatePaymentSettings: (storeId: string, updates: Partial<PaymentSettings>) => void;

  // Customer order actions
  getStoreOrders: (storeId: string) => CustomerOrder[];
  placeCustomerOrder: (
    order: Omit<CustomerOrder, 'id' | 'status' | 'createdAt'>
  ) => CustomerOrder;
  updateOrderStatus: (orderId: string, status: OrderFulfillmentStatus) => void;

  // Buyer Auth & Orders
  buyerSignUp: (input: {
    name: string;
    email: string;
    password: string;
    storeId?: string;
    storeName?: string;
  }) => { success: boolean; buyer?: BuyerAccount; error?: string };
  buyerSignIn: (
    email: string,
    password: string
  ) => { success: boolean; buyer?: BuyerAccount; error?: string };
  buyerResetPassword: (email: string, newPassword: string) => void;
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
    proofUrl?: string;
  }) => void;
  adminUpdateUser: (
    userId: string,
    updates: Partial<
      Pick<
        User,
        'name' | 'email' | 'plan' | 'status' | 'restrictedReason' | 'cancelAtPeriodEnd' | 'planPeriodEndsAt'
      >
    >
  ) => void;
  adminDeleteUser: (userId: string) => void;
  adminUpdateStore: (
    storeId: string,
    updates: {
      name?: string;
      slug?: string;
      status?: Store['status'];
      restrictedReason?: string;
      templateId?: IndustryTemplateId;
    }
  ) => { success: boolean; error?: string };
  adminToggleSubscriptionTxStatus: (
    txId: string,
    status: SubscriptionTransaction['status']
  ) => void;
  adminDeleteBuyer: (buyerId: string) => void;

  // Platform Subscription Payment Settings (Admin)
  platformPaymentSettings: PlatformPaymentSettings;
  updatePlatformPaymentSettings: (channels: PlatformPaymentChannel[]) => void;

  // Seller notification read/dismiss actions
  markNotificationsRead: (ids: string[]) => void;
  dismissNotifications: (ids: string[]) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function loadInitialState(): GlobalAppState {
  if (typeof window === 'undefined') {
    return INITIAL_SEED_STATE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return INITIAL_SEED_STATE;
    }
    const parsed = JSON.parse(raw) as GlobalAppState;
    if (!parsed || !Array.isArray(parsed.stores) || !Array.isArray(parsed.products)) {
      return INITIAL_SEED_STATE;
    }

    parsed.users = Array.isArray(parsed.users) ? parsed.users : [];
    parsed.buyers = Array.isArray(parsed.buyers) ? parsed.buyers : [];
    parsed.placedOrders = Array.isArray(parsed.placedOrders) ? parsed.placedOrders : [];
    parsed.subscriptionTransactions = Array.isArray(parsed.subscriptionTransactions)
      ? parsed.subscriptionTransactions
      : [];
    parsed.paymentSettingsByStore = parsed.paymentSettingsByStore ?? {};
    parsed.platformPaymentSettings =
      parsed.platformPaymentSettings && Array.isArray(parsed.platformPaymentSettings.channels)
        ? parsed.platformPaymentSettings
        : createDefaultPlatformPaymentSettings();

    parsed.stores = parsed.stores.map((s) => ({
      ...s,
      branding: {
        ...s.branding,
        heroBannerUrl: resolveTemplateAssetUrl(s.branding?.heroBannerUrl),
        logoImageUrl: resolveTemplateAssetUrl(s.branding?.logoImageUrl),
      },
    }));
    parsed.products = parsed.products.map((p) => ({
      ...p,
      imageUrl: resolveTemplateAssetUrl(p.imageUrl),
    }));
    return parsed;
  } catch {
    return INITIAL_SEED_STATE;
  }
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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

  // Persist global state to LocalStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota issues in restricted environments
    }
  }, [state]);

  // Automatically revert scheduled cancellations back to Free once the paid period expires
  useEffect(() => {
    const usersList = state.users ?? [];
    const nowMs = Date.now();
    let needsUpdate = false;

    const nextUsers = usersList.map((u) => {
      if (
        u.role === Roles.Seller &&
        u.plan !== 'starter' &&
        u.cancelAtPeriodEnd &&
        u.planPeriodEndsAt &&
        nowMs >= new Date(u.planPeriodEndsAt).getTime()
      ) {
        needsUpdate = true;
        return {
          ...u,
          plan: 'starter' as const,
          cancelAtPeriodEnd: false,
          planPeriodEndsAt: undefined,
        };
      }
      return u;
    });

    if (needsUpdate) {
      setState((prev) => ({
        ...prev,
        users: nextUsers,
        currentUser:
          (prev.currentUser && nextUsers.find((u) => u.id === prev.currentUser?.id)) ||
          prev.currentUser,
      }));
    }
  }, [state.users]);

  // Listen to browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync changes across tabs (e.g. merchant editing store in one tab & viewing /shop/slug in another)
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as GlobalAppState;
          if (parsed && Array.isArray(parsed.stores) && Array.isArray(parsed.products)) {
            setState(parsed);
          }
        } catch {
          // Ignore malformed storage payload
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
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

  const signUpUser = useCallback(
    (
      name: string,
      email: string,
      password: string
    ): { success: boolean; user?: User; error?: string } => {
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

      const existing = (state.users ?? []).find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );
      if (existing) {
        return {
          success: false,
          error: 'An account with this email already exists. Please sign in.',
        };
      }

      const now = new Date().toISOString();
      const newUser: User = {
        id: generateId('usr'),
        name: cleanName,
        email: normalizedEmail,
        password,
        role: Roles.Seller,
        plan: 'starter',
        status: 'active',
        lastActiveAt: now,
        createdAt: now,
      };

      setState((prev) => ({
        ...prev,
        currentUser: newUser,
        users: [newUser, ...(prev.users ?? [])],
      }));

      return { success: true, user: newUser };
    },
    [state.users]
  );

  const signInUser = useCallback(
    (
      email: string,
      password: string
    ): { success: boolean; user?: User; error?: string } => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      const matched = (state.users ?? []).find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );
      if (!matched) {
        return {
          success: false,
          error: 'No account found with this email. Create an account or connect your database.',
        };
      }
      if (matched.password && matched.password !== password) {
        return { success: false, error: 'Incorrect email or password.' };
      }

      const updatedUser: User = {
        ...matched,
        lastActiveAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        currentUser: updatedUser,
        users: (prev.users ?? []).map((u) => (u.id === updatedUser.id ? updatedUser : u)),
      }));
      return { success: true, user: updatedUser };
    },
    [state.users]
  );

  const signInAdminUser = useCallback(
    (email: string, password: string): { success: boolean; error?: string } => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
        return { success: false, error: 'Please enter a valid admin email address.' };
      }

      const matchedAdmin = (state.users ?? []).find(
        (u) => u.email.toLowerCase() === normalizedEmail && u.role === Roles.Admin
      );

      if (!matchedAdmin) {
        return {
          success: false,
          error: 'No administrator account found. Seed an admin account in your database first.',
        };
      }
      if (matchedAdmin.password && matchedAdmin.password !== password) {
        return { success: false, error: 'Incorrect password for admin account.' };
      }

      const updatedAdmin: User = {
        ...matchedAdmin,
        lastActiveAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        currentUser: updatedAdmin,
        users: (prev.users ?? []).map((u) => (u.id === updatedAdmin.id ? updatedAdmin : u)),
      }));

      return { success: true };
    },
    [state.users]
  );

  const signOut = useCallback(() => {
    setState((prev) => ({ ...prev, currentUser: null }));
  }, []);

  const buyerSignUp = useCallback(
    (input: {
      name: string;
      email: string;
      password: string;
      storeId?: string;
      storeName?: string;
    }): { success: boolean; buyer?: BuyerAccount; error?: string } => {
      const cleanName = input.name.trim();
      const cleanEmail = input.email.trim().toLowerCase();

      if (!cleanName || cleanName.length < 2) {
        return { success: false, error: 'Please enter your full name.' };
      }
      if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      const isReservedAdminEmail = (state.users ?? []).some(
        (u) => u.email.toLowerCase() === cleanEmail && u.role === Roles.Admin
      );
      if (isReservedAdminEmail) {
        return { success: false, error: 'This email address is reserved.' };
      }
      if (!input.password || input.password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }

      const existing = (state.buyers ?? []).find(
        (b) => b.email.toLowerCase() === cleanEmail
      );
      if (existing) {
        return {
          success: false,
          error: 'An account with this email address already exists. Please sign in.',
        };
      }

      const newBuyer: BuyerAccount = {
        id: generateId('buy'),
        name: cleanName,
        email: cleanEmail,
        password: input.password,
        role: Roles.Buyer,
        storeId: input.storeId,
        storeName: input.storeName,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        buyers: [...(prev.buyers ?? []), newBuyer],
        currentBuyer: newBuyer,
      }));
      return { success: true, buyer: newBuyer };
    },
    [state.buyers]
  );

  const buyerSignIn = useCallback(
    (
      email: string,
      password: string
    ): { success: boolean; buyer?: BuyerAccount; error?: string } => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      const found = (state.buyers ?? []).find(
        (b) => b.email.toLowerCase() === cleanEmail && b.role === Roles.Buyer
      );
      if (!found) {
        return { success: false, error: 'No buyer account found with this email address.' };
      }
      if (found.password !== password) {
        return { success: false, error: 'Incorrect password. Please try again.' };
      }
      setState((prev) => ({
        ...prev,
        currentBuyer: found,
      }));
      return { success: true, buyer: found };
    },
    [state.buyers]
  );

  const buyerResetPassword = useCallback((email: string, newPassword: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setState((prev) => ({
      ...prev,
      buyers: (prev.buyers ?? []).map((b) =>
        b.email.toLowerCase() === cleanEmail && b.role === Roles.Buyer
          ? { ...b, password: newPassword }
          : b
      ),
      currentBuyer:
        prev.currentBuyer && prev.currentBuyer.email.toLowerCase() === cleanEmail
          ? { ...prev.currentBuyer, password: newPassword }
          : prev.currentBuyer,
    }));
  }, []);

  const buyerSignOut = useCallback(() => {
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

      setState((prev) => {
        if (!prev.currentBuyer) return prev;
        const updatedBuyer: BuyerAccount = {
          ...prev.currentBuyer,
          savedCheckoutInfo: saved,
        };
        return {
          ...prev,
          currentBuyer: updatedBuyer,
          buyers: (prev.buyers ?? []).map((b) => (b.id === updatedBuyer.id ? updatedBuyer : b)),
        };
      });

      return saved;
    },
    [state.currentBuyer]
  );

  const clearBuyerCheckoutInfo = useCallback(() => {
    setState((prev) => {
      if (!prev.currentBuyer) return prev;
      const clearedBuyer: BuyerAccount = {
        ...prev.currentBuyer,
        savedCheckoutInfo: undefined,
      };
      return {
        ...prev,
        currentBuyer: clearedBuyer,
        buyers: (prev.buyers ?? []).map((b) => (b.id === clearedBuyer.id ? clearedBuyer : b)),
      };
    });
  }, []);

  const updateUserProfile = useCallback(
    (
      updates: Partial<
        Pick<User, 'name' | 'email' | 'plan' | 'planPeriodEndsAt' | 'cancelAtPeriodEnd'>
      >
    ) => {
      setState((prev) => {
        if (!prev.currentUser) return prev;
        const updatedUser: User = { ...prev.currentUser, ...updates };
        return {
          ...prev,
          currentUser: updatedUser,
          users: (prev.users ?? []).map((u) => (u.id === updatedUser.id ? updatedUser : u)),
        };
      });
    },
    []
  );

  const setActiveStore = useCallback((storeId: string | null) => {
    setState((prev) => ({ ...prev, activeStoreId: storeId }));
  }, []);

  const createStore = useCallback(
    (input: CreateStoreInput): { store?: Store; error?: string } => {
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
      const newStoreId = generateId('str');

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
              logoText: input.branding.logoText?.trim() ?? '',
            }
          : {
              primaryColor: templateMeta.defaultBranding.primaryColor,
              secondaryColor: templateMeta.defaultBranding.secondaryColor,
              accentColor: templateMeta.defaultBranding.accentColor,
              surfaceColor: templateMeta.defaultBranding.surfaceColor,
              textColor: templateMeta.defaultBranding.textColor,
              backgroundMode: templateMeta.defaultBranding.backgroundMode,
              buttonStyle: templateMeta.defaultBranding.buttonStyle,
              fontPairing: templateMeta.defaultBranding.fontPairing,
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

      setState((prev) => ({
        ...prev,
        stores: [newStore, ...prev.stores],
        paymentSettingsByStore: {
          ...prev.paymentSettingsByStore,
          [newStoreId]: createDefaultPaymentSettings(newStoreId),
        },
        activeStoreId: newStoreId,
      }));

      return { store: newStore };
    },
    [state.currentUser?.id, state.currentUser?.plan, state.stores]
  );

  const updateStoreMeta = useCallback(
    (
      storeId: string,
      updates: {
        name?: string;
        slug?: string;
        status?: Store['status'];
        templateId?: IndustryTemplateId;
      }
    ): { success: boolean; error?: string } => {
      const target = state.stores.find((s) => s.id === storeId);
      if (!target) {
        return { success: false, error: 'Store not found.' };
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
      setState((prev) => ({
        ...prev,
        stores: prev.stores.map((s) =>
          s.id === storeId
            ? {
                ...s,
                name: updates.name !== undefined ? updates.name.trim() : s.name,
                slug: nextSlug,
                domainUrl: buildStoreDomainUrl(nextSlug),
                status: updates.status ?? s.status,
                templateId: updates.templateId ?? s.templateId,
                updatedAt: now,
              }
            : s
        ),
      }));

      return { success: true };
    },
    [state.currentUser?.plan, state.currentUser?.role, state.stores]
  );

  const updateStoreBranding = useCallback(
    (storeId: string, brandingUpdates: Partial<StoreBranding>) => {
      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        stores: prev.stores.map((s) =>
          s.id === storeId
            ? {
                ...s,
                branding: { ...s.branding, ...brandingUpdates },
                updatedAt: now,
              }
            : s
        ),
      }));
    },
    []
  );

  const deleteStore = useCallback((storeId: string) => {
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
  }, []);

  const getStoreBySlug = useCallback(
    (slug: string) => state.stores.find((s) => s.slug.toLowerCase() === slug.toLowerCase()),
    [state.stores]
  );

  const getStoreProducts = useCallback(
    (storeId: string) => state.products.filter((p) => p.storeId === storeId),
    [state.products]
  );

  const createProduct = useCallback((input: CreateProductInput): Product => {
    const now = new Date().toISOString();
    const discountType: DiscountType =
      input.discountType ?? ((input.discountPercent ?? 0) > 0 ? 'percentage' : 'none');
    const discountValue =
      input.discountValue ?? (discountType === 'percentage' ? input.discountPercent ?? 0 : 0);
    const smart = calculateSmartPricing({
      basePrice: input.basePrice,
      discountType,
      discountValue,
      costPrice: input.costPrice,
    });

    const product: Product = {
      id: generateId('prd'),
      storeId: input.storeId,
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category.trim(),
      basePrice: input.basePrice,
      discountType,
      discountValue,
      discountPercent: Math.round(smart.effectiveDiscountPercent),
      costPrice: input.costPrice,
      finalPrice: smart.finalPrice,
      sku: input.sku.trim(),
      stock: input.stock,
      imageUrl: input.imageUrl,
      variants: input.variants ?? [],
      isFeatured: input.isFeatured ?? false,
      isAvailable: input.isAvailable ?? true,
      createdAt: now,
      updatedAt: now,
    };

    setState((prev) => ({
      ...prev,
      products: [product, ...prev.products],
    }));

    return product;
  }, []);

  const updateProduct = useCallback(
    (productId: string, updates: Partial<Omit<Product, 'id' | 'storeId'>>) => {
      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) => {
          if (p.id !== productId) return p;
          const nextBase = updates.basePrice ?? p.basePrice;
          const nextDiscountType: DiscountType =
            updates.discountType ??
            p.discountType ??
            ((updates.discountPercent ?? p.discountPercent) > 0 ? 'percentage' : 'none');
          const nextDiscountValue =
            updates.discountValue ??
            (updates.discountPercent !== undefined && nextDiscountType === 'percentage'
              ? updates.discountPercent
              : p.discountValue ?? p.discountPercent);
          const nextCostPrice =
            'costPrice' in updates ? updates.costPrice : p.costPrice;

          const smart = calculateSmartPricing({
            basePrice: nextBase,
            discountType: nextDiscountType,
            discountValue: nextDiscountValue,
            costPrice: nextCostPrice,
          });

          return {
            ...p,
            ...updates,
            basePrice: nextBase,
            discountType: nextDiscountType,
            discountValue: nextDiscountValue,
            discountPercent: Math.round(smart.effectiveDiscountPercent),
            costPrice: nextCostPrice,
            finalPrice: smart.finalPrice,
            updatedAt: now,
          };
        }),
      }));
    },
    []
  );

  const deleteProduct = useCallback((productId: string) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }));
  }, []);

  const getPaymentSettings = useCallback(
    (storeId: string): PaymentSettings =>
      state.paymentSettingsByStore[storeId] ?? createDefaultPaymentSettings(storeId),
    [state.paymentSettingsByStore]
  );

  const updatePaymentSettings = useCallback(
    (storeId: string, updates: Partial<PaymentSettings>) => {
      const now = new Date().toISOString();
      setState((prev) => {
        const current = prev.paymentSettingsByStore[storeId] ?? createDefaultPaymentSettings(storeId);
        return {
          ...prev,
          paymentSettingsByStore: {
            ...prev.paymentSettingsByStore,
            [storeId]: {
              ...current,
              ...updates,
              storeId,
              updatedAt: now,
            },
          },
        };
      });
    },
    []
  );

  const getStoreOrders = useCallback(
    (storeId: string): CustomerOrder[] =>
      (state.placedOrders ?? []).filter((o) => o.storeId === storeId),
    [state.placedOrders]
  );

  const placeCustomerOrder = useCallback(
    (input: Omit<CustomerOrder, 'id' | 'status' | 'createdAt'>): CustomerOrder => {
      const orderNum = Math.floor(1050 + Math.random() * 8900);
      const storeObj = state.stores.find((s) => s.id === input.storeId);
      const newOrder: CustomerOrder = {
        ...input,
        id: `ORD-${orderNum}`,
        storeName: storeObj?.name ?? 'Store',
        buyerId: state.currentBuyer?.id,
        phoneNumber: input.phoneNumber,
        customerName: input.customerName.trim() || state.currentBuyer?.name || 'Customer',
        status: 'Pending',
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        placedOrders: [newOrder, ...(prev.placedOrders ?? [])],
      }));
      return newOrder;
    },
    [state.currentBuyer, state.stores]
  );

  const updateOrderStatus = useCallback(
    (orderId: string, status: OrderFulfillmentStatus) => {
      setState((prev) => ({
        ...prev,
        placedOrders: (prev.placedOrders ?? []).map((o) =>
          o.id === orderId ? { ...o, status } : o
        ),
      }));
    },
    []
  );

  const recordSubscriptionPayment = useCallback(
    (input: {
      userId: string;
      userName: string;
      userEmail: string;
      planId: 'starter' | 'pro';
      amount: number;
      paymentMethod: string;
      referenceId?: string;
      status?: SubscriptionTransaction['status'];
      proofUrl?: string;
    }) => {
      const nextStatus = input.status ?? 'paid';
      const nowIso = new Date().toISOString();
      const tx: SubscriptionTransaction = {
        id: generateId('tx_sub'),
        referenceId: input.referenceId ?? `SUB-${Date.now().toString().slice(-6)}`,
        userId: input.userId,
        userName: input.userName,
        userEmail: input.userEmail,
        planId: input.planId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        status: nextStatus,
        proofUrl: input.proofUrl,
        approvedAt: nextStatus === 'paid' ? nowIso : undefined,
        createdAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        subscriptionTransactions: [tx, ...(prev.subscriptionTransactions ?? [])],
      }));
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
      setState((prev) => {
        const nextUsers = (prev.users ?? []).map((u) =>
          u.id === userId ? { ...u, ...updates } : u
        );
        const nextCurrentUser =
          prev.currentUser?.id === userId
            ? { ...prev.currentUser, ...updates }
            : prev.currentUser;
        return {
          ...prev,
          users: nextUsers,
          currentUser: nextCurrentUser,
        };
      });
    },
    []
  );

  const adminDeleteUser = useCallback((userId: string) => {
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
  }, []);

  const adminUpdateStore = useCallback(
    (
      storeId: string,
      updates: {
        name?: string;
        slug?: string;
        status?: Store['status'];
        restrictedReason?: string;
        templateId?: IndustryTemplateId;
      }
    ): { success: boolean; error?: string } => {
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
      setState((prev) => ({
        ...prev,
        stores: prev.stores.map((s) =>
          s.id === storeId
            ? {
                ...s,
                name: updates.name !== undefined ? updates.name.trim() : s.name,
                slug: nextSlug,
                domainUrl: buildStoreDomainUrl(nextSlug),
                status: updates.status ?? s.status,
                restrictedReason:
                  updates.status && updates.status !== 'restricted'
                    ? undefined
                    : updates.restrictedReason !== undefined
                      ? updates.restrictedReason
                      : s.restrictedReason,
                templateId: updates.templateId ?? s.templateId,
                updatedAt: now,
              }
            : s
        ),
      }));

      return { success: true };
    },
    [state.stores]
  );

  const adminToggleSubscriptionTxStatus = useCallback(
    (txId: string, status: SubscriptionTransaction['status']) => {
      setState((prev) => {
        const nowIso = new Date().toISOString();
        const targetTx = (prev.subscriptionTransactions ?? []).find((t) => t.id === txId);
        const nextTransactions = (prev.subscriptionTransactions ?? []).map((tx) =>
          tx.id === txId
            ? {
                ...tx,
                status,
                approvedAt: status === 'paid' ? nowIso : tx.approvedAt,
              }
            : tx
        );

        if (!targetTx || status !== 'paid') {
          return {
            ...prev,
            subscriptionTransactions: nextTransactions,
          };
        }

        const nextPeriodEndIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const matchesTxUser = (u: User) =>
          u.id === targetTx.userId ||
          u.email.toLowerCase() === targetTx.userEmail.toLowerCase();

        const nextUsers = (prev.users ?? []).map((u) =>
          matchesTxUser(u)
            ? {
                ...u,
                plan: targetTx.planId,
                status:
                  u.status === 'restricted' &&
                  u.restrictedReason?.includes('Subscription billing')
                    ? ('active' as const)
                    : u.status,
                restrictedReason:
                  u.status === 'restricted' &&
                  u.restrictedReason?.includes('Subscription billing')
                    ? undefined
                    : u.restrictedReason,
                cancelAtPeriodEnd: false,
                planPeriodEndsAt: nextPeriodEndIso,
              }
            : u
        );
        const nextCurrentUser =
          prev.currentUser && matchesTxUser(prev.currentUser)
            ? {
                ...prev.currentUser,
                plan: targetTx.planId,
                status:
                  prev.currentUser.status === 'restricted' &&
                  prev.currentUser.restrictedReason?.includes('Subscription billing')
                    ? ('active' as const)
                    : prev.currentUser.status,
                restrictedReason:
                  prev.currentUser.status === 'restricted' &&
                  prev.currentUser.restrictedReason?.includes('Subscription billing')
                    ? undefined
                    : prev.currentUser.restrictedReason,
                cancelAtPeriodEnd: false,
                planPeriodEndsAt: nextPeriodEndIso,
              }
            : prev.currentUser;

        return {
          ...prev,
          users: nextUsers,
          currentUser: nextCurrentUser,
          subscriptionTransactions: nextTransactions,
        };
      });
    },
    []
  );

  const adminDeleteBuyer = useCallback((buyerId: string) => {
    setState((prev) => ({
      ...prev,
      buyers: (prev.buyers ?? []).filter((b) => b.id !== buyerId),
      currentBuyer: prev.currentBuyer?.id === buyerId ? null : prev.currentBuyer,
    }));
  }, []);

  const markNotificationsRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setState((prev) => {
      const next = new Set(prev.readNotificationIds ?? []);
      let changed = false;
      ids.forEach((id) => {
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
    if (ids.length === 0) return;
    setState((prev) => {
      const nextDismissed = new Set(prev.dismissedNotificationIds ?? []);
      const nextRead = new Set(prev.readNotificationIds ?? []);
      ids.forEach((id) => {
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

  const updatePlatformPaymentSettings = useCallback((channels: PlatformPaymentChannel[]) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      platformPaymentSettings: {
        channels: channels.map((channel) => ({ ...channel })),
        updatedAt: nowIso,
      },
    }));
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      route,
      navigate,
      goBack,
      toasts,
      pushToast,
      dismissToast,
      signInUser,
      signUpUser,
      signInAdminUser,
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
      recordSubscriptionPayment,
      adminUpdateUser,
      adminDeleteUser,
      adminUpdateStore,
      adminToggleSubscriptionTxStatus,
      adminDeleteBuyer,
      platformPaymentSettings,
      updatePlatformPaymentSettings,
      markNotificationsRead,
      dismissNotifications,
    }),
    [
      state,
      route,
      navigate,
      goBack,
      toasts,
      pushToast,
      dismissToast,
      signInUser,
      signUpUser,
      signInAdminUser,
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
      recordSubscriptionPayment,
      adminUpdateUser,
      adminDeleteUser,
      adminUpdateStore,
      adminToggleSubscriptionTxStatus,
      adminDeleteBuyer,
      platformPaymentSettings,
      updatePlatformPaymentSettings,
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
