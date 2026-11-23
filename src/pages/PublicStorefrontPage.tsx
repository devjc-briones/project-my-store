import { useMemo, useState } from 'react';
import { ArrowLeft, Clock, Eye, EyeOff, Globe, Package, Paintbrush, ShieldAlert } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { StorefrontRenderer } from '../templates/StorefrontRenderer';
import { StorefrontViewPage } from '../templates/templateTypes';
import { Product } from '../types/schema';
import { isStoreTemporarilyClosedByBilling } from '../utils/billing';
import { getCombinedStoreOrders } from '../utils/storeOrders';
import { OrderTrackingModal } from '../components/storefront/OrderTrackingModal';
import { ProductDetailModal } from '../components/storefront/ProductDetailModal';
import { CartLineItem, StorefrontCartDrawer } from '../components/storefront/StorefrontCartDrawer';
import { BuyerAuthModal } from '../components/storefront/BuyerAuthModal';
import { BuyerAccountMenuModal } from '../components/storefront/BuyerAccountMenuModal';

export function PublicStorefrontPage() {
  const {
    route,
    state,
    navigate,
    getStoreBySlug,
    getStoreProducts,
    getStoreOrders,
    getPaymentSettings,
    placeCustomerOrder,
    pushToast,
  } = useStore();

  const slug = route.name === 'storefront' ? route.storeSlug : '';
  const activePage: StorefrontViewPage =
    route.name === 'storefront' && route.view === 'products'
      ? 'products'
      : route.name === 'storefront' && route.view === 'info-settings'
        ? 'info-settings'
        : 'home';
  const store = getStoreBySlug(slug);

  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingInitialOrderId, setTrackingInitialOrderId] = useState<string | null>(null);
  const [hideMerchantBar, setHideMerchantBar] = useState(false);
  const [buyerAuthOpen, setBuyerAuthOpen] = useState(false);
  const [buyerAccountOpen, setBuyerAccountOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [selectedProduct, setSelectedProduct] = useState<{
    product: Product;
    variant?: string;
  } | null>(null);

  const products = useMemo(
    () => (store ? getStoreProducts(store.id) : []),
    [store, getStoreProducts]
  );
  const liveOrders = useMemo(
    () => (store ? getStoreOrders(store.id) : []),
    [store, getStoreOrders]
  );
  const storeOrders = useMemo(
    () =>
      store
        ? getCombinedStoreOrders(store.name, products, liveOrders)
        : [],
    [store, products, liveOrders]
  );

  if (!store) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 h-16 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
            <Globe className="w-4 h-4 text-slate-400" />
            <span>mystore.com/{slug}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate({ name: state.currentUser ? 'dashboard' : 'landing' })}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {state.currentUser ? 'Back to Dashboard' : 'Back to mystore'}
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-8 space-y-3 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <h1 className="text-xl font-bold text-slate-900">Storefront Not Found</h1>
            <p className="text-sm text-slate-600">
              No online store exists at <span className="font-mono">mystore.com/{slug}</span>.
            </p>
            <button
              type="button"
              onClick={() => navigate({ name: state.currentUser ? 'dashboard' : 'landing' })}
              className="mt-2 inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  const storeOwner = store
    ? (state.users ?? []).find((u) => u.id === store.ownerId) ??
      (state.currentUser?.id === store.ownerId ? state.currentUser : undefined)
    : undefined;
  const isTemporarilyClosed = store
    ? isStoreTemporarilyClosedByBilling(store, storeOwner)
    : false;
  const isMerchantViewing = Boolean(state.currentUser);

  if (isTemporarilyClosed) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 h-16 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {store.branding.logoImageUrl ? (
              <img
                src={store.branding.logoImageUrl}
                alt={`${store.name} logo`}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: store.branding.primaryColor }}
              >
                {store.name.trim().charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-bold text-slate-900 truncate">{store.name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 shrink-0">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>mystore.com/{store.slug}</span>
          </div>
        </header>

        <main
          className={`flex-1 flex items-center justify-center p-6 ${
            isMerchantViewing && !hideMerchantBar ? 'pb-20' : ''
          }`}
        >
          <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-8 space-y-3 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {store.name}
            </p>
            <h1 className="text-xl font-bold text-slate-900">Shop Temporarily Closed</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              This shop is currently closed and not accepting orders right now. Please check back again soon.
            </p>
          </div>
        </main>

        {isMerchantViewing && !hideMerchantBar && (
          <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 z-40 bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl shadow-2xl px-3 sm:px-4 h-12 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-slate-200 whitespace-nowrap">
                Merchant Preview
              </span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-slate-400 truncate hidden sm:inline max-w-[180px]">
                {store.domainUrl} (closed)
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setHideMerchantBar(true)}
                className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                title="Preview as a customer without merchant controls"
              >
                <EyeOff className="w-3 h-3" />
                Customer View
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'store-products', storeId: store.id })}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                <Package className="w-3 h-3" />
                <span className="hidden sm:inline">Manage Shop</span>
                <span className="sm:hidden">Manage</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'dashboard' })}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </button>
            </div>
          </div>
        )}

        {isMerchantViewing && hideMerchantBar && (
          <button
            type="button"
            onClick={() => setHideMerchantBar(false)}
            className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900/90 hover:bg-slate-900 border border-slate-700 rounded-xl shadow-lg cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            Merchant Bar
          </button>
        )}
      </div>
    );
  }

  if (store.status === 'restricted') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 h-16 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
            <Globe className="w-4 h-4 text-slate-400" />
            <span>mystore.com/{store.slug}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate({ name: state.currentUser ? 'dashboard' : 'landing' })}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {state.currentUser ? 'Back to Dashboard' : 'Back to mystore'}
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-rose-200/80 rounded-2xl p-8 space-y-3 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Storefront Temporarily Restricted</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {store.restrictedReason ||
                `${store.name} is currently unavailable while under platform review.`}
            </p>
            <button
              type="button"
              onClick={() => navigate({ name: state.currentUser ? 'dashboard' : 'landing' })}
              className="mt-2 inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  const paymentSettings = getPaymentSettings(store.id);
  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const addItemToCart = (
    product: Product,
    variantLabel?: string,
    quantity = 1,
    customUnitPrice?: number
  ) => {
    const matchedVariant = variantLabel
      ? product.variants.find((v) => v.label === variantLabel)
      : undefined;
    const unitPrice =
      customUnitPrice ?? Math.max(0, product.finalPrice + (matchedVariant?.priceDelta ?? 0));
    const lineKey = `${product.id}::${variantLabel ?? 'default'}`;

    setCartItems((prev) => {
      const existing = prev.find((item) => item.key === lineKey);
      if (existing) {
        return prev.map((item) =>
          item.key === lineKey
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          key: lineKey,
          productId: product.id,
          variantId: matchedVariant?.id,
          name: product.name,
          variant: variantLabel,
          imageUrl: product.imageUrl,
          unitPrice,
          quantity,
        },
      ];
    });

    pushToast({
      type: 'success',
      title: 'Added to bag',
      description: `${quantity}× ${product.name}${variantLabel ? ` (${variantLabel})` : ''}`,
    });
  };

  const handleUpdateQuantity = (key: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (key: string) => {
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Dynamic Industry Storefront */}
      <div className="flex-1 flex flex-col">
        <StorefrontRenderer
          store={store}
          products={products}
          currency={paymentSettings.currency}
          cartCount={totalCartCount}
          showSearchBar
          activePage={activePage}
          onChangePage={(page) => {
            navigate({ name: 'storefront', storeSlug: store.slug, view: page });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          currentBuyer={state.currentBuyer}
          onOpenCart={() => setCartOpen(true)}
          onOpenTrackOrder={() => {
            setTrackingInitialOrderId(null);
            setTrackingOpen(true);
          }}
          onOpenBuyerAuth={() => {
            setAuthModalMode('signin');
            setBuyerAuthOpen(true);
          }}
          onOpenBuyerAccount={() => setBuyerAccountOpen(true)}
          onSelectProduct={(product, preselectedVariant) =>
            setSelectedProduct({ product, variant: preselectedVariant })
          }
          onAddToCart={(product, variantLabel) => addItemToCart(product, variantLabel, 1)}
        />
      </div>

      {/* Floating Merchant Preview Bar (anchored at bottom so fixed storefront header stays cleanly at top-0) */}
      {isMerchantViewing && !hideMerchantBar && (
        <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 z-40 bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl shadow-2xl px-3 sm:px-4 h-12 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-200 whitespace-nowrap">
              Merchant Preview
            </span>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-400 truncate hidden sm:inline max-w-[180px]">
              {store.domainUrl} ({store.status})
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setHideMerchantBar(true)}
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
              title="Preview as a customer without merchant controls"
            >
              <EyeOff className="w-3 h-3" />
              Customer View
            </button>
            <button
              type="button"
              onClick={() => navigate({ name: 'store-customize', storeId: store.id })}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
            >
              <Paintbrush className="w-3 h-3" />
              Edit UI
            </button>
            <button
              type="button"
              onClick={() => navigate({ name: 'store-products', storeId: store.id })}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
            >
              <Package className="w-3 h-3" />
              <span className="hidden sm:inline">Manage Store</span>
              <span className="sm:hidden">Manage</span>
            </button>
            <button
              type="button"
              onClick={() => navigate({ name: 'dashboard' })}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Dashboard</span>
            </button>
          </div>
        </div>
      )}

      {isMerchantViewing && hideMerchantBar && (
        <button
          type="button"
          onClick={() => setHideMerchantBar(false)}
          className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900/90 hover:bg-slate-900 border border-slate-700 rounded-xl shadow-lg cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          Merchant Bar
        </button>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct?.product ?? null}
        initialVariant={selectedProduct?.variant}
        store={store}
        currency={paymentSettings.currency}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(product, variantLabel, quantity, unitPrice) =>
          addItemToCart(product, variantLabel, quantity, unitPrice)
        }
      />

      {/* Slide-Over Cart & Auto-Calculated Checkout Drawer */}
      <StorefrontCartDrawer
        isOpen={cartOpen}
        store={store}
        items={cartItems}
        paymentSettings={paymentSettings}
        onClose={() => setCartOpen(false)}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={() => setCartItems([])}
        onOpenInfoSettings={() => {
          setCartOpen(false);
          navigate({ name: 'storefront', storeSlug: store.slug, view: 'info-settings' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onTrackOrder={(orderId) => {
          setCartOpen(false);
          setTrackingInitialOrderId(orderId);
          setTrackingOpen(true);
        }}
        onPlaceOrder={(orderInput) => {
          const order = placeCustomerOrder(orderInput);
          pushToast({
            type: 'success',
            title: `Order #${order.id} confirmed!`,
            description: 'Your receipt is ready.',
          });
          return order;
        }}
      />

      {/* Live Customer Order Tracking Drawer */}
      <OrderTrackingModal
        isOpen={trackingOpen}
        store={store}
        orders={storeOrders}
        currency={paymentSettings.currency}
        initialOrderId={trackingInitialOrderId}
        onClose={() => setTrackingOpen(false)}
      />

      {/* Buyer Authentication Modal */}
      <BuyerAuthModal
        isOpen={buyerAuthOpen}
        initialMode={authModalMode}
        onClose={() => setBuyerAuthOpen(false)}
        onSuccess={() => setBuyerAuthOpen(false)}
        storeId={store.id}
        storeName={store.name}
      />

      {/* Buyer Account & Order History Modal */}
      <BuyerAccountMenuModal
        isOpen={buyerAccountOpen}
        store={store}
        currency={paymentSettings.currency}
        onClose={() => setBuyerAccountOpen(false)}
        onOpenInfoSettings={() => {
          setBuyerAccountOpen(false);
          navigate({ name: 'storefront', storeSlug: store.slug, view: 'info-settings' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenTracking={(orderId) => {
          setBuyerAccountOpen(false);
          setTrackingInitialOrderId(orderId);
          setTrackingOpen(true);
        }}
      />
    </div>
  );
}
