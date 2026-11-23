import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Home,
  LayoutGrid,
  PackageSearch,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  User,
  X,
  Zap,
} from 'lucide-react';
import { TEMPLATE_SHOWCASE_MEDIA } from '../../data/templateVisuals';
import { formatCurrency } from '../../utils/pricing';
import {
  StorefrontAllProductsHeader,
  StorefrontProductPagination,
  TemplateAnnouncementBar,
  TemplateFooter,
  ViewAllProductsCta,
} from '../TemplateChrome';
import {
  ResolvedThemeTokens,
  StorefrontTemplateProps,
  getDisplayProductsForTemplate,
  resolveThemeTokens,
  useStorefrontPage,
} from '../templateTypes';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { usePagination } from '../../components/common/TablePagination';

const FLAGSHIP_SPECS = [
  { chassis: 'CNC 6063 Alloy', io: 'USB-C PD 3.1 + BT 5.3', coverage: '24M Warranty' },
  { chassis: 'Anodized Frame', io: 'Low-Latency Wireless', coverage: '24M Warranty' },
  { chassis: 'GaN III Thermal', io: 'Multi-Port Smart Sync', coverage: '24M Warranty' },
];

export function GadgetsFlagshipProTemplate({
  store,
  products,
  currency = 'PHP',
  viewport = 'desktop',
  isPreview = false,
  cartCount,
  showSearchBar: _showSearchBar = false,
  activePage: controlledPage,
  onChangePage,
  currentBuyer,
  hasSavedBuyerInfo = false,
  onOpenCart,
  onOpenTrackOrder,
  onOpenBuyerAuth,
  onOpenBuyerAccount,
  onSelectProduct,
  onAddToCart,
}: StorefrontTemplateProps) {
  const [currentPage, setCurrentPage] = useStorefrontPage(controlledPage, onChangePage);
  const theme = resolveThemeTokens(store.branding, 'gadgets-flagship-pro');
  const isMobile = viewport === 'mobile';
  const fallbackImg = TEMPLATE_SHOWCASE_MEDIA['gadgets-flagship-pro'].imageUrl;
  const heroImg = store.branding.heroBannerUrl?.trim();
  const displayStoreName =
    store.branding.logoText?.trim() || store.name?.trim() || 'Monolith Labs';
  const heroTitle = store.branding.heroTitle?.trim() || displayStoreName;
  const heroSubtitle = store.branding.heroSubtitle?.trim();
  const domainLabel = store.slug ? store.domainUrl : 'mystore.com/monolith-labs';
  const displayItems = useMemo(
    () => getDisplayProductsForTemplate(store, products),
    [store, products]
  );

  // Canvas matches the crisp subtle slate aesthetic in light mode while respecting Cream & Dark settings
  const outerCanvasBg = theme.mode === 'light' ? '#F8FAFC' : theme.canvasBg;
  const buttonStyle = store.branding.buttonStyle ?? 'rounded';
  const cardRadiusClass =
    buttonStyle === 'sharp'
      ? 'rounded-none'
      : buttonStyle === 'pill'
      ? 'rounded-3xl'
      : 'rounded-2xl';
  const innerPillRadiusClass =
    buttonStyle === 'sharp'
      ? 'rounded-none'
      : buttonStyle === 'pill'
      ? 'rounded-full'
      : 'rounded-lg';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useBodyScrollLock(mobileMenuOpen && !isPreview);

  const categories = useMemo(() => {
    const productCats = Array.from(new Set(displayItems.map((item) => item.product.category)));
    return ['All', ...productCats.slice(0, 4)];
  }, [displayItems]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: displayItems.length };
    for (const item of displayItems) {
      counts[item.product.category] = (counts[item.product.category] ?? 0) + 1;
    }
    return counts;
  }, [displayItems]);

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [bagCount, setBagCount] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  const effectiveCartCount = cartCount ?? bagCount;

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayItems.filter((item) => {
      if (activeCategory !== 'All' && item.product.category !== activeCategory) {
        return false;
      }
      if (
        q &&
        !item.product.name.toLowerCase().includes(q) &&
        !item.product.description.toLowerCase().includes(q) &&
        !item.product.category.toLowerCase().includes(q) &&
        !item.product.sku.toLowerCase().includes(q)
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

  const handleAddDevice = (item: (typeof displayItems)[number]) => {
    const chosen = selectedVariants[item.product.id] ?? item.product.variants[0]?.label;
    setBagCount((c) => c + 1);
    onAddToCart?.(item.product, chosen);
  };

  const navigateStorePage = (page: 'home' | 'products' | 'info-settings') => {
    setMobileMenuOpen(false);
    setCurrentPage(page);
    if (!isPreview) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const nameWords = displayStoreName.trim().split(/\s+/);
  const primaryWord = nameWords[0] ?? displayStoreName;
  const accentWord = nameWords.slice(1).join(' ');

  return (
    <div
      className="flex-1 min-h-full flex flex-col relative isolate antialiased"
      style={{
        backgroundColor: outerCanvasBg,
        color: theme.textPrimary,
        fontFamily: theme.bodyFontFamily,
      }}
    >
      {/* Fixed Top Navigation Bar (pinned at viewport top during scroll) */}
      <header
        className={`${
          isPreview ? 'relative' : 'fixed top-0 inset-x-0'
        } z-40 w-full backdrop-blur-md border-b`}
        style={{
          backgroundColor: theme.isDark
            ? 'rgba(19, 28, 49, 0.94)'
            : 'rgba(255, 255, 255, 0.95)',
          borderColor: theme.borderColor,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Left: Brand Emblem + Wordmark */}
          <button
            type="button"
            onClick={() => navigateStorePage('home')}
            className="flex items-center gap-2.5 min-w-0 focus:outline-none group cursor-pointer text-left"
          >
            {store.branding.logoImageUrl ? (
              <img
                src={store.branding.logoImageUrl}
                alt={displayStoreName}
                referrerPolicy="no-referrer"
                className={`w-8 h-8 object-cover border shrink-0 group-hover:scale-105 transition-transform duration-200 ${theme.chipRadiusClass}`}
                style={{ borderColor: theme.borderColor }}
              />
            ) : (
              <div
                className={`w-8 h-8 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200 shrink-0 ${theme.chipRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                <Cpu className="w-4 h-4" />
              </div>
            )}
            <span
              className="font-extrabold text-[18px] sm:text-[19px] tracking-tight leading-none truncate"
              style={{ fontFamily: theme.headingFontFamily, color: theme.textPrimary }}
            >
              {primaryWord}
              {accentWord && (
                <span style={{ color: theme.accentTextColor }}> {accentWord}</span>
              )}
            </span>
          </button>

          {/* Right: Desktop Quick Links + Compact Cart Pill + Morphing Burger -> X */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isMobile && (
              <nav className="hidden md:flex items-center gap-1 mr-1">
                <button
                  type="button"
                  onClick={() => navigateStorePage('home')}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${innerPillRadiusClass}`}
                  style={
                    currentPage === 'home'
                      ? { backgroundColor: theme.primaryColor, color: theme.onPrimaryText }
                      : { color: theme.textMuted }
                  }
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => navigateStorePage('products')}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${innerPillRadiusClass}`}
                  style={
                    currentPage === 'products'
                      ? { backgroundColor: theme.primaryColor, color: theme.onPrimaryText }
                      : { color: theme.textMuted }
                  }
                >
                  Catalog
                </button>
                {Boolean(currentBuyer) && (
                  <button
                    type="button"
                    onClick={() => navigateStorePage('info-settings')}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${innerPillRadiusClass}`}
                    style={
                      currentPage === 'info-settings'
                        ? { backgroundColor: theme.primaryColor, color: theme.onPrimaryText }
                        : { color: theme.textMuted }
                    }
                  >
                    Info Settings
                  </button>
                )}
              </nav>
            )}

            <button
              type="button"
              onClick={onOpenCart}
              aria-label="Open hardware bag"
              className={`inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 border active:scale-[0.98] text-xs font-semibold transition-all cursor-pointer shrink-0 ${theme.buttonRadiusClass}`}
              style={{
                backgroundColor: theme.cardBg,
                borderColor: theme.borderColor,
                color: theme.textPrimary,
              }}
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" style={{ color: theme.textMuted }} />
              {!isMobile && <span className="hidden sm:inline">Bag</span>}
              <span
                className={`px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums leading-none ${innerPillRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                {effectiveCartCount}
              </span>
            </button>

            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className={`relative z-50 w-10 h-10 -mr-1 flex items-center justify-center border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 ${theme.buttonRadiusClass} ${
                mobileMenuOpen ? 'menu-open' : ''
              }`}
              style={{
                backgroundColor: theme.subtleBg,
                borderColor: theme.borderColor,
                color: theme.textPrimary,
              }}
            >
              <span className="sr-only">
                {mobileMenuOpen ? 'Close menu' : 'Open menu'}
              </span>
              <div className="w-[19px] h-[16px] flex flex-col justify-between items-center pointer-events-none">
                <span
                  className="burger-line line-1 block w-full h-[2px] rounded-full"
                  style={{ backgroundColor: theme.textPrimary }}
                />
                <span
                  className="burger-line line-2 block w-full h-[2px] rounded-full"
                  style={{ backgroundColor: theme.textPrimary }}
                />
                <span
                  className="burger-line line-3 block w-full h-[2px] rounded-full"
                  style={{ backgroundColor: theme.textPrimary }}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Preview-scoped floating backdrop & drawer anchor */}
        {isPreview && (
          <>
            <div
              aria-hidden="true"
              onClick={() => setMobileMenuOpen(false)}
              className={`fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
                mobileMenuOpen
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 pointer-events-none'
              }`}
            />
            <FlagshipFloatingDrawer
              isPreview
              isOpen={mobileMenuOpen}
              theme={theme}
              cardRadiusClass={cardRadiusClass}
              displayStoreName={displayStoreName}
              domainLabel={domainLabel}
              activePage={currentPage}
              displayItemsCount={displayItems.length}
              effectiveCartCount={effectiveCartCount}
              currentBuyer={currentBuyer}
              hasSavedBuyerInfo={hasSavedBuyerInfo}
              onNavigate={navigateStorePage}
              onClose={() => setMobileMenuOpen(false)}
              onOpenTrackOrder={onOpenTrackOrder}
              onOpenCart={onOpenCart}
              onOpenBuyerAuth={onOpenBuyerAuth}
              onOpenBuyerAccount={onOpenBuyerAccount}
            />
          </>
        )}
      </header>

      {/* Spacer matching fixed header height in live storefront */}
      {!isPreview && <div className="h-14 shrink-0" aria-hidden="true" />}

      {/* Live Storefront Backdrop & Floating Drawer */}
      {!isPreview && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className={`fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
              mobileMenuOpen
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
          />
          <FlagshipFloatingDrawer
            isPreview={false}
            isOpen={mobileMenuOpen}
            theme={theme}
            cardRadiusClass={cardRadiusClass}
            displayStoreName={displayStoreName}
            domainLabel={domainLabel}
            activePage={currentPage}
            displayItemsCount={displayItems.length}
            effectiveCartCount={effectiveCartCount}
            currentBuyer={currentBuyer}
            hasSavedBuyerInfo={hasSavedBuyerInfo}
            onNavigate={navigateStorePage}
            onClose={() => setMobileMenuOpen(false)}
            onOpenTrackOrder={onOpenTrackOrder}
            onOpenCart={onOpenCart}
            onOpenBuyerAuth={onOpenBuyerAuth}
            onOpenBuyerAccount={onOpenBuyerAccount}
          />
        </>
      )}

      <TemplateAnnouncementBar store={store} theme={theme} />

      {/* Main Content Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3.5 sm:px-6 py-4 space-y-4">
        <div key={currentPage} className="flagship-view-animate space-y-4">
          {currentPage === 'home' && (
            <>
              {/* Compact Hero Card */}
              <section
                className={`border shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden ${cardRadiusClass}`}
                style={{
                  backgroundColor: theme.cardBg,
                  borderColor: theme.borderColor,
                }}
              >
                <div
                  className={`grid items-stretch ${
                    isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
                  }`}
                >
                  <div className="lg:col-span-6 p-5 sm:p-7 flex flex-col justify-between gap-5 pro-hero-copy">
                    <div className="space-y-3">
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold border ${theme.chipRadiusClass}`}
                        style={{
                          backgroundColor: theme.subtleBg,
                          borderColor: theme.borderColor,
                          color: theme.accentTextColor,
                        }}
                      >
                        <Cpu className="w-3.5 h-3.5 shrink-0" />
                        <span>Flagship Hardware Series</span>
                      </div>

                      <h1
                        className={`font-extrabold tracking-tight leading-[1.12] text-balance ${
                          isMobile ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
                        }`}
                        style={{
                          fontFamily: theme.headingFontFamily,
                          color: theme.textPrimary,
                        }}
                      >
                        {heroTitle}
                      </h1>

                      {heroSubtitle && (
                        <p
                          className="text-xs sm:text-sm leading-relaxed max-w-md"
                          style={{ color: theme.textMuted }}
                        >
                          {heroSubtitle}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <a
                        href="#flagship-hardware"
                        className={`pro-btn-press inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold shadow-xs transition-all whitespace-nowrap ${theme.buttonRadiusClass}`}
                        style={{
                          backgroundColor: theme.primaryColor,
                          color: theme.onPrimaryText,
                        }}
                      >
                        <span>{store.branding.heroCtaLabel?.trim() || 'Inspect Hardware'}</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </a>
                      <button
                        type="button"
                        onClick={() => navigateStorePage('products')}
                        className={`pro-btn-press inline-flex items-center justify-center min-h-[40px] px-4 py-2 border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap hover:opacity-85 ${theme.buttonRadiusClass}`}
                        style={{
                          backgroundColor: theme.subtleBg,
                          borderColor: theme.borderColor,
                          color: theme.textPrimary,
                        }}
                      >
                        Full Catalog ({displayItems.length})
                      </button>
                    </div>
                  </div>

                  <div
                    className={`lg:col-span-6 relative overflow-hidden border-t lg:border-t-0 lg:border-l ${
                      isMobile ? 'aspect-[16/10]' : 'min-h-[250px] lg:min-h-[300px]'
                    }`}
                    style={{
                      backgroundColor: theme.subtleBg,
                      borderColor: theme.borderColor,
                    }}
                  >
                    <img
                      src={heroImg || fallbackImg}
                      alt={heroTitle}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover pro-hero-media"
                    />
                  </div>
                </div>
              </section>

              {/* Compact 2-Col Mobile / 4-Col Desktop KPI Spec Grid */}
              <section
                id="flagship-specs"
                className={`grid gap-2.5 sm:gap-3.5 ${
                  isMobile ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'
                }`}
              >
                <article
                  className={`border p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-2.5 transition-colors ${cardRadiusClass}`}
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.borderColor,
                  }}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <h2
                      className="text-[12px] sm:text-[13px] font-medium leading-snug"
                      style={{ color: theme.textMuted }}
                    >
                      Hardware Units
                    </h2>
                    <span
                      className={`w-6 h-6 border flex items-center justify-center shrink-0 ${innerPillRadiusClass}`}
                      style={{
                        backgroundColor: theme.subtleBg,
                        borderColor: theme.borderColor,
                        color: theme.accentTextColor,
                      }}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div>
                    <div
                      className="font-mono font-bold text-xl sm:text-2xl tracking-tight tabular-nums"
                      style={{ color: theme.textPrimary }}
                    >
                      {displayItems.length}
                    </div>
                    <p
                      className="text-[11px] leading-tight mt-1"
                      style={{ color: theme.textMuted }}
                    >
                      {Math.max(1, categories.length - 1)} system lines active
                    </p>
                  </div>
                </article>

                <article
                  className={`border p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-2.5 transition-colors ${cardRadiusClass}`}
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.borderColor,
                  }}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <h2
                      className="text-[12px] sm:text-[13px] font-medium leading-snug"
                      style={{ color: theme.textMuted }}
                    >
                      Local Warranty
                    </h2>
                    <span
                      className={`w-6 h-6 border flex items-center justify-center shrink-0 ${innerPillRadiusClass}`}
                      style={{
                        backgroundColor: theme.subtleBg,
                        borderColor: theme.borderColor,
                        color: theme.accentTextColor,
                      }}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div>
                    <div
                      className="font-mono font-bold text-xl sm:text-2xl tracking-tight tabular-nums"
                      style={{ color: theme.textPrimary }}
                    >
                      24 Mo
                    </div>
                    <p
                      className="text-[11px] leading-tight mt-1"
                      style={{ color: theme.textMuted }}
                    >
                      Direct swap unit coverage
                    </p>
                  </div>
                </article>

                <article
                  className={`border p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-2.5 transition-colors ${cardRadiusClass}`}
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.borderColor,
                  }}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <h2
                      className="text-[12px] sm:text-[13px] font-medium leading-snug"
                      style={{ color: theme.textMuted }}
                    >
                      Dispatch SLA
                    </h2>
                    <span
                      className={`w-6 h-6 border flex items-center justify-center shrink-0 ${innerPillRadiusClass}`}
                      style={{
                        backgroundColor: theme.subtleBg,
                        borderColor: theme.borderColor,
                        color: theme.accentTextColor,
                      }}
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div>
                    <div
                      className="font-mono font-bold text-xl sm:text-2xl tracking-tight tabular-nums"
                      style={{ color: theme.textPrimary }}
                    >
                      Same-Day
                    </div>
                    <p
                      className="text-[11px] leading-tight mt-1"
                      style={{ color: theme.textMuted }}
                    >
                      Foam-sealed insured courier
                    </p>
                  </div>
                </article>

                <article
                  className={`border p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-2.5 transition-colors ${cardRadiusClass}`}
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.borderColor,
                  }}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <h2
                      className="text-[12px] sm:text-[13px] font-medium leading-snug"
                      style={{ color: theme.textMuted }}
                    >
                      Hardware Bag
                    </h2>
                    <span
                      className={`w-6 h-6 border flex items-center justify-center shrink-0 ${innerPillRadiusClass}`}
                      style={{
                        backgroundColor: theme.subtleBg,
                        borderColor: theme.borderColor,
                        color: theme.accentTextColor,
                      }}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div>
                    <div
                      className="font-mono font-bold text-xl sm:text-2xl tracking-tight tabular-nums"
                      style={{ color: theme.textPrimary }}
                    >
                      {effectiveCartCount}
                    </div>
                    <p className="text-[11px] leading-tight mt-1">
                      <button
                        type="button"
                        onClick={onOpenCart}
                        className="font-semibold hover:underline cursor-pointer"
                        style={{ color: theme.accentTextColor }}
                      >
                        Open checkout &rarr;
                      </button>
                    </p>
                  </div>
                </article>
              </section>
            </>
          )}

          {currentPage === 'products' && (
            <StorefrontAllProductsHeader
              storeName={displayStoreName}
              totalCount={displayItems.length}
              theme={theme}
              onBackHome={() => navigateStorePage('home')}
            />
          )}

          {/* Search & Segmented Filter Pills Bar */}
          <section id="flagship-hardware" className="space-y-3">
            {displayItems.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: theme.textMuted }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search hardware, SKU, specs..."
                    aria-label="Search hardware catalog"
                    className={`w-full h-10 pl-10 pr-8 border text-xs sm:text-sm focus:outline-none focus:ring-2 transition ${theme.buttonRadiusClass}`}
                    style={{
                      backgroundColor: theme.cardBg,
                      borderColor: theme.borderColor,
                      color: theme.textPrimary,
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-xs cursor-pointer"
                      style={{
                        backgroundColor: theme.subtleBg,
                        color: theme.textMuted,
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Segmented Pill Tabs */}
                <div
                  className={`inline-flex items-center self-start p-1 border overflow-x-auto max-w-full ${theme.buttonRadiusClass}`}
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.borderColor,
                  }}
                  role="tablist"
                  aria-label="Filter hardware by category"
                >
                  {categories.map((cat) => {
                    const active = activeCategory === cat;
                    const count = categoryCounts[cat] ?? 0;
                    return (
                      <button
                        key={cat}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3.5 py-1.5 text-xs whitespace-nowrap shrink-0 transition-all cursor-pointer ${innerPillRadiusClass} ${
                          active ? 'font-semibold' : 'font-medium hover:opacity-80'
                        }`}
                        style={
                          active
                            ? {
                                backgroundColor: theme.primaryColor,
                                color: theme.onPrimaryText,
                              }
                            : {
                                color: theme.textMuted,
                              }
                        }
                      >
                        {cat}{' '}
                        <span
                          className="ml-0.5 text-[10px] font-mono"
                          style={{ opacity: active ? 0.78 : 0.7 }}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Catalog Panel */}
            <div
              className={`border shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden ${cardRadiusClass}`}
              style={{
                backgroundColor: theme.cardBg,
                borderColor: theme.borderColor,
              }}
            >
              <div
                className="px-3.5 sm:px-4 py-2.5 border-b flex items-center justify-between text-[11px] font-semibold"
                style={{
                  backgroundColor: theme.subtleBg,
                  borderColor: theme.borderColor,
                  color: theme.textMuted,
                }}
              >
                <span>
                  {currentPage === 'products'
                    ? 'Full Hardware Catalog'
                    : 'Featured Hardware'}
                </span>
                <span className="font-mono tabular-nums" style={{ color: theme.textMuted }}>
                  {displayedItems.length}{' '}
                  {displayedItems.length === 1 ? 'unit' : 'units'}
                  {visibleItems.length !== displayedItems.length
                    ? ` of ${visibleItems.length}`
                    : ''}
                </span>
              </div>

              {displayItems.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-1.5">
                  <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
                    No hardware listed yet
                  </p>
                  <p className="text-xs" style={{ color: theme.textMuted }}>
                    Devices and desk accessories added to this store will appear here.
                  </p>
                </div>
              ) : visibleItems.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-2">
                  <div
                    className="w-10 h-10 rounded-full mx-auto flex items-center justify-center border"
                    style={{
                      backgroundColor: theme.subtleBg,
                      borderColor: theme.borderColor,
                      color: theme.textMuted,
                    }}
                  >
                    <Search className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
                    No matching hardware units
                  </p>
                  <p className="text-xs" style={{ color: theme.textMuted }}>
                    Try clearing your search or switching the category pill.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('All');
                      setSearchQuery('');
                    }}
                    className={`mt-1 inline-flex items-center px-3 py-1.5 border text-xs font-semibold hover:opacity-85 cursor-pointer ${theme.buttonRadiusClass}`}
                    style={{
                      backgroundColor: theme.subtleBg,
                      borderColor: theme.borderColor,
                      color: theme.textPrimary,
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="p-3.5 sm:p-4 space-y-4">
                  <div
                    className={`pro-stagger-grid grid gap-3.5 ${
                      isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    }`}
                  >
                    {displayedItems.map((item, idx) => {
                      const { product } = item;
                      const specs = FLAGSHIP_SPECS[idx % FLAGSHIP_SPECS.length];
                      const selectedVar =
                        selectedVariants[product.id] ?? product.variants[0]?.label ?? '';

                      return (
                        <article
                          key={product.id}
                          className={`pro-card-elevate border transition-colors overflow-hidden flex flex-col justify-between ${cardRadiusClass}`}
                          style={{
                            backgroundColor: theme.cardBg,
                            borderColor: theme.borderColor,
                          }}
                        >
                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                onSelectProduct?.(product, selectedVar || undefined)
                              }
                              className="relative aspect-[16/10] w-full overflow-hidden border-b block cursor-pointer group"
                              style={{
                                backgroundColor: theme.subtleBg,
                                borderColor: theme.borderColor,
                              }}
                            >
                              <img
                                src={product.imageUrl || fallbackImg}
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover pro-card-img"
                              />
                              <span
                                className={`absolute bottom-2.5 left-2.5 font-mono text-[10px] font-semibold backdrop-blur-sm px-2 py-0.5 border ${innerPillRadiusClass}`}
                                style={{
                                  backgroundColor: theme.isDark
                                    ? 'rgba(15, 23, 42, 0.88)'
                                    : 'rgba(255, 255, 255, 0.92)',
                                  borderColor: theme.borderColor,
                                  color: theme.textPrimary,
                                }}
                              >
                                {specs.chassis}
                              </span>
                            </button>

                            <div className="p-3.5 space-y-2.5">
                              {/* Top SKU + Category Pill Row */}
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`font-mono text-[11px] font-semibold px-2 py-0.5 border truncate ${innerPillRadiusClass}`}
                                  style={{
                                    backgroundColor: theme.subtleBg,
                                    borderColor: theme.borderColor,
                                    color: theme.textPrimary,
                                  }}
                                >
                                  {product.sku}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0 ${innerPillRadiusClass}`}
                                  style={{
                                    backgroundColor: theme.subtleBg,
                                    color: theme.accentTextColor,
                                  }}
                                >
                                  {product.category}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  onSelectProduct?.(product, selectedVar || undefined)
                                }
                                className="text-left cursor-pointer hover:underline block w-full"
                              >
                                <h3
                                  className="text-sm sm:text-base font-bold leading-snug"
                                  style={{
                                    fontFamily: theme.headingFontFamily,
                                    color: theme.textPrimary,
                                  }}
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

                              {/* Status & Spec Row */}
                              <div
                                className="pt-2 border-t flex items-center justify-between gap-2 text-[11px]"
                                style={{ borderColor: theme.borderColor }}
                              >
                                <span
                                  className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                                    theme.isDark ? 'text-emerald-400' : 'text-emerald-700'
                                  }`}
                                >
                                  <CheckCircle2
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      theme.isDark ? 'text-emerald-400' : 'text-emerald-600'
                                    }`}
                                  />
                                  <span>Ready</span>
                                </span>
                                <span
                                  className="font-mono truncate"
                                  style={{ color: theme.textMuted }}
                                >
                                  {specs.io}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="px-3.5 pb-3.5 space-y-2.5">
                            {product.variants.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {product.variants.slice(0, 3).map((variant) => {
                                  const active = selectedVar === variant.label;
                                  return (
                                    <button
                                      key={variant.id}
                                      type="button"
                                      onClick={() =>
                                        setSelectedVariants((prev) => ({
                                          ...prev,
                                          [product.id]: variant.label,
                                        }))
                                      }
                                      className={`px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${theme.chipRadiusClass}`}
                                      style={
                                        active
                                          ? {
                                              backgroundColor: theme.primaryColor,
                                              borderColor: theme.primaryColor,
                                              color: theme.onPrimaryText,
                                            }
                                          : {
                                              backgroundColor: theme.subtleBg,
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

                            <div
                              className="pt-2.5 border-t flex items-center justify-between gap-2"
                              style={{ borderColor: theme.borderColor }}
                            >
                              <div className="flex items-baseline gap-1.5 tabular-nums">
                                <span
                                  className="font-mono text-sm sm:text-base font-bold"
                                  style={{ color: theme.textPrimary }}
                                >
                                  {formatCurrency(product.finalPrice, currency)}
                                </span>
                                {product.discountPercent > 0 && (
                                  <span
                                    className="font-mono text-[11px] line-through"
                                    style={{ color: theme.textMuted }}
                                  >
                                    {formatCurrency(product.basePrice, currency)}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddDevice(item)}
                                className={`pro-btn-press inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
                                style={{
                                  backgroundColor: theme.primaryColor,
                                  color: theme.onPrimaryText,
                                }}
                              >
                                <Plus className="w-3.5 h-3.5 shrink-0" />
                                <span>Add Hardware</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {currentPage === 'home' && displayItems.length > 0 && (
                    <ViewAllProductsCta
                      theme={theme}
                      totalCount={displayItems.length}
                      onClick={() => navigateStorePage('products')}
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
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <TemplateFooter store={store} theme={theme} isMobileLayout={isMobile} />
    </div>
  );
}

interface FlagshipFloatingDrawerProps {
  isPreview: boolean;
  isOpen: boolean;
  theme: ResolvedThemeTokens;
  cardRadiusClass: string;
  displayStoreName: string;
  domainLabel: string;
  activePage: 'home' | 'products' | 'info-settings';
  displayItemsCount: number;
  effectiveCartCount: number;
  currentBuyer?: StorefrontTemplateProps['currentBuyer'];
  hasSavedBuyerInfo: boolean;
  onNavigate: (page: 'home' | 'products' | 'info-settings') => void;
  onClose: () => void;
  onOpenTrackOrder?: () => void;
  onOpenCart?: () => void;
  onOpenBuyerAuth?: () => void;
  onOpenBuyerAccount?: () => void;
}

function FlagshipFloatingDrawer({
  isPreview,
  isOpen,
  theme,
  cardRadiusClass,
  displayStoreName,
  domainLabel,
  activePage,
  displayItemsCount,
  effectiveCartCount,
  currentBuyer,
  hasSavedBuyerInfo,
  onNavigate,
  onClose,
  onOpenTrackOrder,
  onOpenCart,
  onOpenBuyerAuth,
  onOpenBuyerAccount,
}: FlagshipFloatingDrawerProps) {
  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Store Navigation Menu"
      aria-hidden={!isOpen}
      className={`${
        isPreview
          ? 'absolute top-[calc(100%+0.5rem)] left-3 right-3 z-40'
          : 'fixed top-[62px] left-3 right-3 z-40'
      } mx-auto max-w-md border shadow-2xl shadow-slate-900/15 p-3 transform transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${cardRadiusClass} ${
        isOpen
          ? 'translate-y-0 scale-100 opacity-100 visible pointer-events-auto drawer-active'
          : '-translate-y-3 scale-[0.98] opacity-0 invisible pointer-events-none'
      }`}
      style={{
        backgroundColor: theme.cardBg,
        borderColor: theme.borderColor,
        color: theme.textPrimary,
      }}
    >
      <div className="px-2.5 pt-1 pb-2 flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider truncate"
          style={{ color: theme.textMuted }}
        >
          {displayStoreName} Navigation
        </span>
        <span
          className="text-[11px] font-mono truncate max-w-[160px]"
          style={{ color: theme.textMuted }}
        >
          {domainLabel}
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => onNavigate('home')}
          className={`flagship-drawer-item w-full flex items-center justify-between px-3 py-2.5 text-sm text-left cursor-pointer ${theme.buttonRadiusClass} ${
            activePage === 'home' ? 'font-semibold' : 'font-medium hover:opacity-80'
          }`}
          style={
            activePage === 'home'
              ? { backgroundColor: theme.primaryColor, color: theme.onPrimaryText }
              : { color: theme.textPrimary }
          }
        >
          <span className="flex items-center gap-3">
            <Home
              className="w-4 h-4 shrink-0"
              style={{
                color: activePage === 'home' ? theme.onPrimaryText : theme.textMuted,
              }}
            />
            <span>Store Home</span>
          </span>
        </button>

        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => onNavigate('products')}
          className={`flagship-drawer-item w-full flex items-center justify-between px-3 py-2.5 text-sm text-left cursor-pointer ${theme.buttonRadiusClass} ${
            activePage === 'products' ? 'font-semibold' : 'font-medium hover:opacity-80'
          }`}
          style={
            activePage === 'products'
              ? { backgroundColor: theme.primaryColor, color: theme.onPrimaryText }
              : { color: theme.textPrimary }
          }
        >
          <span className="flex items-center gap-3">
            <LayoutGrid
              className="w-4 h-4 shrink-0"
              style={{
                color: activePage === 'products' ? theme.onPrimaryText : theme.textMuted,
              }}
            />
            <span>View all products</span>
          </span>
          <span
            className="text-xs font-mono"
            style={{
              color: activePage === 'products' ? theme.onPrimaryText : theme.textMuted,
              opacity: activePage === 'products' ? 0.8 : 1,
            }}
          >
            {displayItemsCount}
          </span>
        </button>

        {Boolean(currentBuyer) && (
          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            onClick={() => onNavigate('info-settings')}
            className={`flagship-drawer-item w-full flex items-center justify-between px-3 py-2.5 text-sm text-left cursor-pointer ${theme.buttonRadiusClass} ${
              activePage === 'info-settings' ? 'font-semibold' : 'font-medium hover:opacity-80'
            }`}
            style={
              activePage === 'info-settings'
                ? { backgroundColor: theme.primaryColor, color: theme.onPrimaryText }
                : { color: theme.textPrimary }
            }
          >
            <span className="flex items-center gap-3">
              <SlidersHorizontal
                className="w-4 h-4 shrink-0"
                style={{
                  color:
                    activePage === 'info-settings' ? theme.onPrimaryText : theme.textMuted,
                }}
              />
              <span>Information Settings</span>
            </span>
            <span
              className={`text-[11px] font-medium px-1.5 py-0.5 ${theme.chipRadiusClass}`}
              style={{
                backgroundColor:
                  activePage === 'info-settings'
                    ? 'rgba(255,255,255,0.18)'
                    : theme.subtleBg,
                color:
                  activePage === 'info-settings'
                    ? theme.onPrimaryText
                    : hasSavedBuyerInfo
                    ? theme.accentTextColor
                    : theme.textMuted,
              }}
            >
              {hasSavedBuyerInfo ? 'Saved' : 'Setup'}
            </span>
          </button>
        )}

        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => {
            onClose();
            onOpenTrackOrder?.();
          }}
          className={`flagship-drawer-item w-full flex items-center justify-between px-3 py-2.5 font-medium text-sm text-left hover:opacity-80 cursor-pointer ${theme.buttonRadiusClass}`}
          style={{ color: theme.textPrimary }}
        >
          <span className="flex items-center gap-3">
            <PackageSearch className="w-4 h-4 shrink-0" style={{ color: theme.textMuted }} />
            <span>Track Order</span>
          </span>
        </button>

        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => {
            onClose();
            onOpenCart?.();
          }}
          className={`flagship-drawer-item w-full flex items-center justify-between px-3 py-2.5 font-medium text-sm text-left hover:opacity-80 cursor-pointer ${theme.buttonRadiusClass}`}
          style={{ color: theme.textPrimary }}
        >
          <span className="flex items-center gap-3">
            <ShoppingBag className="w-4 h-4 shrink-0" style={{ color: theme.textMuted }} />
            <span>Hardware Bag</span>
          </span>
          <span className="text-xs font-mono" style={{ color: theme.textMuted }}>
            {effectiveCartCount}
          </span>
        </button>

        <div
          className="flagship-drawer-item pt-2 mt-1.5 border-t"
          style={{ borderColor: theme.borderColor }}
        >
          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            onClick={() => {
              onClose();
              if (currentBuyer) {
                onOpenBuyerAccount?.();
              } else {
                onOpenBuyerAuth?.();
              }
            }}
            className={`pro-btn-press w-full flex items-center justify-between px-3 py-2.5 font-semibold text-sm transition-all cursor-pointer ${theme.buttonRadiusClass}`}
            style={{
              backgroundColor: theme.primaryColor,
              color: theme.onPrimaryText,
            }}
          >
            <span className="flex items-center gap-3 min-w-0">
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {currentBuyer ? currentBuyer.name : 'Sign In / Sign Up'}
              </span>
            </span>
            <span className="text-[11px] font-normal opacity-80 shrink-0 ml-2">
              {currentBuyer ? 'Account' : 'Sign In'}
            </span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
