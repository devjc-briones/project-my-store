import { useMemo, useState } from 'react';
import { ArrowRight, Image as ImageIcon, Instagram, ShoppingBag } from 'lucide-react';
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

export function ClothingTemplate({
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
  const theme = resolveThemeTokens(store.branding, 'clothing-apparel');
  const isMobile = viewport === 'mobile';
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA['clothing-apparel'].imageUrl;
  const heroImg = store.branding.heroBannerUrl?.trim();
  const heroTitle = store.branding.heroTitle?.trim() || store.name?.trim() || 'Your Store Name';
  const heroSubtitle = store.branding.heroSubtitle?.trim();
  const sellerInstagram = store.branding.socialLinks.instagram?.trim();
  const displayItems = useMemo(() => getDisplayProductsForTemplate(store, products), [store, products]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useBodyScrollLock(mobileMenuOpen && !isPreview);

  const categories = useMemo(() => {
    const productCats = Array.from(new Set(displayItems.map((item) => item.product.category)));
    return ['All Pieces', ...productCats.slice(0, 4)];
  }, [displayItems]);

  const [activeCategory, setActiveCategory] = useState('All Pieces');
  const [searchQuery, setSearchQuery] = useState('');
  const [bagCount, setBagCount] = useState(0);
  const [selectedSizeById, setSelectedSizeById] = useState<Record<string, string>>({});

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayItems.filter((item) => {
      if (activeCategory !== 'All Pieces' && item.product.category !== activeCategory) {
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

  const handleAddGarment = (item: (typeof displayItems)[number]) => {
    const chosenSize =
      selectedSizeById[item.product.id] ?? item.product.variants[0]?.label ?? 'M';
    setBagCount((c) => c + 1);
    onAddToCart?.(item.product, chosenSize);
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
        cartLabel="Garment Bag"
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

      {/* Asymmetric Lookbook Hero (Landing Page only) */}
      {currentPage === 'home' && (
      <section className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6 sm:pt-8">
        <div
          className={`grid gap-6 items-stretch ${
            isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
          }`}
        >
          <div
            className={`border rounded-2xl p-6 sm:p-10 flex flex-col justify-between gap-6 ${
              isMobile ? '' : 'lg:col-span-5'
            }`}
            style={{
              backgroundColor: theme.subtleBg,
              borderColor: theme.borderColor,
            }}
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
                className={`font-bold leading-[1.12] text-balance ${
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

            <div className="flex items-center gap-3">
              <a
                href="#clothing-lookbook"
                className={`inline-flex items-center gap-2 min-h-[42px] px-5 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90 ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                <span>{store.branding.heroCtaLabel?.trim() || 'Shop Now'}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div
            className={`relative rounded-2xl overflow-hidden border flex items-center justify-center ${
              isMobile ? 'aspect-[4/3]' : 'lg:col-span-7 min-h-[300px]'
            }`}
            style={{
              backgroundColor: theme.subtleBg,
              borderColor: theme.borderColor,
            }}
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

      {/* Collection Banner & Filter Strip */}
      <section id="clothing-lookbook" className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-8 space-y-6">
        {currentPage === 'products' ? (
          <StorefrontAllProductsHeader
            storeName={store.name?.trim() || 'Apparel Studio'}
            totalCount={displayItems.length}
            theme={theme}
            onBackHome={() => setCurrentPage('home')}
          />
        ) : (
          <div
            className="border-y py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ borderColor: theme.borderColor }}
          >
            <div>
              <h2
                className="text-lg font-bold"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                Featured Lookbook Pieces
              </h2>
              <p className="text-xs" style={{ color: theme.textMuted }}>
                Tailored silhouettes cut in breathable seasonal fabrics
              </p>
            </div>
            {displayItems.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {categories.map((cat) => {
                    const active = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${theme.chipRadiusClass}`}
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
                {showSearchBar && (
                  <TemplateSearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search pieces..."
                    theme={theme}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {currentPage === 'products' && displayItems.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${theme.chipRadiusClass}`}
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
            <TemplateSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search pieces..."
              theme={theme}
            />
          </div>
        )}

        {/* Tall 3:4 Portrait Lookbook Grid */}
        {displayItems.length === 0 ? (
          <div
            className="border rounded-2xl p-10 text-center space-y-1.5"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No pieces available yet.</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Products added to this store will appear here.
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className="border rounded-2xl p-10 text-center space-y-2"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No garments match your filter.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('All Pieces');
                setSearchQuery('');
              }}
              className="text-xs font-semibold underline cursor-pointer"
              style={{ color: theme.accentTextColor }}
            >
              Show all pieces
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
            const sizes =
              product.variants.length > 0
                ? product.variants.map((v) => v.label)
                : ['S', 'M', 'L', 'XL'];
            const activeSize = selectedSizeById[product.id] ?? sizes[0];

            return (
              <article
                key={product.id}
                className="group flex flex-col justify-between space-y-3"
              >
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => onSelectProduct?.(product, activeSize)}
                    className="relative aspect-[3/4] w-full rounded-xl overflow-hidden border block cursor-pointer"
                    style={{
                      backgroundColor: theme.subtleBg,
                      borderColor: theme.borderColor,
                    }}
                  >
                    <img
                      src={product.imageUrl || fallbackImg}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium" style={{ color: theme.textMuted }}>
                        {product.category}
                      </span>
                      {product.discountPercent > 0 && (
                        <span
                          className="text-[11px] font-semibold tabular-nums"
                          style={{ color: theme.accentTextColor }}
                        >
                          Save {product.discountPercent}%
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectProduct?.(product, activeSize)}
                      className="text-left cursor-pointer hover:underline"
                    >
                      <h3
                        className="text-base font-bold leading-snug"
                        style={{ fontFamily: theme.headingFontFamily }}
                      >
                        {product.name}
                      </h3>
                    </button>
                    <p
                      className="text-xs line-clamp-2 leading-relaxed"
                      style={{ color: theme.textMuted }}
                    >
                      {product.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {sizes.slice(0, 4).map((sz) => {
                      const active = activeSize === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() =>
                            setSelectedSizeById((prev) => ({
                              ...prev,
                              [product.id]: sz,
                            }))
                          }
                          className={`min-w-[36px] px-2.5 py-1 text-[11px] font-semibold border cursor-pointer transition-colors ${theme.chipRadiusClass}`}
                          style={
                            active
                              ? {
                                  borderColor: theme.primaryColor,
                                  backgroundColor: theme.primaryColor,
                                  color: theme.onPrimaryText,
                                }
                              : {
                                  borderColor: theme.borderColor,
                                  color: theme.textPrimary,
                                }
                          }
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
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
                      onClick={() => handleAddGarment(item)}
                      className={`inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90 ${theme.buttonRadiusClass}`}
                      style={{
                        backgroundColor: theme.primaryColor,
                        color: theme.onPrimaryText,
                      }}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Add to Bag
                    </button>
                  </div>
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
