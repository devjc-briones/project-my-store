import { useMemo, useState } from 'react';
import { ArrowRight, Clock, Eye, Flame, MapPin, Plus, UtensilsCrossed } from 'lucide-react';
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

const TASTING_NOTES = [
  'Wood-Fired Finish · Herb Jus',
  'Slow-Braised · Cultured Butter',
  'Hand-Rolled · Seasonal Harvest',
];

export function FoodBistroProTemplate({
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
  const theme = resolveThemeTokens(store.branding, 'food-bistro-pro');
  const isMobile = viewport === 'mobile';
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA['food-bistro-pro'].imageUrl;
  const heroImg = store.branding.heroBannerUrl?.trim();
  const heroTitle = store.branding.heroTitle?.trim() || store.name?.trim() || 'Maison Bistro';
  const heroSubtitle = store.branding.heroSubtitle?.trim();
  const displayItems = useMemo(() => getDisplayProductsForTemplate(store, products), [store, products]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useBodyScrollLock(mobileMenuOpen && !isPreview);

  const categories = useMemo(() => {
    const productCats = Array.from(new Set(displayItems.map((item) => item.product.category)));
    return ['All Courses', ...productCats.slice(0, 4)];
  }, [displayItems]);

  const [activeCategory, setActiveCategory] = useState('All Courses');
  const [searchQuery, setSearchQuery] = useState('');
  const [bagCount, setBagCount] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayItems.filter((item) => {
      if (activeCategory !== 'All Courses' && item.product.category !== activeCategory) {
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

  const handleOrderDish = (item: (typeof displayItems)[number]) => {
    const chosen = selectedOptions[item.product.id] ?? item.product.variants[0]?.label;
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
        cartLabel="Table Order"
        currentBuyer={currentBuyer}
        activePage={currentPage}
        onNavigatePage={setCurrentPage}
        desktopNav={
          !isMobile && currentPage === 'home' ? (
            <nav
              className="hidden md:flex items-center gap-6 text-xs font-medium mr-1"
              style={{ color: theme.textMuted }}
            >
              <a href="#bistro-tasting" className="hover:opacity-80 whitespace-nowrap">
                Tasting Menu
              </a>
              <a href="#bistro-provenance" className="hover:opacity-80 whitespace-nowrap">
                Chef&apos;s Note
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
      {/* Architectural Bistro Split Hero (Landing Page only) */}
      {currentPage === 'home' && (
        <section className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6 sm:pt-10">
          <div
            className={`border overflow-hidden grid items-stretch ${theme.buttonRadiusClass} ${
              isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
            }`}
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
            }}
          >
            <div className="lg:col-span-5 p-6 sm:p-10 flex flex-col justify-between gap-8 pro-hero-copy">
              <div className="space-y-4">
                <div
                  className="flex items-center gap-2 text-xs font-medium"
                  style={{ color: theme.accentTextColor }}
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" />
                  <span>Seasonal Tasting Kitchen</span>
                  <span aria-hidden="true">·</span>
                  <span>Made to Order</span>
                </div>

                <h1
                  className={`font-bold leading-[1.08] tracking-tight text-balance ${
                    isMobile ? 'text-2xl' : 'text-3xl sm:text-[2.5rem]'
                  }`}
                  style={{ fontFamily: theme.headingFontFamily }}
                >
                  {heroTitle}
                </h1>

                {heroSubtitle && (
                  <p className="text-sm leading-relaxed" style={{ color: theme.textMuted }}>
                    {heroSubtitle}
                  </p>
                )}
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="#bistro-tasting"
                    className={`pro-btn-press inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap ${theme.buttonRadiusClass}`}
                    style={{
                      backgroundColor: theme.primaryColor,
                      color: theme.onPrimaryText,
                    }}
                  >
                    <span>{store.branding.heroCtaLabel?.trim() || 'View Tasting Menu'}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setCurrentPage('products')}
                    className={`pro-btn-press inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-xs font-semibold border cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
                    style={{
                      borderColor: theme.borderColor,
                      color: theme.textPrimary,
                      backgroundColor: theme.subtleBg,
                    }}
                  >
                    Full Menu
                  </button>
                </div>

                <div
                  className="pt-4 border-t grid grid-cols-2 gap-4 text-xs tabular-nums"
                  style={{ borderColor: theme.borderColor, color: theme.textMuted }}
                >
                  <div>
                    <p className="font-semibold" style={{ color: theme.textPrimary }}>
                      18–25 min
                    </p>
                    <p>Hearth Fire Prep</p>
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: theme.textPrimary }}>
                      {displayItems.length} {displayItems.length === 1 ? 'Course' : 'Courses'}
                    </p>
                    <p>Fresh Daily Selection</p>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`lg:col-span-7 relative overflow-hidden ${
                isMobile ? 'aspect-[16/10]' : 'min-h-[340px] lg:min-h-[450px]'
              }`}
              style={{ backgroundColor: theme.subtleBg }}
            >
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
                      store.branding.secondaryColor || '#1C1917'
                    })`,
                  }}
                >
                  <p
                    className="text-xl font-bold text-white text-center"
                    style={{ fontFamily: theme.headingFontFamily }}
                  >
                    {store.name?.trim() || heroTitle}
                  </p>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              {store.branding.address?.trim() && (
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white/95">
                  <span className="inline-flex items-center gap-1.5 font-medium truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{store.branding.address.trim()}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Course Menu & All Products Catalog */}
      <section
        key={currentPage}
        id="bistro-tasting"
        className="pro-page-enter max-w-6xl w-full mx-auto px-4 sm:px-8 pt-8 sm:pt-10 pb-4 space-y-6"
      >
        {currentPage === 'products' ? (
          <StorefrontAllProductsHeader
            storeName={store.name?.trim() || 'Our Kitchen'}
            totalCount={displayItems.length}
            theme={theme}
            onBackHome={() => setCurrentPage('home')}
          />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold tracking-wide" style={{ color: theme.accentTextColor }}>
                Chef&apos;s Selection
              </p>
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                Signature Courses
              </h2>
            </div>
            <p className="text-xs tabular-nums" style={{ color: theme.textMuted }}>
              Plated fresh to order · Direct kitchen dispatch
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
                placeholder="Search tasting courses..."
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
            <p className="text-sm font-semibold">No dishes published yet.</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Menu items added to this kitchen will appear here automatically.
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className={`border p-10 text-center space-y-2 ${theme.buttonRadiusClass}`}
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No courses match your search or filter.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('All Courses');
                setSearchQuery('');
              }}
              className="text-xs font-semibold underline cursor-pointer"
              style={{ color: theme.accentTextColor }}
            >
              Reset course filters
            </button>
          </div>
        ) : (
          <div
            className={`pro-stagger-grid grid gap-6 ${
              isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {displayedItems.map((item, idx) => {
              const { product } = item;
              const prepMins = 16 + (idx % 3) * 4;
              const note = TASTING_NOTES[idx % TASTING_NOTES.length];
              const selectedVar =
                selectedOptions[product.id] ?? product.variants[0]?.label ?? '';

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
                        onClick={() => onSelectProduct?.(product, selectedVar || undefined)}
                        className="w-full h-full block cursor-pointer text-left"
                      >
                        <img
                          src={product.imageUrl || fallbackImg}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover pro-card-img"
                        />
                      </button>

                      {/* Smooth hover/focus quick inspect bar */}
                      <div className="pro-quick-bar hidden sm:flex items-center justify-between gap-2 absolute inset-x-3 bottom-3 px-3 py-2 bg-black/75 backdrop-blur-md text-white text-[11px] font-medium rounded-lg">
                        <span className="truncate">{note}</span>
                        <button
                          type="button"
                          onClick={() => onSelectProduct?.(product, selectedVar || undefined)}
                          className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline shrink-0 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          Details
                        </button>
                      </div>
                    </div>

                    <div className="p-5 space-y-2.5">
                      <div
                        className="flex items-center justify-between gap-2 text-[11px] font-medium"
                        style={{ color: theme.textMuted }}
                      >
                        <span className="truncate">{product.category}</span>
                        <span className="inline-flex items-center gap-1 tabular-nums shrink-0">
                          <Clock className="w-3 h-3" />
                          {prepMins} min
                        </span>
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

                      {product.discountPercent > 0 && (
                        <p
                          className="inline-flex items-center gap-1 text-[11px] font-semibold"
                          style={{ color: theme.accentTextColor }}
                        >
                          <Flame className="w-3 h-3" />
                          <span>Chef Special · {product.discountPercent}% Off</span>
                        </p>
                      )}
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
                                setSelectedOptions((prev) => ({
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
                        onClick={() => handleOrderDish(item)}
                        className={`pro-btn-press inline-flex items-center gap-1.5 min-h-[38px] px-4 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
                        style={{
                          backgroundColor: theme.primaryColor,
                          color: theme.onPrimaryText,
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Dish
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

      {/* Editorial Provenance & Dining Philosophy */}
      {currentPage === 'home' && (store.branding.bio?.trim() || store.branding.address?.trim()) && (
        <section id="bistro-provenance" className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6">
          <div
            className={`border p-6 sm:p-10 grid gap-6 items-center ${theme.buttonRadiusClass} ${
              isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-12'
            }`}
            style={{
              backgroundColor: theme.subtleBg,
              borderColor: theme.borderColor,
            }}
          >
            <div className="md:col-span-8 space-y-2">
              <p className="text-xs font-semibold" style={{ color: theme.accentTextColor }}>
                Kitchen Philosophy
              </p>
              <h3
                className="text-xl sm:text-2xl font-bold"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                {store.name?.trim() || 'Our Kitchen'}
              </h3>
              {store.branding.bio?.trim() && (
                <p className="text-sm leading-relaxed max-w-2xl" style={{ color: theme.textMuted }}>
                  {store.branding.bio.trim()}
                </p>
              )}
            </div>
            <div
              className="md:col-span-4 md:border-l md:pl-6 space-y-1.5 text-xs"
              style={{ borderColor: theme.borderColor, color: theme.textMuted }}
            >
              {store.branding.address?.trim() && (
                <p className="font-medium" style={{ color: theme.textPrimary }}>
                  {store.branding.address.trim()}
                </p>
              )}
              {store.branding.contactNumber?.trim() && (
                <p className="tabular-nums">{store.branding.contactNumber.trim()}</p>
              )}
            </div>
          </div>
        </section>
      )}
      </div>

      <TemplateFooter store={store} theme={theme} isMobileLayout={isMobile} />
    </div>
  );
}
