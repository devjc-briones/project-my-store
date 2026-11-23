import { useMemo, useState } from 'react';
import { Cpu, Image as ImageIcon, Instagram, Plus, ShieldCheck, Zap } from 'lucide-react';
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

const TECH_SPECS_BY_INDEX = [
  { connectivity: 'Tri-Mode USB-C / BT 5.3', material: 'CNC 6063 Aluminum', warranty: '24 Months' },
  { connectivity: 'Bluetooth 5.3 Multipoint', material: 'Matte Polycarbonate', warranty: '24 Months' },
  { connectivity: 'Dual USB-C PD 3.1', material: 'GaN III Thermal Shell', warranty: '24 Months' },
];

export function GadgetsTemplate({
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
  const theme = resolveThemeTokens(store.branding, 'gadgets-accessories');
  const isMobile = viewport === 'mobile';
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA['gadgets-accessories'].imageUrl;
  const heroImg = store.branding.heroBannerUrl?.trim();
  const heroTitle = store.branding.heroTitle?.trim() || store.name?.trim() || 'Your Store Name';
  const heroSubtitle = store.branding.heroSubtitle?.trim();
  const sellerInstagram = store.branding.socialLinks.instagram?.trim();
  const displayItems = useMemo(() => getDisplayProductsForTemplate(store, products), [store, products]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useBodyScrollLock(mobileMenuOpen && !isPreview);

  const categories = useMemo(() => {
    const productCats = Array.from(new Set(displayItems.map((item) => item.product.category)));
    return ['All Hardware', ...productCats.slice(0, 4)];
  }, [displayItems]);

  const [activeCategory, setActiveCategory] = useState('All Hardware');
  const [searchQuery, setSearchQuery] = useState('');
  const [bagCount, setBagCount] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayItems.filter((item) => {
      if (activeCategory !== 'All Hardware' && item.product.category !== activeCategory) {
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

  const handleAddHardware = (item: (typeof displayItems)[number]) => {
    const chosen = selectedVariants[item.product.id] ?? item.product.variants[0]?.label;
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
        cartLabel="Shopping Cart"
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

      {/* Precision Hardware Hero (Landing Page only) */}
      {currentPage === 'home' && (
      <section className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6 sm:pt-8 space-y-4">
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

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#tech-catalog"
                className={`inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90 ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                {store.branding.heroCtaLabel?.trim() || 'Browse Catalog'}
              </a>
            </div>
          </div>

          <div
            className={`relative overflow-hidden flex items-center justify-center ${
              isMobile ? 'aspect-[16/10]' : 'lg:col-span-6 min-h-[280px]'
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

        {/* Warranty & Spec Guarantee Strip */}
        <div
          className={`border rounded-xl px-4 py-3 grid gap-3 text-xs ${
            isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'
          }`}
          style={{
            backgroundColor: theme.subtleBg,
            borderColor: theme.borderColor,
          }}
        >
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: theme.accentTextColor }} />
            <span>24-Month Local Replacement Warranty</span>
          </div>
          <div className="flex items-center gap-2 font-medium">
            <Zap className="w-4 h-4 shrink-0" style={{ color: theme.accentTextColor }} />
            <span>Tested Compatibility &amp; QC Certified</span>
          </div>
          <div className="flex items-center gap-2 font-medium tabular-nums">
            <Cpu className="w-4 h-4 shrink-0" style={{ color: theme.accentTextColor }} />
            <span>Same-Day Metro Hardware Dispatch</span>
          </div>
        </div>
      </section>
      )}

      {/* Tech-Spec Product Grid */}
      <section id="tech-catalog" className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-8 space-y-6">
        {currentPage === 'products' && (
          <StorefrontAllProductsHeader
            storeName={store.name?.trim() || 'Tech Store'}
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
                placeholder="Search hardware..."
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
            <p className="text-sm font-semibold">No products available yet.</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              Products added to this store will appear here.
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className="border rounded-2xl p-10 text-center space-y-2"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.borderColor }}
          >
            <p className="text-sm font-semibold">No hardware matches your filter.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('All Hardware');
                setSearchQuery('');
              }}
              className="text-xs font-semibold underline cursor-pointer"
              style={{ color: theme.accentTextColor }}
            >
              Show all hardware
            </button>
          </div>
        ) : (
        <div
          className={`grid gap-6 ${
            isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {displayedItems.map((item, idx) => {
            const { product } = item;
            const specs = TECH_SPECS_BY_INDEX[idx % TECH_SPECS_BY_INDEX.length];
            const options =
              product.variants.length > 0
                ? product.variants.map((v) => v.label)
                : ['Standard Edition'];
            const activeOpt = selectedVariants[product.id] ?? options[0];

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
                    onClick={() => onSelectProduct?.(product, activeOpt)}
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
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-medium" style={{ color: theme.textMuted }}>
                          {product.category}
                        </span>
                        <span
                          className="font-mono font-semibold inline-flex items-center gap-1"
                          style={{ color: theme.accentTextColor }}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          {product.discountPercent > 0 ? `Save ${product.discountPercent}%` : specs.warranty}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProduct?.(product, activeOpt)}
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

                    {/* Clean Comparison Spec Rows */}
                    <dl
                      className="border rounded-xl divide-y text-[11px] font-mono"
                      style={{
                        backgroundColor: theme.subtleBg,
                        borderColor: theme.borderColor,
                      }}
                    >
                      <div className="px-3 py-1.5 flex items-center justify-between gap-2" style={{ borderColor: theme.borderColor }}>
                        <dt style={{ color: theme.textMuted }}>Interface</dt>
                        <dd className="font-medium truncate">{specs.connectivity}</dd>
                      </div>
                      <div className="px-3 py-1.5 flex items-center justify-between gap-2" style={{ borderColor: theme.borderColor }}>
                        <dt style={{ color: theme.textMuted }}>Chassis</dt>
                        <dd className="font-medium truncate">{specs.material}</dd>
                      </div>
                      <div className="px-3 py-1.5 flex items-center justify-between gap-2" style={{ borderColor: theme.borderColor }}>
                        <dt style={{ color: theme.textMuted }}>SKU / Stock</dt>
                        <dd className="font-medium tabular-nums">
                          {product.sku} · {product.stock} left
                        </dd>
                      </div>
                    </dl>

                    {options.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {options.slice(0, 3).map((opt) => {
                          const active = activeOpt === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                setSelectedVariants((prev) => ({
                                  ...prev,
                                  [product.id]: opt,
                                }))
                              }
                              className={`px-2.5 py-1 text-[11px] font-medium border cursor-pointer ${theme.chipRadiusClass}`}
                              style={
                                active
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
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                    onClick={() => handleAddHardware(item)}
                    className={`inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90 ${theme.buttonRadiusClass}`}
                    style={{
                      backgroundColor: theme.primaryColor,
                      color: theme.onPrimaryText,
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add to Cart
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
