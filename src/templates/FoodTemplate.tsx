import { useMemo, useState } from 'react';
import { Clock, Flame, Instagram, Plus } from 'lucide-react';
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

export function FoodTemplate({
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
  const theme = resolveThemeTokens(store.branding, 'food-restaurant');
  const isMobile = viewport === 'mobile';
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA['food-restaurant'].imageUrl;
  const heroImg = store.branding.heroBannerUrl?.trim();
  const heroTitle = store.branding.heroTitle?.trim() || store.name?.trim() || 'Your Store Name';
  const heroSubtitle = store.branding.heroSubtitle?.trim();
  const sellerInstagram = store.branding.socialLinks.instagram?.trim();
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

  const handleOrderClick = (item: (typeof displayItems)[number]) => {
    const chosen = selectedOptions[item.product.id] ?? item.product.variants[0]?.label;
    setBagCount((c) => c + 1);
    onAddToCart?.(item.product, chosen);
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
        cartLabel="Order Bag"
        currentBuyer={currentBuyer}
        activePage={currentPage}
        onNavigatePage={setCurrentPage}
        desktopNav={
          !isMobile && currentPage === 'home' ? (
            <nav
              className="hidden md:flex items-center gap-6 text-xs font-medium mr-1"
              style={{ color: theme.textMuted }}
            >
              <a href="#food-menu" className="hover:opacity-80 whitespace-nowrap">
                Menu
              </a>
              <a href="#kitchen-story" className="hover:opacity-80 whitespace-nowrap">
                Our Kitchen
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

      {/* Full-Bleed Kitchen Hero (Landing Page only) */}
      {currentPage === 'home' && (
      <section className="relative overflow-hidden">
        <div
          className={`relative w-full ${isMobile ? 'h-[310px]' : 'h-[360px] sm:h-[410px]'}`}
          style={
            heroImg
              ? undefined
              : {
                  background: `linear-gradient(135deg, ${store.branding.secondaryColor || '#1C1917'}, ${theme.primaryColor})`,
                }
          }
        >
          {heroImg && (
            <img
              src={heroImg}
              alt={heroTitle}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
          <div className="absolute inset-0 max-w-6xl mx-auto px-5 sm:px-8 flex flex-col justify-end pb-8 sm:pb-10">
            {sellerInstagram && (
              <p className="text-xs font-medium text-white/90 mb-2 flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5 shrink-0" />
                <span>{sellerInstagram}</span>
              </p>
            )}
            <h1
              className={`font-bold text-white leading-tight max-w-2xl text-balance ${
                isMobile ? 'text-2xl' : 'text-3xl sm:text-4xl'
              }`}
              style={{ fontFamily: theme.headingFontFamily }}
            >
              {heroTitle}
            </h1>
            {heroSubtitle && (
              <p className="text-xs sm:text-sm text-white/85 mt-2.5 max-w-xl leading-relaxed">
                {heroSubtitle}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href="#food-menu"
                className={`inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 text-xs sm:text-sm font-semibold transition-transform active:scale-[0.98] ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                {store.branding.heroCtaLabel?.trim() || 'Explore Menu'}
              </a>
              <span className="text-xs text-white/80 tabular-nums">
                Est. prep 15–25 mins
              </span>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Course Menu Rail / All Products Page */}
      <section id="food-menu" className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-8 pb-4 space-y-6">
        {currentPage === 'products' && (
          <StorefrontAllProductsHeader
            storeName={store.name?.trim() || 'Our Kitchen'}
            totalCount={displayItems.length}
            theme={theme}
            onBackHome={() => setCurrentPage('home')}
          />
        )}
        {displayItems.length > 0 && (
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b"
            style={{ borderColor: theme.borderColor }}
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${theme.chipRadiusClass}`}
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
                placeholder="Search dishes..."
                theme={theme}
              />
            )}
          </div>
        )}

        {/* Menu-Style Dish Grid */}
        {displayItems.length === 0 ? (
          <div
            className="border rounded-2xl p-10 text-center space-y-1.5"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No menu items available yet.</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Products added to this store will appear here.
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className="border rounded-2xl p-10 text-center space-y-2"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No dishes match your filter.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('All Courses');
                setSearchQuery('');
              }}
              className="text-xs font-semibold underline cursor-pointer"
              style={{ color: theme.accentTextColor }}
            >
              Show all courses
            </button>
          </div>
        ) : (
        <div
          className={`grid gap-5 ${
            isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
          }`}
        >
          {displayedItems.map((item, idx) => {
            const { product } = item;
            const prepMins = 15 + (idx % 3) * 5;
            const cueLabel =
              idx === 0 ? 'Bestseller' : idx === 1 ? 'Mild Spice' : 'House Favorite';
            const selectedVar =
              selectedOptions[product.id] ?? product.variants[0]?.label ?? '';

            return (
              <article
                key={product.id}
                className="border rounded-2xl overflow-hidden flex flex-col sm:flex-row transition-transform duration-150 hover:-translate-y-0.5"
                style={{
                  backgroundColor: theme.cardBg,
                  borderColor: theme.borderColor,
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectProduct?.(product, selectedVar || undefined)}
                  className={`relative shrink-0 overflow-hidden text-left cursor-pointer ${
                    isMobile ? 'w-full aspect-[16/10]' : 'sm:w-44 aspect-[4/3] sm:aspect-auto'
                  }`}
                  style={{ backgroundColor: theme.subtleBg }}
                >
                  <img
                    src={product.imageUrl || fallbackImg}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>

                <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div
                      className="flex flex-wrap items-center gap-2 text-[11px] font-medium"
                      style={{ color: theme.textMuted }}
                    >
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {prepMins} min
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className="inline-flex items-center gap-1 font-semibold"
                        style={{ color: theme.accentTextColor }}
                      >
                        <Flame className="w-3 h-3" />
                        {product.discountPercent > 0 ? `${product.discountPercent}% Off` : cueLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectProduct?.(product, selectedVar || undefined)}
                      className="text-left cursor-pointer hover:underline"
                    >
                      <h2
                        className="text-base font-bold leading-snug"
                        style={{ fontFamily: theme.headingFontFamily }}
                      >
                        {product.name}
                      </h2>
                    </button>
                    <p
                      className="text-xs leading-relaxed line-clamp-2"
                      style={{ color: theme.textMuted }}
                    >
                      {product.description}
                    </p>
                  </div>

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
                            className={`px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${theme.chipRadiusClass}`}
                            style={
                              active
                                ? {
                                    borderColor: theme.accentTextColor,
                                    color: theme.accentTextColor,
                                    backgroundColor: theme.subtleBg,
                                  }
                                : {
                                    borderColor: theme.borderColor,
                                    color: theme.textMuted,
                                  }
                            }
                          >
                            {variant.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-2 border-t flex items-center justify-between gap-3" style={{ borderColor: theme.borderColor }}>
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
                      onClick={() => handleOrderClick(item)}
                      className={`inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
                      style={{
                        backgroundColor: theme.primaryColor,
                        color: theme.onPrimaryText,
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to Order
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

      {/* Kitchen Story Band */}
      {currentPage === 'home' && (store.branding.bio?.trim() || store.branding.address?.trim()) && (
        <section id="kitchen-story" className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6">
          <div
            className="border rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{
              backgroundColor: theme.subtleBg,
              borderColor: theme.borderColor,
            }}
          >
            <div className="space-y-1 max-w-xl">
              <h3
                className="text-lg font-bold"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                About {store.name?.trim() || 'Our Kitchen'}
              </h3>
              {store.branding.bio?.trim() && (
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.textMuted }}>
                  {store.branding.bio.trim()}
                </p>
              )}
            </div>
            {store.branding.address?.trim() && (
              <div className="text-xs font-medium tabular-nums shrink-0" style={{ color: theme.textMuted }}>
                {store.branding.address.trim()}
              </div>
            )}
          </div>
        </section>
      )}

      <TemplateFooter store={store} theme={theme} isMobileLayout={isMobile} />
    </div>
  );
}
