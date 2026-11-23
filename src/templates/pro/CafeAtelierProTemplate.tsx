import { useMemo, useState } from 'react';
import { ArrowRight, Coffee, Eye, Plus, Sparkles } from 'lucide-react';
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

const ROAST_NOTES = [
  'Velvet Microfoam · Smooth Finish',
  'Single-Origin · Notes of Cacao',
  'Ceremonial Stone-Ground Blend',
];

export function CafeAtelierProTemplate({
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
  const theme = resolveThemeTokens(store.branding, 'cafe-atelier-pro');
  const isMobile = viewport === 'mobile';
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA['cafe-atelier-pro'].imageUrl;
  const heroImg = store.branding.heroBannerUrl?.trim();
  const heroTitle = store.branding.heroTitle?.trim() || store.name?.trim() || 'Roastery Atelier';
  const heroSubtitle = store.branding.heroSubtitle?.trim();
  const displayItems = useMemo(() => getDisplayProductsForTemplate(store, products), [store, products]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useBodyScrollLock(mobileMenuOpen && !isPreview);

  const categories = useMemo(() => {
    const productCats = Array.from(new Set(displayItems.map((item) => item.product.category)));
    return ['All Pours', ...productCats.slice(0, 4)];
  }, [displayItems]);

  const [activeCategory, setActiveCategory] = useState('All Pours');
  const [searchQuery, setSearchQuery] = useState('');
  const [bagCount, setBagCount] = useState(0);
  const [selectedCustomizations, setSelectedCustomizations] = useState<Record<string, string>>({});

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayItems.filter((item) => {
      if (activeCategory !== 'All Pours' && item.product.category !== activeCategory) {
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

  const handleOrderCup = (item: (typeof displayItems)[number]) => {
    const chosen = selectedCustomizations[item.product.id] ?? item.product.variants[0]?.label;
    setBagCount((c) => c + 1);
    onAddToCart?.(item.product, chosen);
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
              <a href="#atelier-drinks" className="hover:opacity-80 whitespace-nowrap">
                Pour Menu
              </a>
              <a href="#atelier-story" className="hover:opacity-80 whitespace-nowrap">
                Origins
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
      {/* Centered Gallery Headline + Framed Atelier Stage (Landing Page only) */}
      {currentPage === 'home' && (
        <section className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-8 sm:pt-12 space-y-7">
          <div className="max-w-3xl mx-auto text-center space-y-4 pro-hero-copy">
            <p
              className="text-xs font-semibold tracking-wide"
              style={{ color: theme.accentTextColor }}
            >
              Specialty Espresso Bar · Ceremonial Tea Room
            </p>
            <h1
              className={`font-bold tracking-tight leading-[1.08] text-balance ${
                isMobile ? 'text-2xl' : 'text-3xl sm:text-5xl'
              }`}
              style={{ fontFamily: theme.headingFontFamily }}
            >
              {heroTitle}
            </h1>
            {heroSubtitle && (
              <p className="text-sm sm:text-base leading-relaxed max-w-xl mx-auto" style={{ color: theme.textMuted }}>
                {heroSubtitle}
              </p>
            )}
            <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#atelier-drinks"
                className={`pro-btn-press inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                <span>{store.branding.heroCtaLabel?.trim() || 'Explore the Bar'}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </a>
              <button
                type="button"
                onClick={() => setCurrentPage('products')}
                className={`pro-btn-press inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-semibold border cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
                style={{
                  borderColor: theme.borderColor,
                  backgroundColor: theme.cardBg,
                  color: theme.textPrimary,
                }}
              >
                View all drinks
              </button>
            </div>
          </div>

          {/* Sculptural Gallery Frame + Provenance Pillars */}
          <div
            className={`border overflow-hidden ${theme.buttonRadiusClass}`}
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
            }}
          >
            <div className={`relative w-full overflow-hidden ${isMobile ? 'aspect-[16/10]' : 'aspect-[21/9]'}`}>
              {heroImg ? (
                <img
                  src={heroImg}
                  alt={heroTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover pro-hero-media"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center p-8"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primaryColor}, ${
                      store.branding.secondaryColor || '#57534E'
                    })`,
                  }}
                >
                  <Coffee className="w-10 h-10 text-white/80" />
                </div>
              )}
            </div>

            <div
              className={`border-t grid divide-y md:divide-y-0 md:divide-x ${
                isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'
              }`}
              style={{ borderColor: theme.borderColor }}
            >
              {[
                { title: 'First-Harvest Matcha', sub: 'Hand-whisked to order with oat or dairy' },
                { title: 'Small-Batch Filter', sub: 'Weekly roasted single-origin lots' },
                { title: 'Warm Morning Bake', sub: 'Laminated pastries out at 7:00 AM' },
              ].map((pillar) => (
                <div
                  key={pillar.title}
                  className="px-5 py-4 space-y-0.5"
                  style={{ borderColor: theme.borderColor }}
                >
                  <p className="text-xs font-bold" style={{ fontFamily: theme.headingFontFamily }}>
                    {pillar.title}
                  </p>
                  <p className="text-[11px]" style={{ color: theme.textMuted }}>
                    {pillar.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Curated Pour Menu / All Products */}
      <section
        key={currentPage}
        id="atelier-drinks"
        className="pro-page-enter max-w-6xl w-full mx-auto px-4 sm:px-8 pt-10 pb-4 space-y-6"
      >
        {currentPage === 'products' ? (
          <StorefrontAllProductsHeader
            storeName={store.name?.trim() || 'Our Roastery'}
            totalCount={displayItems.length}
            theme={theme}
            onBackHome={() => setCurrentPage('home')}
          />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold" style={{ color: theme.accentTextColor }}>
                Crafted to Order
              </p>
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                Atelier Pour Board
              </h2>
            </div>
            <p className="text-xs tabular-nums" style={{ color: theme.textMuted }}>
              Select cup size or preparation directly below
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
                placeholder="Search espresso, matcha, pastries..."
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
            <p className="text-sm font-semibold">No pours listed yet.</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Drinks and pastries added to this storefront will appear here.
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className={`border p-10 text-center space-y-2 ${theme.buttonRadiusClass}`}
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No drinks match your search.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('All Pours');
                setSearchQuery('');
              }}
              className="text-xs font-semibold underline cursor-pointer"
              style={{ color: theme.accentTextColor }}
            >
              Show all pours
            </button>
          </div>
        ) : (
          <div
            className={`pro-stagger-grid grid gap-6 ${
              isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {displayedItems.map((item, idx) => {
              const { product } = item;
              const selectedVar =
                selectedCustomizations[product.id] ?? product.variants[0]?.label ?? '';
              const tastingNote = ROAST_NOTES[idx % ROAST_NOTES.length];

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
                      className="relative aspect-[4/5] w-full overflow-hidden border-b"
                      style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectProduct?.(product, selectedVar || undefined)}
                        className="w-full h-full block cursor-pointer"
                      >
                        <img
                          src={product.imageUrl || fallbackImg}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover pro-card-img"
                        />
                      </button>

                      <div className="pro-quick-bar hidden sm:flex items-center justify-between gap-2 absolute inset-x-3 bottom-3 px-3 py-2 bg-white/90 backdrop-blur-md text-slate-900 text-[11px] font-medium rounded-lg shadow-sm">
                        <span className="truncate">{tastingNote}</span>
                        <button
                          type="button"
                          onClick={() => onSelectProduct?.(product, selectedVar || undefined)}
                          className="inline-flex items-center gap-1 font-semibold shrink-0 cursor-pointer hover:underline"
                        >
                          <Eye className="w-3 h-3" />
                          Inspect
                        </button>
                      </div>
                    </div>

                    <div className="p-5 space-y-2">
                      <div
                        className="flex items-center justify-between gap-2 text-[11px] font-medium"
                        style={{ color: theme.textMuted }}
                      >
                        <span>{product.category}</span>
                        {product.discountPercent > 0 && (
                          <span className="font-semibold" style={{ color: theme.accentTextColor }}>
                            Save {product.discountPercent}%
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProduct?.(product, selectedVar || undefined)}
                        className="text-left cursor-pointer hover:underline block"
                      >
                        <h3
                          className="text-lg font-bold leading-snug"
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
                    {product.variants.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {product.variants.slice(0, 3).map((variant) => {
                          const active = selectedVar === variant.label;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() =>
                                setSelectedCustomizations((prev) => ({
                                  ...prev,
                                  [product.id]: variant.label,
                                }))
                              }
                              className={`pro-btn-press px-2.5 py-1 text-[11px] font-medium border cursor-pointer ${theme.chipRadiusClass}`}
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
                              {variant.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

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
                        onClick={() => handleOrderCup(item)}
                        className={`pro-btn-press inline-flex items-center gap-1.5 min-h-[38px] px-4 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
                        style={{
                          backgroundColor: theme.primaryColor,
                          color: theme.onPrimaryText,
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Cup
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

      {currentPage === 'home' && store.branding.bio?.trim() && (
        <section id="atelier-story" className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6">
          <div
            className={`border p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${theme.buttonRadiusClass}`}
            style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
          >
            <div className="space-y-1.5 max-w-xl">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: theme.accentTextColor }}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Roastery Notes</span>
              </p>
              <p className="text-sm leading-relaxed" style={{ color: theme.textPrimary }}>
                {store.branding.bio.trim()}
              </p>
            </div>
            {store.branding.address?.trim() && (
              <p className="text-xs font-medium shrink-0" style={{ color: theme.textMuted }}>
                {store.branding.address.trim()}
              </p>
            )}
          </div>
        </section>
      )}
      </div>

      <TemplateFooter store={store} theme={theme} isMobileLayout={isMobile} />
    </div>
  );
}
