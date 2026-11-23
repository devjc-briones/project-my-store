import { useMemo, useState } from 'react';
import { CupSoda, Image as ImageIcon, Instagram, Plus } from 'lucide-react';
import { TEMPLATE_SHOWCASE_MEDIA } from '../data/templateVisuals';
import { formatCurrency } from '../utils/pricing';
import {
  StorefrontAllProductsHeader,
  StorefrontHeader,
  StorefrontProductPagination,
  TemplateAnnouncementBar,
  TemplateFooter,
  TemplateSearchInput,
  ViewAllProductsCta,
} from './TemplateChrome';
import {
  StorefrontTemplateProps,
  getDisplayProductsForTemplate,
  resolveThemeTokens,
  useStorefrontPage,
} from './templateTypes';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePagination } from '../components/common/TablePagination';

const ICE_LEVELS = ['Regular Ice', 'Less Ice'];
const SUGAR_LEVELS = ['100% Sugar', '50% Sugar', '0% Sugar'];

export function DrinksTemplate({
  store,
  products,
  currency = 'PHP',
  viewport = 'desktop',
  isPreview = false,
  cartCount,
  showSearchBar = false,
  activePage: controlledPage,
  onChangePage,
  currentBuyer,
  onOpenCart,
  onOpenTrackOrder,
  onOpenBuyerAuth,
  onOpenBuyerAccount,
  onSelectProduct,
  onAddToCart,
}: StorefrontTemplateProps) {
  const [currentPage, setCurrentPage] = useStorefrontPage(controlledPage, onChangePage);
  const theme = resolveThemeTokens(store.branding, 'cafe-drinks');
  const isMobile = viewport === 'mobile';
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA['cafe-drinks'].imageUrl;
  const heroImg = store.branding.heroBannerUrl?.trim();
  const heroTitle = store.branding.heroTitle?.trim() || store.name?.trim() || 'Your Store Name';
  const heroSubtitle = store.branding.heroSubtitle?.trim();
  const sellerInstagram = store.branding.socialLinks.instagram?.trim();
  const displayItems = useMemo(() => getDisplayProductsForTemplate(store, products), [store, products]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useBodyScrollLock(mobileMenuOpen && !isPreview);

  const categories = useMemo(() => {
    const productCats = Array.from(new Set(displayItems.map((item) => item.product.category)));
    return ['All Drinks', ...productCats.slice(0, 4)];
  }, [displayItems]);

  const [activeCategory, setActiveCategory] = useState('All Drinks');
  const [searchQuery, setSearchQuery] = useState('');
  const [bagCount, setBagCount] = useState(0);
  const [cupPrefs, setCupPrefs] = useState<
    Record<string, { size: string; ice: string; sugar: string }>
  >({});

  const featuredItem = displayItems[0];
  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayItems.filter((item) => {
      if (activeCategory !== 'All Drinks' && item.product.category !== activeCategory) {
        return false;
      }
      if (
        q &&
        !item.product.name.toLowerCase().includes(q) &&
        !item.product.description.toLowerCase().includes(q) &&
        !item.product.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [displayItems, activeCategory, searchQuery]);

  const pagination = usePagination(
    visibleItems,
    6,
    `${activeCategory}::${searchQuery}::${currentPage}`
  );
  const displayedItems =
    currentPage === 'products' ? pagination.paginatedItems : visibleItems.slice(0, 3);

  const getPref = (productId: string, defaultSize: string) =>
    cupPrefs[productId] ?? {
      size: defaultSize || '12oz',
      ice: 'Regular Ice',
      sugar: '50% Sugar',
    };

  const updatePref = (
    productId: string,
    defaultSize: string,
    patch: Partial<{ size: string; ice: string; sugar: string }>
  ) => {
    setCupPrefs((prev) => ({
      ...prev,
      [productId]: {
        ...getPref(productId, defaultSize),
        ...patch,
      },
    }));
  };

  const handleAddCup = (item: (typeof displayItems)[number]) => {
    const defaultSize = item.product.variants[0]?.label ?? '12oz';
    const pref = getPref(item.product.id, defaultSize);
    setBagCount((c) => c + 1);
    onAddToCart?.(item.product, `${pref.size} · ${pref.ice} · ${pref.sugar}`);
  };

  return (
    <div
      className="min-h-full flex flex-col relative isolate"
      style={{
        backgroundColor: theme.canvasBg,
        color: theme.textPrimary,
        fontFamily: theme.bodyFontFamily,
      }}
    >
      <StorefrontHeader
        store={store}
        theme={theme}
        isOpen={mobileMenuOpen}
        isPreview={isPreview}
        isMobileLayout={isMobile}
        cartCount={cartCount ?? bagCount}
        cartLabel="Cup Order"
        currentBuyer={currentBuyer}
        activePage={currentPage}
        onNavigatePage={setCurrentPage}
        onToggle={() => setMobileMenuOpen((prev) => !prev)}
        onClose={() => setMobileMenuOpen(false)}
        onOpenBuyerAuth={onOpenBuyerAuth}
        onOpenBuyerAccount={onOpenBuyerAccount}
        onOpenTrackOrder={onOpenTrackOrder}
        onOpenCart={onOpenCart}
      />

      <TemplateAnnouncementBar store={store} theme={theme} />

      {/* Split Editorial Featured Drink Spotlight (Landing Page only) */}
      {currentPage === 'home' && (
      <section className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6 sm:pt-8">
        <div
          className={`border rounded-2xl overflow-hidden grid items-stretch ${
            isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
          }`}
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.borderColor,
          }}
        >
          <div
            className={`p-6 sm:p-8 flex flex-col justify-between gap-6 ${
              isMobile ? '' : 'lg:col-span-6'
            }`}
          >
            <div className="space-y-3">
              {sellerInstagram && (
                <p
                  className="text-xs font-semibold flex items-center gap-1.5"
                  style={{ color: theme.accentTextColor }}
                >
                  <Instagram className="w-3.5 h-3.5 shrink-0" />
                  <span>{sellerInstagram}</span>
                </p>
              )}
              <h1
                className={`font-bold leading-tight text-balance ${
                  isMobile ? 'text-2xl' : 'text-3xl sm:text-4xl'
                }`}
                style={{ fontFamily: theme.headingFontFamily }}
              >
                {heroTitle}
              </h1>
              {heroSubtitle && (
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.textMuted }}>
                  {heroSubtitle}
                </p>
              )}
            </div>

            {featuredItem && (
              <div
                className="p-4 rounded-xl border flex items-center justify-between gap-4"
                style={{
                  backgroundColor: theme.subtleBg,
                  borderColor: theme.borderColor,
                }}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium" style={{ color: theme.textMuted }}>
                    Barista Spotlight
                  </p>
                  <p className="text-sm font-bold truncate">{featuredItem.product.name}</p>
                  <p className="text-xs tabular-nums mt-0.5" style={{ color: theme.accentTextColor }}>
                    {formatCurrency(featuredItem.product.finalPrice, currency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddCup(featuredItem)}
                  className={`min-h-[38px] px-4 py-2 text-xs font-semibold shrink-0 cursor-pointer transition-opacity hover:opacity-90 ${theme.buttonRadiusClass}`}
                  style={{
                    backgroundColor: theme.primaryColor,
                    color: theme.onPrimaryText,
                  }}
                >
                  {store.branding.heroCtaLabel?.trim() || 'Order Now'}
                </button>
              </div>
            )}
          </div>

          <div
            className={`relative overflow-hidden flex items-center justify-center ${
              isMobile ? 'aspect-[4/3]' : 'lg:col-span-6 min-h-[280px]'
            }`}
            style={{ backgroundColor: theme.subtleBg }}
          >
            {heroImg ? (
              <img
                src={heroImg}
                alt={heroTitle}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="p-6 text-center space-y-2" style={{ color: theme.textMuted }}>
                <ImageIcon className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs font-medium">No hero banner image added</p>
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Drink Board & Customizers */}
      <section className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-8 space-y-6">
        {currentPage === 'products' && (
          <StorefrontAllProductsHeader
            storeName={store.name?.trim() || 'Drink Bar'}
            totalCount={displayItems.length}
            theme={theme}
            onBackHome={() => setCurrentPage('home')}
          />
        )}
        {displayItems.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${theme.chipRadiusClass}`}
                    style={
                      active
                        ? { backgroundColor: theme.primaryColor, color: theme.onPrimaryText }
                        : { backgroundColor: theme.subtleBg, color: theme.textMuted }
                    }
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            {(showSearchBar || currentPage === 'products') && (
              <TemplateSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search drinks..."
                theme={theme}
              />
            )}
          </div>
        )}

        {displayItems.length === 0 ? (
          <div
            className="border rounded-2xl p-10 text-center space-y-1.5"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No drinks available yet.</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Products added to this store will appear here.
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className="border rounded-2xl p-10 text-center space-y-2"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No drinks match your filter.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('All Drinks');
                setSearchQuery('');
              }}
              className="text-xs font-semibold underline cursor-pointer"
              style={{ color: theme.accentTextColor }}
            >
              Show all drinks
            </button>
          </div>
        ) : (
        <div
          className={`grid gap-6 ${
            isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {displayedItems.map((item) => {
            const { product } = item;
            const sizeChoices =
              product.variants.length > 0
                ? product.variants.map((v) => v.label)
                : ['8oz', '12oz'];
            const pref = getPref(product.id, sizeChoices[0]);

            return (
              <article
                key={product.id}
                className="border rounded-2xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                style={{
                  backgroundColor: theme.cardBg,
                  borderColor: theme.borderColor,
                }}
              >
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectProduct?.(product, `${pref.size} · ${pref.ice} · ${pref.sugar}`)
                    }
                    className="aspect-[4/3] w-full overflow-hidden border-b block cursor-pointer"
                    style={{
                      backgroundColor: theme.subtleBg,
                      borderColor: theme.borderColor,
                    }}
                  >
                    <img
                      src={product.imageUrl || fallbackImg}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <div className="p-5 space-y-4">
                    <div>
                      <div
                        className="text-[11px] font-medium flex items-center justify-between gap-1.5"
                        style={{ color: theme.textMuted }}
                      >
                        <span className="flex items-center gap-1.5">
                          <CupSoda className="w-3 h-3" />
                          <span>{product.category}</span>
                        </span>
                        {product.discountPercent > 0 && (
                          <span className="font-semibold" style={{ color: theme.accentTextColor }}>
                            Save {product.discountPercent}%
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectProduct?.(product, `${pref.size} · ${pref.ice} · ${pref.sugar}`)
                        }
                        className="text-left cursor-pointer hover:underline"
                      >
                        <h2
                          className="text-base font-bold mt-1"
                          style={{ fontFamily: theme.headingFontFamily }}
                        >
                          {product.name}
                        </h2>
                      </button>
                      <p
                        className="text-xs mt-1 leading-relaxed line-clamp-2"
                        style={{ color: theme.textMuted }}
                      >
                        {product.description}
                      </p>
                    </div>

                    {/* Size / Ice / Sugar Visual Cues */}
                    <div
                      className="space-y-2 pt-3 border-t text-[11px]"
                      style={{ borderColor: theme.borderColor }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium shrink-0" style={{ color: theme.textMuted }}>
                          Size
                        </span>
                        <div className="flex flex-wrap justify-end gap-1">
                          {sizeChoices.slice(0, 3).map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => updatePref(product.id, sizeChoices[0], { size: sz })}
                              className={`px-2 py-0.5 border font-medium cursor-pointer ${theme.chipRadiusClass}`}
                              style={
                                pref.size === sz
                                  ? {
                                      borderColor: theme.accentTextColor,
                                      backgroundColor: theme.subtleBg,
                                      color: theme.accentTextColor,
                                    }
                                  : {
                                      borderColor: theme.borderColor,
                                      color: theme.textMuted,
                                    }
                              }
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium shrink-0" style={{ color: theme.textMuted }}>
                          Ice
                        </span>
                        <div className="flex flex-wrap justify-end gap-1">
                          {ICE_LEVELS.map((ice) => (
                            <button
                              key={ice}
                              type="button"
                              onClick={() => updatePref(product.id, sizeChoices[0], { ice })}
                              className={`px-2 py-0.5 border font-medium cursor-pointer ${theme.chipRadiusClass}`}
                              style={
                                pref.ice === ice
                                  ? {
                                      borderColor: theme.accentTextColor,
                                      backgroundColor: theme.subtleBg,
                                      color: theme.accentTextColor,
                                    }
                                  : {
                                      borderColor: theme.borderColor,
                                      color: theme.textMuted,
                                    }
                              }
                            >
                              {ice}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium shrink-0" style={{ color: theme.textMuted }}>
                          Sweetness
                        </span>
                        <div className="flex flex-wrap justify-end gap-1">
                          {SUGAR_LEVELS.map((sugar) => (
                            <button
                              key={sugar}
                              type="button"
                              onClick={() => updatePref(product.id, sizeChoices[0], { sugar })}
                              className={`px-2 py-0.5 border font-medium cursor-pointer ${theme.chipRadiusClass}`}
                              style={
                                pref.sugar === sugar
                                  ? {
                                      borderColor: theme.accentTextColor,
                                      backgroundColor: theme.subtleBg,
                                      color: theme.accentTextColor,
                                    }
                                  : {
                                      borderColor: theme.borderColor,
                                      color: theme.textMuted,
                                    }
                              }
                            >
                              {sugar.replace(' Sugar', '')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="px-5 py-3.5 border-t flex items-center justify-between gap-3"
                  style={{ borderColor: theme.borderColor }}
                >
                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-base font-bold">
                      {formatCurrency(product.finalPrice, currency)}
                    </span>
                    {product.discountPercent > 0 && (
                      <span className="text-xs line-through" style={{ color: theme.textMuted }}>
                        {formatCurrency(product.basePrice, currency)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddCup(item)}
                    className={`inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90 ${theme.buttonRadiusClass}`}
                    style={{
                      backgroundColor: theme.primaryColor,
                      color: theme.onPrimaryText,
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Cup
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        )}

        {currentPage === 'home' && displayItems.length > 0 && (
          <ViewAllProductsCta
            theme={theme}
            totalCount={displayItems.length}
            onClick={() => setCurrentPage('products')}
          />
        )}

        {currentPage === 'products' && (
          <StorefrontProductPagination
            theme={theme}
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            startItem={pagination.startItem}
            endItem={pagination.endItem}
            canPrev={pagination.canPrev}
            canNext={pagination.canNext}
            onPrev={() => {
              pagination.goPrev();
              if (!isPreview) window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNext={() => {
              pagination.goNext();
              if (!isPreview) window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </section>

      <TemplateFooter store={store} theme={theme} isMobileLayout={isMobile} />
    </div>
  );
}
