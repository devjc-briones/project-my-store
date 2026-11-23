import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, Plus, Shield, Truck } from 'lucide-react';
import { TEMPLATE_SHOWCASE_MEDIA } from '../../data/templateVisuals';
import { formatCurrency } from '../../utils/pricing';
import {
  StorefrontAllProductsHeader,
  StorefrontHeader,
  StorefrontProductPagination,
  TemplateAnnouncementBar,
  TemplateFooter,
  TemplateSearchInput,
  ViewAllProductsCta,
} from '../TemplateChrome';
import {
  StorefrontTemplateProps,
  getDisplayProductsForTemplate,
  resolveThemeTokens,
  useStorefrontPage,
} from '../templateTypes';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { usePagination } from '../../components/common/TablePagination';

export function FootwearStudioProTemplate({
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
  const theme = resolveThemeTokens(store.branding, 'footwear-studio-pro');
  const isMobile = viewport === 'mobile';
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA['footwear-studio-pro'].imageUrl;
  const heroImg = store.branding.heroBannerUrl?.trim();
  const heroTitle = store.branding.heroTitle?.trim() || store.name?.trim() || 'Kinetic Studio';
  const heroSubtitle = store.branding.heroSubtitle?.trim();
  const displayItems = useMemo(() => getDisplayProductsForTemplate(store, products), [store, products]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useBodyScrollLock(mobileMenuOpen && !isPreview);

  const categories = useMemo(() => {
    const productCats = Array.from(new Set(displayItems.map((item) => item.product.category)));
    return ['All Pairs', ...productCats.slice(0, 4)];
  }, [displayItems]);

  const [activeCategory, setActiveCategory] = useState('All Pairs');
  const [searchQuery, setSearchQuery] = useState('');
  const [bagCount, setBagCount] = useState(0);
  const [selectedSizeById, setSelectedSizeById] = useState<Record<string, string>>({});

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayItems.filter((item) => {
      if (activeCategory !== 'All Pairs' && item.product.category !== activeCategory) {
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

  const handleAddPair = (item: (typeof displayItems)[number]) => {
    const chosenSize =
      selectedSizeById[item.product.id] ?? item.product.variants[0]?.label ?? 'US 9';
    setBagCount((c) => c + 1);
    onAddToCart?.(item.product, chosenSize);
  };

  return (
    <div
      className="flex-1 min-h-full flex flex-col relative isolate"
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
        cartLabel="Vault Bag"
        currentBuyer={currentBuyer}
        activePage={currentPage}
        onNavigatePage={setCurrentPage}
        desktopNav={
          !isMobile && currentPage === 'home' ? (
            <nav
              className="hidden md:flex items-center gap-6 text-xs font-medium mr-1"
              style={{ color: theme.textMuted }}
            >
              <a href="#kinetic-drops" className="hover:opacity-80 whitespace-nowrap">
                Vault Drops
              </a>
              <a href="#kinetic-assurance" className="hover:opacity-80 whitespace-nowrap">
                Verification
              </a>
            </nav>
          ) : undefined
        }
        onToggle={() => setMobileMenuOpen((prev) => !prev)}
        onClose={() => setMobileMenuOpen(false)}
        onOpenBuyerAuth={onOpenBuyerAuth}
        onOpenBuyerAccount={onOpenBuyerAccount}
        onOpenTrackOrder={onOpenTrackOrder}
        onOpenCart={onOpenCart}
      />

      <TemplateAnnouncementBar store={store} theme={theme} />

      <div className="flex-1">
      {/* Kinetic Athletic Split Stage + Telemetry Strip (Landing Page only) */}
      {currentPage === 'home' && (
        <section className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6 sm:pt-8 space-y-4">
          <div
            className={`border overflow-hidden grid items-stretch ${theme.buttonRadiusClass} ${
              isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
            }`}
            style={{
              backgroundColor: store.branding.secondaryColor || '#18181B',
              borderColor: theme.borderColor,
            }}
          >
            <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between gap-6 text-white pro-hero-copy">
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-wide text-amber-300">
                  Studio Footwear Vault · Season 2026
                </p>
                <h1
                  className={`font-bold uppercase tracking-tight leading-[1.03] text-balance ${
                    isMobile ? 'text-2xl' : 'text-3xl sm:text-5xl'
                  }`}
                  style={{ fontFamily: theme.headingFontFamily }}
                >
                  {heroTitle}
                </h1>
                {heroSubtitle && (
                  <p className="text-xs sm:text-sm text-white/80 leading-relaxed max-w-md">
                    {heroSubtitle}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="#kinetic-drops"
                  className={`pro-btn-press inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap ${theme.buttonRadiusClass}`}
                  style={{
                    backgroundColor: theme.primaryColor,
                    color: theme.onPrimaryText,
                  }}
                >
                  <span>{store.branding.heroCtaLabel?.trim() || 'Enter the Vault'}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </a>
                <button
                  type="button"
                  onClick={() => setCurrentPage('products')}
                  className={`pro-btn-press inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-xs font-semibold border border-white/25 bg-white/10 hover:bg-white/15 text-white cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
                >
                  Browse All {displayItems.length}
                </button>
              </div>
            </div>

            <div className={`lg:col-span-6 relative overflow-hidden ${isMobile ? 'aspect-[16/10]' : 'min-h-[320px] lg:min-h-[400px]'}`}>
              {heroImg && (
                <img
                  src={heroImg}
                  alt={heroTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover pro-hero-media"
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/30" />
            </div>
          </div>

          <div
            id="kinetic-assurance"
            className={`border grid divide-y sm:divide-y-0 sm:divide-x ${theme.buttonRadiusClass} ${
              isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'
            }`}
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderColor: theme.borderColor }}>
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: theme.accentTextColor }} />
              <div className="text-xs">
                <p className="font-bold">Multi-Point Authenticated</p>
                <p style={{ color: theme.textMuted }}>Box, stitching &amp; outsole verified</p>
              </div>
            </div>
            <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderColor: theme.borderColor }}>
              <Truck className="w-4 h-4 shrink-0" style={{ color: theme.accentTextColor }} />
              <div className="text-xs">
                <p className="font-bold">Double-Boxed Dispatch</p>
                <p style={{ color: theme.textMuted }}>Same-day courier cutoff at 3:00 PM</p>
              </div>
            </div>
            <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderColor: theme.borderColor }}>
              <Shield className="w-4 h-4 shrink-0" style={{ color: theme.accentTextColor }} />
              <div className="text-xs">
                <p className="font-bold">7-Day Size Swap</p>
                <p style={{ color: theme.textMuted }}>Unworn indoor fit guarantee</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footwear Drop Grid / All Products */}
      <section
        key={currentPage}
        id="kinetic-drops"
        className="pro-page-enter max-w-6xl w-full mx-auto px-4 sm:px-8 pt-8 pb-4 space-y-6"
      >
        {currentPage === 'products' ? (
          <StorefrontAllProductsHeader
            storeName={store.name?.trim() || 'Footwear Studio'}
            totalCount={displayItems.length}
            theme={theme}
            onBackHome={() => setCurrentPage('home')}
          />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold" style={{ color: theme.accentTextColor }}>
                Featured Rotation
              </p>
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight uppercase"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                Curated Studio Pairs
              </h2>
            </div>
            <p className="text-xs tabular-nums" style={{ color: theme.textMuted }}>
              Tap your US size before adding to bag
            </p>
          </div>
        )}

        {displayItems.length > 0 && (
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b"
            style={{ borderColor: theme.borderColor }}
          >
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {categories.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`pro-btn-press px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border ${theme.chipRadiusClass}`}
                    style={
                      active
                        ? {
                            backgroundColor: theme.primaryColor,
                            color: theme.onPrimaryText,
                            borderColor: theme.primaryColor,
                          }
                        : {
                            backgroundColor: theme.subtleBg,
                            color: theme.textMuted,
                            borderColor: theme.borderColor,
                          }
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
                placeholder="Search silhouettes, sizes..."
                theme={theme}
              />
            )}
          </div>
        )}

        {displayItems.length === 0 ? (
          <div
            className={`border p-10 text-center space-y-1.5 ${theme.buttonRadiusClass}`}
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No footwear pairs listed yet.</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Pairs added to this storefront will appear in your drop vault.
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className={`border p-10 text-center space-y-2 ${theme.buttonRadiusClass}`}
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No pairs match your search.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('All Pairs');
                setSearchQuery('');
              }}
              className="text-xs font-semibold underline cursor-pointer"
              style={{ color: theme.accentTextColor }}
            >
              Show all pairs
            </button>
          </div>
        ) : (
          <div
            className={`pro-stagger-grid grid gap-6 ${
              isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {displayedItems.map((item) => {
              const { product } = item;
              const sizeChoices =
                product.variants.length > 0
                  ? product.variants.map((v) => v.label).slice(0, 4)
                  : ['US 8', 'US 9', 'US 10', 'US 11'];
              const chosenSize = selectedSizeById[product.id] ?? sizeChoices[0];

              return (
                <article
                  key={product.id}
                  className={`pro-card-elevate border overflow-hidden flex flex-col justify-between ${theme.buttonRadiusClass}`}
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.borderColor,
                  }}
                >
                  <div>
                    <div
                      className="relative aspect-[4/3] w-full overflow-hidden border-b"
                      style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectProduct?.(product, chosenSize)}
                        className="w-full h-full block cursor-pointer"
                      >
                        <img
                          src={product.imageUrl || fallbackImg}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover pro-card-img"
                        />
                      </button>

                      <div className="pro-quick-bar hidden sm:flex items-center justify-between gap-2 absolute inset-x-3 bottom-3 px-3 py-2 bg-slate-950/85 backdrop-blur-md text-white text-[11px] font-semibold rounded-lg">
                        <span className="tabular-nums">SKU {product.sku}</span>
                        <button
                          type="button"
                          onClick={() => onSelectProduct?.(product, chosenSize)}
                          className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          Inspect Pair
                        </button>
                      </div>
                    </div>

                    <div className="p-5 space-y-1.5">
                      <div
                        className="flex items-center justify-between gap-2 text-[11px] font-medium"
                        style={{ color: theme.textMuted }}
                      >
                        <span>{product.category}</span>
                        {product.discountPercent > 0 && (
                          <span className="font-bold" style={{ color: theme.accentTextColor }}>
                            {product.discountPercent}% Off
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProduct?.(product, chosenSize)}
                        className="text-left cursor-pointer hover:underline block"
                      >
                        <h3
                          className="text-lg font-bold uppercase tracking-tight leading-snug"
                          style={{ fontFamily: theme.headingFontFamily }}
                        >
                          {product.name}
                        </h3>
                      </button>

                      <p
                        className="text-xs leading-relaxed line-clamp-2"
                        style={{ color: theme.textMuted }}
                      >
                        {product.description}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 space-y-3">
                    <div className="grid grid-cols-4 gap-1.5">
                      {sizeChoices.map((size) => {
                        const active = chosenSize === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() =>
                              setSelectedSizeById((prev) => ({
                                ...prev,
                                [product.id]: size,
                              }))
                            }
                            className={`pro-btn-press min-h-[34px] text-[11px] font-semibold border tabular-nums cursor-pointer ${theme.chipRadiusClass}`}
                            style={
                              active
                                ? {
                                    borderColor: theme.primaryColor,
                                    backgroundColor: theme.primaryColor,
                                    color: theme.onPrimaryText,
                                  }
                                : {
                                    borderColor: theme.borderColor,
                                    color: theme.textMuted,
                                    backgroundColor: theme.subtleBg,
                                  }
                            }
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className="pt-3 border-t flex items-center justify-between gap-3"
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
                        onClick={() => handleAddPair(item)}
                        className={`pro-btn-press inline-flex items-center gap-1.5 min-h-[38px] px-4 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
                        style={{
                          backgroundColor: theme.primaryColor,
                          color: theme.onPrimaryText,
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Pair
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
      </div>

      <TemplateFooter store={store} theme={theme} isMobileLayout={isMobile} />
    </div>
  );
}
