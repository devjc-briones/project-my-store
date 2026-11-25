import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  CreditCard,
  Eye,
  LayoutDashboard,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  Trash2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getPlanLimits } from '../data/plans';
import { INDUSTRY_TEMPLATES } from '../data/templates';
import { TEMPLATE_SHOWCASE_MEDIA } from '../data/templateVisuals';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { buildRoutePath } from '../router/routes';
import { OrderFulfillmentStatus, PaymentSettings, Product } from '../types/schema';
import { isUserPlanPastDue } from '../utils/billing';
import { calculateSmartPricing, formatCurrency } from '../utils/pricing';
import { getCombinedStoreOrders } from '../utils/storeOrders';
import { ProductEditorDrawer } from '../components/products/ProductEditorDrawer';
import { PaymentSettingsTab } from '../components/products/PaymentSettingsTab';
import { OrdersPreviewTab } from '../components/products/OrdersPreviewTab';
import { StoreOverviewTab } from '../components/products/StoreOverviewTab';
import { StoreIdentityHeader } from '../components/products/StoreIdentityHeader';

type ManagerTab = 'overview' | 'products' | 'payments' | 'orders';
type StockFilter = 'all' | 'in-stock' | 'sold-out';

const NON_KEYBOARD_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'radio',
  'submit',
  'reset',
  'file',
  'range',
  'color',
  'hidden',
]);

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  if (target instanceof HTMLInputElement) {
    return !NON_KEYBOARD_INPUT_TYPES.has(target.type);
  }
  return target.isContentEditable;
}

