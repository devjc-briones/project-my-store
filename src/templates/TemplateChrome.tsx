import { ReactNode, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutGrid,
  MapPin,
  PackageSearch,
  Phone,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import { BuyerAccount, Store } from '../types/schema';
import { useStore } from '../context/StoreContext';
import { ResolvedThemeTokens, StorefrontViewPage } from './templateTypes';

interface AnnouncementBarProps {
  store: Store;
  theme: ResolvedThemeTokens;
}

export function TemplateAnnouncementBar({ store, theme }: AnnouncementBarProps) {
  const announcementText = store.branding.announcementText.trim();
  if (!store.branding.announcementEnabled || !announcementText) {
    return null;
  }

  const durationSeconds = Math.max(12, Math.min(28, Math.round(announcementText.length * 0.22)));

  return (
    <div
      className="announcement-marquee-track w-full overflow-hidden py-2 text-xs font-medium tracking-tight"
      style={{
        backgroundColor: theme.primaryColor,
        color: theme.onPrimaryText,
      }}
    >
      <div className="flex w-full overflow-hidden">
        <div
          className="announcement-marquee-item shrink-0 min-w-full flex items-center justify-center px-8 whitespace-nowrap"
          style={{ animationDuration: `${durationSeconds}s` }}
        >
          <span>{announcementText}</span>
        </div>
        <div
          aria-hidden="true"
          className="announcement-marquee-item announcement-marquee-duplicate shrink-0 min-w-full flex items-center justify-center px-8 whitespace-nowrap"
          style={{ animationDuration: `${durationSeconds}s` }}
        >
          <span>{announcementText}</span>
        </div>
      </div>
    </div>
  );
}

interface BrandMarkProps {
  store: Store;
  theme: ResolvedThemeTokens;
}

export function TemplateBrandMark({ store, theme }: BrandMarkProps) {
  const displayName = store.branding.logoText?.trim() || store.name?.trim() || 'Your Store';

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {store.branding.logoImageUrl ? (
        <img
          src={store.branding.logoImageUrl}
          alt={`${displayName} logo`}
          referrerPolicy="no-referrer"
          className={`w-8 h-8 object-cover shrink-0 border ${theme.chipRadiusClass}`}
          style={{ borderColor: theme.borderColor }}
        />
      ) : (
        <div
          className={`w-8 h-8 flex items-center justify-center text-xs font-bold shrink-0 ${theme.chipRadiusClass}`}
          style={{
            backgroundColor: theme.primaryColor,
            color: theme.onPrimaryText,
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <span
        className="text-base sm:text-lg font-bold tracking-tight truncate"
        style={{ fontFamily: theme.headingFontFamily, color: theme.textPrimary }}
      >
        {displayName}
      </span>
    </div>
  );
}

interface CartButtonProps {
  count: number;
  theme: ResolvedThemeTokens;
  label?: string;
  onClick?: () => void;
}

export function TemplateCartButton({ count, theme, label = 'Bag', onClick }: CartButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 min-h-[38px] px-3.5 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${theme.buttonRadiusClass}`}
      style={{
        backgroundColor: theme.subtleBg,
        borderColor: theme.borderColor,
        color: theme.textPrimary,
      }}
    >
      <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
      <span
        className="tabular-nums font-mono text-[11px] px-1.5 py-0.5 rounded"
        style={{
          backgroundColor: theme.primaryColor,
          color: theme.onPrimaryText,
        }}
      >
        {count}
      </span>
    </button>
  );
}

interface TrackOrderButtonProps {
  theme: ResolvedThemeTokens;
  compact?: boolean;
  onClick?: () => void;
}

export function TemplateTrackOrderButton({
  theme,
  compact = false,
  onClick,
}: TrackOrderButtonProps) {
  return (
    <button
      type="button"
      aria-label="Track Order"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:opacity-85 ${theme.buttonRadiusClass}`}
      style={{
        backgroundColor: theme.cardBg,
        borderColor: theme.borderColor,
        color: theme.textPrimary,
      }}
    >
      <PackageSearch className="w-3.5 h-3.5 shrink-0" style={{ color: theme.accentTextColor }} />
      {compact ? (
        <span>Track</span>
      ) : (
        <>
          <span className="hidden sm:inline">Track Order</span>
          <span className="sm:hidden">Track</span>
        </>
      )}
    </button>
  );
}

interface StorefrontBurgerButtonProps {
  theme: ResolvedThemeTokens;
  isOpen: boolean;
  onClick: () => void;
}

export function StorefrontBurgerButton({
  theme,
  isOpen,
  onClick,
}: StorefrontBurgerButtonProps) {
  return (
    <button
      type="button"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
      onClick={onClick}
      className={`relative z-10 w-11 h-11 rounded-xl flex flex-col items-center justify-center border active:scale-95 transition-all duration-200 cursor-pointer touch-manipulation select-none focus-visible:outline-none focus-visible:ring-2 ${
        isOpen ? 'menu-open' : ''
      }`}
      style={{
        backgroundColor: theme.subtleBg,
        borderColor: theme.borderColor,
        color: theme.textPrimary,
      }}
    >
      <span className="sr-only">{isOpen ? 'Close menu' : 'Open menu'}</span>
      <div className="w-5 h-4 flex flex-col justify-between items-center pointer-events-none">
        <span
          className="burger-line line-1 block w-5 h-[2px] rounded-full"
          style={{ backgroundColor: theme.textPrimary }}
        />
        <span
          className="burger-line line-2 block w-5 h-[2px] rounded-full"
          style={{ backgroundColor: theme.textPrimary }}
        />
        <span
          className="burger-line line-3 block w-5 h-[2px] rounded-full"
          style={{ backgroundColor: theme.textPrimary }}
        />
      </div>
    </button>
  );
}

interface StorefrontNavDrawerProps {
  store: Store;
  theme: ResolvedThemeTokens;
  isOpen: boolean;
  isPreview?: boolean;
  cartCount: number;
  cartLabel?: string;
  currentBuyer?: BuyerAccount | null;
  hasSavedBuyerInfo?: boolean;
  activePage?: StorefrontViewPage;
  onNavigatePage?: (page: StorefrontViewPage) => void;
  onClose: () => void;
  onOpenBuyerAuth?: () => void;
  onOpenBuyerAccount?: () => void;
  onOpenTrackOrder?: () => void;
  onOpenCart?: () => void;
}

export function StorefrontNavDrawer({
  store,
  theme,
  isOpen,
  isPreview = false,
  cartCount,
  cartLabel = 'Shopping Bag',
  currentBuyer,
  hasSavedBuyerInfo = false,
  activePage = 'home',
  onNavigatePage,
  onClose,
  onOpenBuyerAuth,
  onOpenBuyerAccount,
  onOpenTrackOrder,
  onOpenCart,
}: StorefrontNavDrawerProps) {
  const drawerDisplayName =
    store.name?.trim() || store.branding.logoText?.trim() || 'Your Store';
  const drawerDomainUrl = store.slug ? store.domainUrl : 'mystore.com/your-store';

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      aria-label="Storefront Navigation"
      className={`${
        isPreview
          ? 'absolute top-[calc(100%+0.5rem)] left-3 right-3 sm:mx-auto sm:max-w-md z-30 max-h-[calc(100dvh-9.5rem)]'
          : 'fixed top-[4.5rem] left-3 right-3 sm:mx-auto sm:max-w-md z-[25] max-h-[calc(100dvh-5.5rem)]'
      } rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl shadow-slate-900/15 p-5 overflow-y-auto overscroll-contain transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen
          ? 'translate-y-0 scale-100 opacity-100 visible pointer-events-auto drawer-active'
          : '-translate-y-4 scale-[0.97] opacity-0 invisible pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between px-2 pb-3 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          {store.branding.logoImageUrl ? (
            <img
              src={store.branding.logoImageUrl}
              alt={drawerDisplayName}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-xl object-cover shrink-0 border border-slate-200/80"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: theme.primaryColor, color: theme.onPrimaryText }}
            >
              {drawerDisplayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{drawerDisplayName}</p>
            <p className="text-[11px] font-mono text-slate-500 truncate">{drawerDomainUrl}</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold tracking-wide text-slate-400 shrink-0">
          Menu
        </span>
      </div>

      <nav className="flex flex-col gap-1.5 pt-1">
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
          className="nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/15 transition-all cursor-pointer touch-manipulation"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <User className="w-4 h-4 text-slate-300 shrink-0" />
            <span className="truncate">
              {currentBuyer ? `Account (${currentBuyer.name})` : 'Sign In / Sign Up'}
            </span>
          </span>
          <span className="text-xs text-slate-300 shrink-0 ml-2">Manage</span>
        </button>

        {onNavigatePage && (
          <>
            <button
              type="button"
              tabIndex={isOpen ? 0 : -1}
              onClick={() => {
                onClose();
                onNavigatePage('home');
              }}
              className={`nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm transition-colors cursor-pointer touch-manipulation ${
                activePage === 'home'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100/80 font-medium'
              }`}
            >
              <span className="flex items-center gap-3">
                <Home className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Store Home</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              tabIndex={isOpen ? 0 : -1}
              onClick={() => {
                onClose();
                onNavigatePage('products');
              }}
              className={`nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm transition-colors cursor-pointer touch-manipulation ${
                activePage === 'products'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100/80 font-medium'
              }`}
            >
              <span className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4 text-slate-400 shrink-0" />
                <span>View all products</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {currentBuyer && (
              <button
                type="button"
                tabIndex={isOpen ? 0 : -1}
                onClick={() => {
                  onClose();
                  onNavigatePage('info-settings');
                }}
                className={`nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm transition-colors cursor-pointer touch-manipulation ${
                  activePage === 'info-settings'
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                }`}
              >
                <span className="flex items-center gap-3">
                  <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Information Settings</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {hasSavedBuyerInfo && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Saved
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </span>
              </button>
            )}
          </>
        )}

        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => {
            onClose();
            onOpenTrackOrder?.();
          }}
          className="nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer touch-manipulation"
        >
          <span className="flex items-center gap-3">
            <PackageSearch className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Track Order</span>
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => {
            onClose();
            onOpenCart?.();
          }}
          className="nav-item-stagger w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer touch-manipulation"
        >
          <span className="flex items-center gap-3">
            <ShoppingBag className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{cartLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="tabular-nums font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-900">
              {cartCount}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </span>
        </button>
      </nav>
    </aside>
  );
}

interface StorefrontHeaderProps {
  store: Store;
  theme: ResolvedThemeTokens;
  isOpen: boolean;
  isPreview?: boolean;
  isMobileLayout?: boolean;
  cartCount: number;
  cartLabel?: string;
  currentBuyer?: BuyerAccount | null;
  hasSavedBuyerInfo?: boolean;
  activePage?: StorefrontViewPage;
  onNavigatePage?: (page: StorefrontViewPage) => void;
  desktopNav?: ReactNode;
  onToggle: () => void;
  onClose: () => void;
  onOpenBuyerAuth?: () => void;
  onOpenBuyerAccount?: () => void;
  onOpenTrackOrder?: () => void;
  onOpenCart?: () => void;
}

export function StorefrontHeader({
  store,
  theme,
  isOpen,
  isPreview = false,
  isMobileLayout = false,
  cartCount,
  cartLabel = 'Shopping Bag',
  currentBuyer,
  hasSavedBuyerInfo = false,
  activePage = 'home',
  onNavigatePage,
  desktopNav,
  onToggle,
  onClose,
  onOpenBuyerAuth,
  onOpenBuyerAccount,
  onOpenTrackOrder,
  onOpenCart,
}: StorefrontHeaderProps) {
  const { getBuyerCheckoutInfo } = useStore();
  const savedCheckoutInfo = currentBuyer ? getBuyerCheckoutInfo() : null;
  const resolvedHasSavedInfo =
    Boolean(currentBuyer) &&
    (hasSavedBuyerInfo ||
      Boolean(
        savedCheckoutInfo &&
          (savedCheckoutInfo.fullName.trim() ||
            savedCheckoutInfo.phoneNumber.trim() ||
            savedCheckoutInfo.deliveryAddress.trim())
      ));

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const drawerNode = (
    <StorefrontNavDrawer
      store={store}
      theme={theme}
      isOpen={isOpen}
      isPreview={isPreview}
      cartCount={cartCount}
      cartLabel={cartLabel}
      currentBuyer={currentBuyer}
      hasSavedBuyerInfo={resolvedHasSavedInfo}
      activePage={activePage}
      onNavigatePage={onNavigatePage}
      onClose={onClose}
      onOpenBuyerAuth={onOpenBuyerAuth}
      onOpenBuyerAccount={onOpenBuyerAccount}
      onOpenTrackOrder={onOpenTrackOrder}
      onOpenCart={onOpenCart}
    />
  );

  return (
    <>
      <header
        className={`${
          isPreview ? 'relative' : 'fixed top-0 inset-x-0'
        } z-30 border-b px-4 sm:px-8 h-16 flex items-center justify-between gap-4`}
        style={{
          backgroundColor: theme.canvasBg,
          borderColor: theme.borderColor,
        }}
      >
        {onNavigatePage ? (
          <button
            type="button"
            onClick={() => onNavigatePage('home')}
            className="min-w-0 text-left cursor-pointer hover:opacity-85 transition-opacity"
          >
            <TemplateBrandMark store={store} theme={theme} />
          </button>
        ) : (
          <TemplateBrandMark store={store} theme={theme} />
        )}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {desktopNav}
          {onNavigatePage && !isMobileLayout && (
            <>
              <button
                type="button"
                onClick={() =>
                  onNavigatePage(activePage === 'products' ? 'home' : 'products')
                }
                className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 whitespace-nowrap cursor-pointer"
                style={{
                  color:
                    activePage === 'products' ? theme.accentTextColor : theme.textMuted,
                }}
              >
                {activePage === 'products' ? 'Store Home' : 'View all products'}
              </button>
              {currentBuyer && (
                <button
                  type="button"
                  onClick={() =>
                    onNavigatePage(activePage === 'info-settings' ? 'home' : 'info-settings')
                  }
                  className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 whitespace-nowrap cursor-pointer"
                  style={{
                    color:
                      activePage === 'info-settings' ? theme.accentTextColor : theme.textMuted,
                  }}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>Information Settings</span>
                </button>
              )}
            </>
          )}
          <StorefrontBurgerButton theme={theme} isOpen={isOpen} onClick={onToggle} />
        </div>

        {/* In preview frame, keep drawer anchored inside preview header */}
        {isPreview && drawerNode}
      </header>

      {/* Spacer matching fixed header height in live storefront mode */}
      {!isPreview && <div className="h-16 shrink-0" aria-hidden="true" />}

      {/* Dimmed Backdrop Overlay (z-20 below z-30 header so header stays crisp and un-dimmed) */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`${
          isPreview ? 'absolute' : 'fixed'
        } inset-0 z-20 bg-slate-950/40 touch-none transition-opacity duration-300 ease-out ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* In live storefront mode, render floating drawer fixed to viewport like LandingNavbar */}
      {!isPreview && drawerNode}
    </>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  theme: ResolvedThemeTokens;
}

export function TemplateSearchInput({
  value,
  onChange,
  placeholder = 'Search products...',
  theme,
}: SearchInputProps) {
  return (
    <div className="relative w-full sm:w-64 shrink-0">
      <Search
        className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: theme.textMuted }}
      />
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full min-h-[38px] pl-9 pr-3 py-1.5 text-xs border focus:outline-none focus:ring-2 ${theme.chipRadiusClass}`}
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.borderColor,
          color: theme.textPrimary,
        }}
      />
    </div>
  );
}

interface TemplateFooterProps {
  store: Store;
  theme: ResolvedThemeTokens;
  isMobileLayout: boolean;
}

export function TemplateFooter({ store, theme, isMobileLayout }: TemplateFooterProps) {
  const { socialLinks, address, contactNumber, bio } = store.branding;
  const trimmedBio = bio?.trim() ?? '';
  const trimmedAddress = address?.trim() ?? '';
  const trimmedPhone = contactNumber?.trim() ?? '';
  const footerName = store.name?.trim() || store.branding.logoText?.trim() || 'Your Store';
  const footerDomain = store.slug ? store.domainUrl : 'mystore.com/your-store';
  const socials = [
    socialLinks.instagram?.trim()
      ? { label: 'Instagram', value: socialLinks.instagram.trim() }
      : null,
    socialLinks.facebook?.trim()
      ? { label: 'Facebook', value: socialLinks.facebook.trim() }
      : null,
    socialLinks.tiktok?.trim() ? { label: 'TikTok', value: socialLinks.tiktok.trim() } : null,
    socialLinks.website?.trim() ? { label: 'Website', value: socialLinks.website.trim() } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <footer
      className="border-t mt-12 px-5 sm:px-8 py-10"
      style={{
        backgroundColor: theme.subtleBg,
        borderColor: theme.borderColor,
        color: theme.textPrimary,
      }}
    >
      <div
        className={`max-w-6xl mx-auto grid gap-8 ${
          isMobileLayout ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'
        }`}
      >
        <div className="space-y-3">
          <TemplateBrandMark store={store} theme={theme} />
          {trimmedBio && (
            <p className="text-xs leading-relaxed max-w-xs" style={{ color: theme.textMuted }}>
              {trimmedBio}
            </p>
          )}
          <p className="text-[11px] font-mono" style={{ color: theme.textMuted }}>
            {footerDomain}
          </p>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold tracking-wide" style={{ color: theme.textPrimary }}>
            Visit &amp; Contact
          </h4>
          {trimmedAddress && (
            <p className="text-xs flex items-start gap-2" style={{ color: theme.textMuted }}>
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{trimmedAddress}</span>
            </p>
          )}
          {trimmedPhone && (
            <p
              className="text-xs flex items-center gap-2 tabular-nums"
              style={{ color: theme.textMuted }}
            >
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span>{trimmedPhone}</span>
            </p>
          )}
          {!trimmedAddress && !trimmedPhone && (
            <p className="text-xs" style={{ color: theme.textMuted }}>
              No contact details added yet.
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold tracking-wide" style={{ color: theme.textPrimary }}>
            Follow Us
          </h4>
          {socials.length > 0 ? (
            <ul className="space-y-1.5 text-xs" style={{ color: theme.textMuted }}>
              {socials.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: theme.textPrimary }}>
                    {item.label}:
                  </span>
                  <span className="truncate">{item.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs" style={{ color: theme.textMuted }}>
              No social links added yet.
            </p>
          )}
        </div>
      </div>

      <div
        className="max-w-6xl mx-auto mt-8 pt-5 border-t flex flex-wrap items-center justify-between gap-2 text-[11px]"
        style={{ borderColor: theme.borderColor, color: theme.textMuted }}
      >
        <span>&copy; {new Date().getFullYear()} {footerName}</span>
        <span>Powered by mystore</span>
      </div>
    </footer>
  );
}

interface ViewAllProductsCtaProps {
  theme: ResolvedThemeTokens;
  totalCount: number;
  onClick: () => void;
}

export function ViewAllProductsCta({
  theme,
  totalCount,
  onClick,
}: ViewAllProductsCtaProps) {
  return (
    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t" style={{ borderColor: theme.borderColor }}>
      <p className="text-xs tabular-nums pt-2 sm:pt-0" style={{ color: theme.textMuted }}>
        Showing {Math.min(3, totalCount)} featured of {totalCount} available{' '}
        {totalCount === 1 ? 'product' : 'products'}
      </p>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2.5 text-xs sm:text-sm font-semibold border transition-opacity hover:opacity-90 cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
        style={{
          backgroundColor: theme.primaryColor,
          color: theme.onPrimaryText,
          borderColor: theme.primaryColor,
        }}
      >
        <span>View all products</span>
        <ArrowRight className="w-4 h-4 shrink-0" />
      </button>
    </div>
  );
}

interface StorefrontAllProductsHeaderProps {
  storeName: string;
  totalCount: number;
  theme: ResolvedThemeTokens;
  onBackHome: () => void;
}

export function StorefrontAllProductsHeader({
  storeName,
  totalCount,
  theme,
  onBackHome,
}: StorefrontAllProductsHeaderProps) {
  return (
    <div
      className="border-b pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      style={{ borderColor: theme.borderColor }}
    >
      <div className="space-y-2">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 cursor-pointer"
          style={{ color: theme.accentTextColor }}
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Back to {storeName} Home</span>
        </button>
        <h1
          className="text-2xl sm:text-3xl font-bold tracking-tight"
          style={{ fontFamily: theme.headingFontFamily, color: theme.textPrimary }}
        >
          All Products
        </h1>
        <p className="text-xs sm:text-sm tabular-nums" style={{ color: theme.textMuted }}>
          Browse all {totalCount} available {totalCount === 1 ? 'item' : 'items'} in {storeName}
        </p>
      </div>
    </div>
  );
}

interface StorefrontProductPaginationProps {
  theme: ResolvedThemeTokens;
  page: number;
  totalPages: number;
  totalItems: number;
  startItem: number;
  endItem: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function StorefrontProductPagination({
  theme,
  page,
  totalPages,
  totalItems,
  startItem,
  endItem,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: StorefrontProductPaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div
      className="mt-2 pt-4 border-t flex flex-wrap items-center justify-between gap-3"
      style={{ borderColor: theme.borderColor }}
    >
      <p className="text-xs tabular-nums" style={{ color: theme.textMuted }}>
        Showing{' '}
        <span className="font-semibold" style={{ color: theme.textPrimary }}>
          {startItem}–{endItem}
        </span>{' '}
        of{' '}
        <span className="font-semibold" style={{ color: theme.textPrimary }}>
          {totalItems}
        </span>{' '}
        products
        <span className="mx-1.5 opacity-50">·</span>
        Page {page}/{totalPages}
      </p>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Previous products page"
          className={`inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 text-xs font-semibold border transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.borderColor,
            color: theme.textPrimary,
          }}
        >
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Previous</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next products page"
          className={`inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 text-xs font-semibold border transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${theme.buttonRadiusClass}`}
          style={{
            backgroundColor: theme.primaryColor,
            borderColor: theme.primaryColor,
            color: theme.onPrimaryText,
          }}
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
}
