import { useMemo, useState } from 'react';
import { ArrowRight, Eye, Layers, ShoppingBag } from 'lucide-react';
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

export function ClothingEditorialProTemplate({
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
  const theme = resolveThemeTokens(store.branding, 'clothing-editorial-pro');
  const isMobile = viewport === 'mobile';
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA['clothing-editorial-pro'].imageUrl;
  const heroImg = store.branding.heroBannerUrl?.trim();
  const heroTitle = store.branding.heroTitle?.trim() || store.name?.trim() || 'Maison Editorial';
  const heroSubtitle = store.branding.heroSubtitle?.trim();
  const displayItems = useMemo(() => getDisplayProductsForTemplate(store, products), [store, products]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useBodyScrollLock(mobileMenuOpen && !isPreview);

  const categories = useMemo(() => {
    const productCats = Array.from(new Set(displayItems.map((item) => item.product.category)));
    return ['All Capsules', ...productCats.slice(0, 4)];
  }, [displayItems]);

  const [activeCategory, setActiveCategory] = useState('All Capsules');
  const [searchQuery, setSearchQuery] = useState('');
  const [bagCount, setBagCount] = useState(0);
  const [selectedSizeById, setSelectedSizeById] = useState<Record<string, string>>({});

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayItems.filter((item) => {
      if (activeCategory !== 'All Capsules' && item.product.category !== activeCategory) {
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

  const handleAddPiece = (item: (typeof displayItems)[number]) => {
    const chosenSize =
      selectedSizeById[item.product.id] ?? item.product.variants[0]?.label ?? 'M';
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
        cartLabel="Atelier Bag"
        currentBuyer={currentBuyer}
        activePage={currentPage}
        onNavigatePage={setCurrentPage}
        desktopNav={
          !isMobile && currentPage === 'home' ? (
            <nav
              className="hidden md:flex items-center gap-6 text-xs font-medium mr-1"
              style={{ color: theme.textMuted }}
            >
              <a href="#editorial-lookbook" className="hover:opacity-80 whitespace-nowrap">
                Lookbook
              </a>
              <a href="#atelier-craft" className="hover:opacity-80 whitespace-nowrap">
                Tailoring
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
      {/* Runway Campaign Spread (Landing Page only) */}
      {currentPage === 'home' && (
        <section className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6 sm:pt-10">
          <div
            className={`grid gap-6 items-stretch ${
              isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
            }`}
          >
            <div
              className={`lg:col-span-6 border p-6 sm:p-10 flex flex-col justify-between gap-8 pro-hero-copy ${theme.buttonRadiusClass}`}
              style={{
                backgroundColor: theme.subtleBg,
                borderColor: theme.borderColor,
              }}
            >
              <div className="space-y-4">
                <p
                  className="text-xs font-semibold tracking-wide"
                  style={{ color: theme.accentTextColor }}
                >
                  Collection 06 · Ready-to-Wear
                </p>
                <h1
                  className={`font-bold tracking-tight leading-[1.06] text-balance ${
                    isMobile ? 'text-3xl' : 'text-4xl sm:text-[2.75rem]'
                  }`}
                  style={{ fontFamily: theme.headingFontFamily }}
                >
                  {heroTitle}
                </h1>
                {heroSubtitle && (
                  <p className="text-sm leading-relaxed max-w-md" style={{ color: theme.textMuted }}>
                    {heroSubtitle}
                  </p>
                )}
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="#editorial-lookbook"
                    className={`pro-btn-press inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap ${theme.buttonRadiusClass}`}
                    style={{
                      backgroundColor: theme.primaryColor,
                      color: theme.onPrimaryText,
                    }}
                  >
                    <span>{store.branding.heroCtaLabel?.trim() || 'Shop Capsule'}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setCurrentPage('products')}
                    className={`pro-btn-press inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-xs font-semibold border cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
                    style={{
                      borderColor: theme.borderColor,
                      backgroundColor: theme.cardBg,
                      color: theme.textPrimary,
                    }}
                  >
                    All {displayItems.length} Pieces
                  </button>
                </div>

                <div
                  className="pt-4 border-t flex items-center justify-between text-xs"
                  style={{ borderColor: theme.borderColor, color: theme.textMuted }}
                >
                  <span>Natural European Flax &amp; Merino</span>
                  <span className="tabular-nums">Complimentary Garment Care</span>
                </div>
              </div>
            </div>

            <div
              className={`lg:col-span-6 border overflow-hidden relative ${theme.buttonRadiusClass} ${
                isMobile ? 'aspect-[4/3]' : 'min-h-[360px] lg:min-h-[460px]'
              }`}
              style={{ borderColor: theme.borderColor, backgroundColor: theme.subtleBg }}
            >
              {heroImg ? (
                <img
                  src={heroImg}
                  alt={heroTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover pro-hero-media"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-8">
                  <Layers className="w-10 h-10 opacity-40" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Lookbook Grid / All Products */}
      <section
        key={currentPage}
        id="editorial-lookbook"
        className="pro-page-enter max-w-6xl w-full mx-auto px-4 sm:px-8 pt-10 pb-4 space-y-6"
      >
        {currentPage === 'products' ? (
          <StorefrontAllProductsHeader
            storeName={store.name?.trim() || 'Atelier'}
            totalCount={displayItems.length}
            theme={theme}
            onBackHome={() => setCurrentPage('home')}
          />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold" style={{ color: theme.accentTextColor }}>
                Featured Runway Edit
              </p>
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                Curated Garments
              </h2>
            </div>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Hover or select size to add directly to bag
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
                            backgroundColor: theme.cardBg,
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
                placeholder="Search garments, fabrics..."
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
            <p className="text-sm font-semibold">No pieces published yet.</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Garments added to this storefront will appear in your lookbook.
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className={`border p-10 text-center space-y-2 ${theme.buttonRadiusClass}`}
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No garments match your filter.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('All Capsules');
                setSearchQuery('');
              }}
              className="text-xs font-semibold underline cursor-pointer"
              style={{ color: theme.accentTextColor }}
            >
              Reset capsule filter
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
                  : ['XS', 'S', 'M', 'L'];
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
                      className="relative aspect-[3/4] w-full overflow-hidden border-b"
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

                      {/* Smooth hover quick-inspect overlay bar */}
                      <div className="pro-quick-bar hidden sm:flex items-center justify-between gap-2 absolute inset-x-3 bottom-3 px-3 py-2 bg-white/95 backdrop-blur-md text-slate-900 text-[11px] font-semibold border border-slate-200/80 shadow-sm">
                        <span>Quick Look · {chosenSize}</span>
                        <button
                          type="button"
                          onClick={() => onSelectProduct?.(product, chosenSize)}
                          className="inline-flex items-center gap-1 underline-offset-2 hover:underline cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          View Piece
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
                          <span className="font-semibold" style={{ color: theme.accentTextColor }}>
                            -{product.discountPercent}% Archive
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProduct?.(product, chosenSize)}
                        className="text-left cursor-pointer hover:underline block"
                      >
                        <h3
                          className="text-base sm:text-lg font-bold leading-snug"
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
                            className={`pro-btn-press min-h-[34px] text-[11px] font-semibold border cursor-pointer ${theme.chipRadiusClass}`}
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
                        onClick={() => handleAddPiece(item)}
                        className={`pro-btn-press inline-flex items-center gap-1.5 min-h-[38px] px-4 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
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

      {/* Atelier Tailoring Pillars (Landing Page only) */}
      {currentPage === 'home' && (
        <section id="atelier-craft" className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6">
          <div
            className={`border grid divide-y md:divide-y-0 md:divide-x ${theme.buttonRadiusClass} ${
              isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'
            }`}
            style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
          >
            {[
              { title: 'Numbered Runs', desc: 'Produced in limited seasonal batches to eliminate overstock.' },
              { title: '14-Day Fit Exchange', desc: 'Complimentary size exchange and insured local courier.' },
              { title: 'Organic Fibers', desc: 'Breathable Belgian flax, organic cotton twill, and merino.' },
            ].map((item) => (
              <div
                key={item.title}
                className="p-6 space-y-1"
                style={{ borderColor: theme.borderColor }}
              >
                <p className="text-sm font-bold" style={{ fontFamily: theme.headingFontFamily }}>
                  {item.title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>

      <TemplateFooter store={store} theme={theme} isMobileLayout={isMobile} />
    </div>
  );
}