export function StoreProductsManagerPage() {
  const {
    route,
    state,
    navigate,
    getStoreProducts,
    getStoreOrders,
    updateOrderStatus,
    updateOrderPaymentStatus,
    createProduct,
    updateProduct,
    deleteProduct,
    getPaymentSettings,
    updatePaymentSettings,
    updateStoreMeta,
    pushToast,
  } = useStore();

  const storeId = 'storeId' in route ? route.storeId : '';
  const store = useMemo(
    () => state.stores.find((s) => s.id === storeId),
    [state.stores, storeId]
  );

  const [activeTab, setActiveTab] = useState<ManagerTab>(() => {
    if (route.name === 'store-payments') return 'payments';
    if (route.name === 'store-products' && route.initialTab) return route.initialTab;
    return store?.status === 'published' ? 'overview' : 'products';
  });

  const [menuOpen, setMenuOpen] = useState(false);
  useBodyScrollLock(menuOpen);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const blurTimerRef = useRef<number | null>(null);
  const maxViewportHeightRef = useRef<number>(
    typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 0
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    let wasKeyboardOpen = false;

    const handleResize = () => {
      const currentHeight = vv.height;
      if (currentHeight > maxViewportHeightRef.current) {
        maxViewportHeightRef.current = currentHeight;
      }
      const shrunk = maxViewportHeightRef.current - currentHeight > 130;
      if (shrunk) {
        wasKeyboardOpen = true;
        setIsKeyboardOpen(true);
      } else if (wasKeyboardOpen) {
        wasKeyboardOpen = false;
        setIsKeyboardOpen(false);
        setIsInputFocused(false);
      }
    };

    const handleOrientation = () => {
      maxViewportHeightRef.current = vv.height;
      setIsKeyboardOpen(false);
    };

    vv.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientation);
    return () => {
      vv.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  const handleMainFocusCapture = (event: React.FocusEvent<HTMLElement>) => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    if (isEditableElement(event.target)) {
      setIsInputFocused(true);
    }
  };

  const handleMainBlurCapture = () => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
    }
    blurTimerRef.current = window.setTimeout(() => {
      if (!isEditableElement(document.activeElement)) {
        setIsInputFocused(false);
      }
    }, 80);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const routeInitialTab = route.name === 'store-products' ? route.initialTab : undefined;

  useEffect(() => {
    if (route.name === 'store-payments') {
      setActiveTab('payments');
    } else if (route.name === 'store-products' && routeInitialTab) {
      setActiveTab(routeInitialTab);
    } else if (store?.status === 'published') {
      setActiveTab('overview');
    } else {
      setActiveTab('products');
    }
    setMenuOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, route.name, routeInitialTab]);

  useEffect(() => {
    if (store?.status !== 'published' && activeTab === 'overview') {
      setActiveTab('products');
    }
  }, [store?.status, activeTab]);

  // Product list filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  // Product Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Payment settings draft state
  const persistedSettings = useMemo(
    () => (store ? getPaymentSettings(store.id) : null),
    [store, getPaymentSettings]
  );

  const [draftPayments, setDraftPayments] = useState<PaymentSettings | null>(persistedSettings);
  const [hasUnsavedPayments, setHasUnsavedPayments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (persistedSettings) {
      setDraftPayments(persistedSettings);
      setHasUnsavedPayments(false);
    }
  }, [store?.id]);

  const storeProducts = useMemo(
    () => (store ? getStoreProducts(store.id) : []),
    [store, getStoreProducts]
  );

  const liveOrders = useMemo(
    () => (store ? getStoreOrders(store.id) : []),
    [store, getStoreOrders]
  );

  const combinedOrders = useMemo(
    () =>
      store
        ? getCombinedStoreOrders(store.name, storeProducts, liveOrders)
        : [],
    [store, storeProducts, liveOrders]
  );

  const allCategories = useMemo(() => {
    const productCats = storeProducts.map((p) => p.category).filter(Boolean);
    return Array.from(new Set(productCats));
  }, [storeProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return storeProducts.filter((prd) => {
      if (categoryFilter !== 'all' && prd.category !== categoryFilter) return false;
      if (stockFilter === 'in-stock' && !prd.isAvailable) return false;
      if (stockFilter === 'sold-out' && prd.isAvailable) return false;
      if (
        q &&
        !prd.name.toLowerCase().includes(q) &&
        !prd.sku.toLowerCase().includes(q) &&
        !prd.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [storeProducts, searchQuery, categoryFilter, stockFilter]);

  if (!store || !draftPayments) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-700">
            <StoreIcon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Store Not Found</h1>
          <p className="text-sm text-slate-600">
            This store could not be found in your workspace.
          </p>
          <button
            type="button"
            onClick={() => navigate({ name: 'dashboard' })}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const effectiveTab: ManagerTab =
    store.status !== 'published' && activeTab === 'overview' ? 'products' : activeTab;
  const templateMeta = INDUSTRY_TEMPLATES[store.templateId];
  const fallbackImage = TEMPLATE_SHOWCASE_MEDIA[store.templateId].imageUrl;
  const shopPath = buildRoutePath({ name: 'storefront', storeSlug: store.slug });

  const handleOpenAddProduct = () => {
    const limits = getPlanLimits(state.currentUser?.plan ?? 'starter');
    if (storeProducts.length >= limits.maxProductsPerStore) {
      pushToast({
        type: 'error',
        title: 'Product limit reached',
        description: `Your ${limits.label} plan allows up to ${limits.maxProductsPerStore} products per store. Upgrade your plan for unlimited products.`,
      });
      return;
    }
    setEditingProduct(null);
    setDrawerOpen(true);
  };

  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setDrawerOpen(true);
  };

  const handleSaveProduct = async (
    payload: Parameters<typeof ProductEditorDrawer>[0]['onSave'] extends (p: infer P) => void ? P : never
  ) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (editingProduct) {
        const res = await updateProduct(editingProduct.id, payload);
        if (!res.success) {
          pushToast({
            type: 'error',
            title: 'Could not update product',
            description: res.error || 'Failed to save product changes.',
          });
          return;
        }
        pushToast({
          type: 'success',
          title: 'Product updated',
          description: `${payload.name} saved with updated pricing.`,
        });
      } else {
        const res = await createProduct({
          storeId: store.id,
          ...payload,
        });
        if (!res.success) {
          pushToast({
            type: 'error',
            title: 'Could not add product',
            description: res.error || 'Failed to save new product.',
          });
          return;
        }
        pushToast({
          type: 'success',
          title: 'Product added',
          description: `${payload.name} is now in your store catalog.`,
        });
      }
      setDrawerOpen(false);
      setEditingProduct(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaymentDraftChange = (patch: Partial<PaymentSettings>) => {
    setDraftPayments((prev) => (prev ? { ...prev, ...patch } : prev));
    setHasUnsavedPayments(true);
  };

  const handleSaveAllChanges = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await updatePaymentSettings(store.id, draftPayments);
      if (!res.success) {
        pushToast({
          type: 'error',
          title: 'Could not save changes',
          description: res.error || 'Failed to save payment & checkout settings.',
        });
        return;
      }
      setHasUnsavedPayments(false);
      pushToast({
        type: 'success',
        title: 'All changes saved',
        description: `Catalog and payment settings for ${store.name} have been saved.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishUpdates = async () => {
    if (isSaving) return;
    if (store.status === 'restricted') {
      pushToast({
        type: 'error',
        title: 'Store restricted by admin',
        description:
          store.restrictedReason ||
          'This store cannot be published while restricted by the platform admin.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const wasDraft = store.status === 'draft';
      const owner =
        (state.users ?? []).find((u) => u.id === store.ownerId) ??
        (state.currentUser?.id === store.ownerId ? state.currentUser : undefined);
      const ownerPastDue = isUserPlanPastDue(owner);

      const payRes = await updatePaymentSettings(store.id, draftPayments);
      if (!payRes.success) {
        pushToast({
          type: 'error',
          title: 'Could not publish store',
          description: payRes.error || 'Failed to save payment settings.',
        });
        return;
      }

      const metaRes = await updateStoreMeta(store.id, { status: 'published' });
      if (!metaRes.success) {
        pushToast({
          type: 'error',
          title: 'Could not publish store',
          description: metaRes.error || 'Failed to publish store status.',
        });
        return;
      }

      setHasUnsavedPayments(false);
      pushToast({
        type: ownerPastDue ? 'info' : 'success',
        title: ownerPastDue
          ? 'Changes saved (Shop closed until paid)'
          : wasDraft
            ? 'Store published live!'
            : 'Updates published live!',
        description: ownerPastDue
          ? `${store.name} stays temporarily closed to buyers until your due plan payment is approved.`
          : wasDraft
            ? `${store.domainUrl} is live — your Store Overview Dashboard is now unlocked.`
            : `${store.domainUrl} is live with your latest products and fees.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateOrderStatus = (
    orderId: string,
    status: OrderFulfillmentStatus
  ) => {
    updateOrderStatus(orderId, status);
  };

  const handleUpdateOrderPaymentStatus = (
    orderId: string,
    paymentStatus: Parameters<typeof updateOrderPaymentStatus>[1]
  ) => {
    updateOrderPaymentStatus(orderId, paymentStatus);
    pushToast({
      type: paymentStatus === 'paid' ? 'success' : 'info',
      title: `Payment status updated`,
      description: `Order ${orderId} payment marked as ${paymentStatus.replace('_', ' ')}.`,
    });
  };

  const handleSelectTab = (tab: ManagerTab) => {
    setActiveTab(tab);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseMenuAndNavigate = (next: Parameters<typeof navigate>[0]) => {
    setMenuOpen(false);
    navigate(next);
  };

  const isPublished = store.status === 'published';
  const showSavePublishBar = effectiveTab !== 'overview' && effectiveTab !== 'products';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Slim Single-Row Fixed Top Navbar (matches LandingNavbar) */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-3">
          {/* Left: Minimal Back Arrow Icon Button */}
          <button
            type="button"
            aria-label="Back to Dashboard"
            onClick={() => handleCloseMenuAndNavigate({ name: 'dashboard' })}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all shrink-0 cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Center: Compact Store Name */}
          <div className="min-w-0 flex-1 text-center px-2">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {store.name}
            </h1>
          </div>

          {/* Right: Morphing Burger -> X Menu Button */}
          <button
            type="button"
            aria-label={menuOpen ? 'Close store menu' : 'Open store menu'}
            aria-expanded={menuOpen}
            aria-controls="store-manager-drawer"
            onClick={() => setMenuOpen((prev) => !prev)}
            className={`relative z-50 w-11 h-11 rounded-xl flex flex-col items-center justify-center bg-slate-100/90 hover:bg-slate-200/80 active:scale-95 transition-all duration-200 cursor-pointer touch-manipulation select-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
              menuOpen ? 'menu-open bg-slate-200/80' : ''
            }`}
          >
            <span className="sr-only">{menuOpen ? 'Close store menu' : 'Open store menu'}</span>
            <div className="w-5 h-4 flex flex-col justify-between items-center pointer-events-none">
              <span className="burger-line line-1 block w-5 h-[2px] rounded-full bg-slate-800" />
              <span className="burger-line line-2 block w-5 h-[2px] rounded-full bg-slate-800" />
              <span className="burger-line line-3 block w-5 h-[2px] rounded-full bg-slate-800" />
            </div>
          </button>
        </div>
      </header>

      {/* Spacer matching fixed header height */}
      <div className="h-16 shrink-0" aria-hidden="true" />

      {/* Dimmed Backdrop Overlay */}
      <div
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-40 bg-slate-950/40 touch-none transition-opacity duration-300 ease-out ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Hamburger Overlay Drawer (Matches Landing Navbar Style) */}
      <aside
        id="store-manager-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!menuOpen}
        aria-label="Store Management Menu"
        className={`fixed top-[4.5rem] left-3 right-3 sm:left-auto sm:right-6 lg:right-8 sm:w-full sm:max-w-sm z-[45] rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl shadow-slate-900/15 p-5 max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          menuOpen
            ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto drawer-active'
            : '-translate-y-4 scale-[0.97] opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-2 pb-3 mb-2 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-900 truncate">{store.name}</span>
          <span
            className={`text-xs font-semibold shrink-0 ${
              isPublished ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {isPublished ? 'Published' : 'Draft'}
          </span>
        </div>

        <nav className="flex flex-col gap-1.5" aria-label="Store sections">
          {isPublished && (
            <button
              type="button"
              onClick={() => handleSelectTab('overview')}
              className={`nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm sm:text-base transition-colors cursor-pointer touch-manipulation ${
                effectiveTab === 'overview'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100/80 font-medium'
              }`}
            >
              <span className="flex items-center gap-3">
                <LayoutDashboard
                  className={`w-5 h-5 ${
                    effectiveTab === 'overview' ? 'text-slate-900' : 'text-slate-400'
                  }`}
                />
                Overview
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSelectTab('products')}
            className={`nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm sm:text-base transition-colors cursor-pointer touch-manipulation ${
              effectiveTab === 'products'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-700 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <span className="flex items-center gap-3">
              <Package
                className={`w-5 h-5 ${
                  effectiveTab === 'products' ? 'text-slate-900' : 'text-slate-400'
                }`}
              />
              <span>1. Products &amp; Pricing</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold tabular-nums bg-slate-200/80 text-slate-700">
              {storeProducts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('payments')}
            className={`nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm sm:text-base transition-colors cursor-pointer touch-manipulation ${
              effectiveTab === 'payments'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-700 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <span className="flex items-center gap-3">
              <CreditCard
                className={`w-5 h-5 ${
                  effectiveTab === 'payments' ? 'text-slate-900' : 'text-slate-400'
                }`}
              />
              2. Payment Methods
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('orders')}
            className={`nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm sm:text-base transition-colors cursor-pointer touch-manipulation ${
              effectiveTab === 'orders'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-700 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <span className="flex items-center gap-3">
              <ShoppingBag
                className={`w-5 h-5 ${
                  effectiveTab === 'orders' ? 'text-slate-900' : 'text-slate-400'
                }`}
              />
              3. Orders
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Divider + Quick Actions */}
          <div className="nav-item-stagger mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={() =>
                handleCloseMenuAndNavigate({ name: 'store-customize', storeId: store.id })
              }
              className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit Store UI</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleCloseMenuAndNavigate({ name: 'storefront', storeSlug: store.slug })
              }
              className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-semibold text-sm shadow-lg shadow-slate-900/15 transition-all flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
            >
              <Eye className="w-4 h-4" />
              <span>{isPublished ? 'View Live Shop' : 'Preview Draft'}</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main
        onFocusCapture={handleMainFocusCapture}
        onBlurCapture={handleMainBlurCapture}
        className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${
          showSavePublishBar
            ? isInputFocused || isKeyboardOpen
              ? 'pb-8 md:pb-28'
              : 'pb-28'
            : ''
        }`}
      >
        {/* Desktop Tab Switcher (kept out of slim sticky top bar) */}
        <div className="hidden md:flex items-center gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
          {isPublished && (
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                effectiveTab === 'overview'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              effectiveTab === 'products'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>1. Products &amp; Pricing</span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              ({storeProducts.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              effectiveTab === 'payments'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>2. Payment Methods &amp; Checkout Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              effectiveTab === 'orders'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>3. Orders</span>
          </button>
        </div>

        {/* Published: Full Store Header placed directly at top of Overview tab */}
        {isPublished && effectiveTab === 'overview' && (
          <div className="space-y-6">
            <StoreIdentityHeader
              store={store}
              categoryName={templateMeta.name}
              onEditUi={() => navigate({ name: 'store-customize', storeId: store.id })}
              onViewShop={() => navigate({ name: 'storefront', storeSlug: store.slug })}
            />

            <StoreOverviewTab
              store={store}
              products={storeProducts}
              orders={combinedOrders}
              currency={draftPayments.currency}
              shopPath={shopPath}
              onAddProduct={handleOpenAddProduct}
              onRestockProduct={(product) => {
                setActiveTab('products');
                handleOpenEditProduct(product);
              }}
              onViewAllOrders={() => setActiveTab('orders')}
              onCopySuccess={(domainUrl) =>
                pushToast({
                  type: 'success',
                  title: 'Store link copied!',
                  description: domainUrl,
                })
              }
            />
          </div>
        )}

        {effectiveTab === 'products' && (
          <section className="space-y-6">
            {/* Draft: Full Store Header + Subtle Publish Callout placed at top of Products & Pricing */}
            {!isPublished && (
              <div className="space-y-4">
                <StoreIdentityHeader
                  store={store}
                  categoryName={templateMeta.name}
                  onEditUi={() => navigate({ name: 'store-customize', storeId: store.id })}
                  onViewShop={() => navigate({ name: 'storefront', storeSlug: store.slug })}
                />

                <div className="bg-white border border-slate-200/80 rounded-2xl px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900">
                        Draft Store — Set up products, pricing, and checkout first
                      </p>
                      <p className="text-xs text-slate-600">
                        Publishing your store will automatically unlock the live{' '}
                        <span className="font-semibold text-slate-800">
                          Store Overview Dashboard
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePublishUpdates}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Publish Store
                  </button>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Products &amp; Inventory</h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Manage catalog items, variants, auto-calculated promos, and stock status.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddProduct}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add New Product
              </button>
            </div>

            {storeProducts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl px-6 py-16 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mb-4">
                  <PackagePlus className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No products in this store yet</h3>
                <p className="text-sm text-slate-600 mt-1.5 max-w-md">
                  Add your first product with smart discount pricing, profit margin calculation, and
                  variants.
                </p>
              </div>
            ) : (
              <>
                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        aria-label="Search products"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by product name or SKU..."
                        className="w-full min-h-[40px] pl-10 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>

                    <select
                      aria-label="Filter by category"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="min-h-[40px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      {allCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl self-start md:self-auto">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'in-stock', label: 'In Stock' },
                        { id: 'sold-out', label: 'Sold Out' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStockFilter(st.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          stockFilter === st.id
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Grid / List */}
                {filteredProducts.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                    <p className="text-sm font-semibold text-slate-900">
                      No products match your search or filters.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setCategoryFilter('all');
                        setStockFilter('all');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredProducts.map((product) => {
                      const smart = calculateSmartPricing({
                        basePrice: product.basePrice,
                        discountType:
                          product.discountType ??
                          (product.discountPercent > 0 ? 'percentage' : 'none'),
                        discountValue:
                          product.discountValue ??
                          (product.discountPercent > 0 ? product.discountPercent : 0),
                        costPrice: product.costPrice,
                      });

                      return (
                        <article
                          key={product.id}
                          className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col justify-between shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md transition-shadow"
                        >
                          <div>
                            <div className="relative aspect-[16/10] bg-slate-100 border-b border-slate-200/80 overflow-hidden">
                              <img
                                src={product.imageUrl || fallbackImage}
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              {!product.isAvailable && (
                                <div className="absolute inset-0 bg-slate-900/55 flex items-center justify-center">
                                  <span className="px-3 py-1 bg-white text-slate-900 text-xs font-bold rounded-lg">
                                    Sold Out
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="p-5 space-y-3">
                              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                                <span className="truncate font-medium">
                                  {product.category} · <span className="font-mono">{product.sku}</span>
                                </span>
                                {product.isFeatured && (
                                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 shrink-0">
                                    <Sparkles className="w-3 h-3" />
                                    Featured
                                  </span>
                                )}
                              </div>

                              <div>
                                <h3 className="text-base font-bold text-slate-900 leading-snug">
                                  {product.name}
                                </h3>
                                <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                                  {product.description}
                                </p>
                              </div>

                              {/* Price & Margin Summary */}
                              <div className="pt-2 border-t border-slate-100 flex items-end justify-between gap-3">
                                <div>
                                  <div className="flex items-baseline gap-2 tabular-nums">
                                    <span className="text-lg font-bold text-slate-900">
                                      {formatCurrency(product.finalPrice, draftPayments.currency)}
                                    </span>
                                    {smart.customerSavings > 0 && (
                                      <span className="text-xs text-slate-400 line-through">
                                        {formatCurrency(product.basePrice, draftPayments.currency)}
                                      </span>
                                    )}
                                  </div>
                                  {smart.customerSavings > 0 && (
                                    <p className="text-[11px] font-semibold text-emerald-700 tabular-nums">
                                      Saves {formatCurrency(smart.customerSavings, draftPayments.currency)} ({smart.effectiveDiscountPercent}%)
                                    </p>
                                  )}
                                  {smart.profitAmount !== null && (
                                    <p className="text-[11px] text-slate-500 tabular-nums">
                                      Margin: {formatCurrency(smart.profitAmount, draftPayments.currency)} ({smart.profitMarginPercent}%)
                                    </p>
                                  )}
                                </div>

                                <div className="text-right text-xs tabular-nums">
                                  <span className="font-semibold text-slate-700">
                                    {product.stock} in stock
                                  </span>
                                  {product.variants.length > 0 && (
                                    <p className="text-[11px] text-slate-500">
                                      {product.variants.length} options
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Card Actions */}
                          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await updateProduct(product.id, {
                                  isAvailable: !product.isAvailable,
                                });
                                if (!res.success) {
                                  pushToast({
                                    type: 'error',
                                    title: 'Update failed',
                                    description: res.error || 'Could not update availability.',
                                  });
                                  return;
                                }
                                pushToast({
                                  type: 'info',
                                  title: !product.isAvailable
                                    ? 'Marked In Stock'
                                    : 'Marked Sold Out',
                                  description: product.name,
                                });
                              }}
                              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                                product.isAvailable
                                  ? 'bg-white border-slate-200 text-emerald-700 hover:bg-emerald-50'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {product.isAvailable ? 'In Stock' : 'Sold Out'}
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditProduct(product)}
                                className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>

                              {confirmDeleteId === product.id ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const res = await deleteProduct(product.id);
                                    setConfirmDeleteId(null);
                                    if (!res.success) {
                                      pushToast({
                                        type: 'error',
                                        title: 'Delete failed',
                                        description: res.error || 'Could not delete product.',
                                      });
                                      return;
                                    }
                                    pushToast({
                                      type: 'info',
                                      title: 'Product deleted',
                                      description: `${product.name} removed from catalog.`,
                                    });
                                  }}
                                  className="min-h-[34px] px-2.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                                >
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  aria-label={`Delete ${product.name}`}
                                  onClick={() => setConfirmDeleteId(product.id)}
                                  className="min-h-[34px] w-[34px] flex items-center justify-center text-slate-500 hover:text-rose-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {effectiveTab === 'payments' && (
          <PaymentSettingsTab
            settings={draftPayments}
            onChange={handlePaymentDraftChange}
          />
        )}

        {effectiveTab === 'orders' && (
          <OrdersPreviewTab
            storeName={store.name}
            currency={draftPayments.currency}
            orders={combinedOrders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateOrderPaymentStatus={handleUpdateOrderPaymentStatus}
          />
        )}
      </main>

      {/* Sticky Save All Changes & Publish Updates Bar (hidden on Overview and Products & Pricing tabs) */}
      {showSavePublishBar && (
        <footer
          className={`${
            isInputFocused || isKeyboardOpen ? 'relative md:sticky md:bottom-0' : 'sticky bottom-0'
          } z-20 bg-white/95 backdrop-blur-sm border-t border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3`}
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 text-center sm:text-left">
            <div className="text-xs text-slate-600 w-full sm:w-auto">
              {hasUnsavedPayments ? (
                <span className="font-semibold text-amber-700">
                  Unsaved payment &amp; checkout fee changes
                </span>
              ) : (
                <span>
                  All changes saved locally · Status:{' '}
                  <strong className="text-slate-900 capitalize">{store.status}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveAllChanges}
                disabled={isSaving}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span>{isSaving ? 'Saving...' : 'Save All Changes'}</span>
              </button>

              <button
                type="button"
                onClick={handlePublishUpdates}
                disabled={isSaving}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>{isSaving ? 'Publishing...' : 'Publish Updates'}</span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Add / Edit Product Slide-Over Drawer */}
      <ProductEditorDrawer
        isOpen={drawerOpen}
        storeId={store.id}
        templateId={store.templateId}
        currency={draftPayments.currency}
        editingProduct={editingProduct}
        onClose={() => {
          setDrawerOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
      />
    </div>
  );
}
