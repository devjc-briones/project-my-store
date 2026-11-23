import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Edit3,
  FileText,
  Landmark,
  Lock,
  MapPin,
  Phone,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import {
  StorefrontHeader,
  TemplateAnnouncementBar,
  TemplateFooter,
} from '../../templates/TemplateChrome';
import {
  StorefrontViewPage,
  resolveThemeTokens,
} from '../../templates/templateTypes';
import {
  BuyerAccount,
  IndustryTemplateId,
  PreferredCheckoutPaymentKey,
  Store,
} from '../../types/schema';

interface StorefrontInformationSettingsPageProps {
  store: Store;
  viewport?: 'desktop' | 'mobile';
  isPreview?: boolean;
  cartCount?: number;
  currentBuyer?: BuyerAccount | null;
  activePage: StorefrontViewPage;
  onNavigatePage: (page: StorefrontViewPage) => void;
  onOpenCart?: () => void;
  onOpenTrackOrder?: () => void;
  onOpenBuyerAuth?: () => void;
  onOpenBuyerAccount?: () => void;
}

const TEMPLATE_CART_LABELS: Record<IndustryTemplateId, string> = {
  'food-restaurant': 'Order Bag',
  'cafe-drinks': 'Cup Order',
  'clothing-apparel': 'Garment Bag',
  'footwear-shoes': 'Rotation Bag',
  'gadgets-accessories': 'Shopping Cart',
  'food-bistro-pro': 'Table Order',
  'cafe-atelier-pro': 'Atelier Bag',
  'clothing-editorial-pro': 'Atelier Bag',
  'footwear-studio-pro': 'Vault Bag',
  'gadgets-flagship-pro': 'Hardware Bag',
};

const PAYMENT_PREFERENCE_OPTIONS: {
  key: PreferredCheckoutPaymentKey | '';
  label: string;
  description: string;
  icon: typeof Smartphone;
}[] = [
  {
    key: '',
    label: 'Choose at checkout',
    description: 'Use the store default payment method',
    icon: SlidersHorizontal,
  },
  {
    key: 'gcash',
    label: 'GCash',
    description: 'Prefer GCash QR / e-wallet transfer',
    icon: Smartphone,
  },
  {
    key: 'maya',
    label: 'Maya',
    description: 'Prefer Maya QR / wallet transfer',
    icon: Smartphone,
  },
  {
    key: 'bank',
    label: 'Bank Transfer',
    description: 'Prefer InstaPay / PESONet bank transfer',
    icon: Landmark,
  },
  {
    key: 'cod',
    label: 'Cash on Delivery (COD)',
    description: 'Prefer paying cash upon courier arrival',
    icon: Banknote,
  },
];

interface FieldErrors {
  fullName?: string;
  phoneNumber?: string;
  deliveryAddress?: string;
}

export function StorefrontInformationSettingsPage({
  store,
  viewport = 'desktop',
  isPreview = false,
  cartCount = 0,
  currentBuyer,
  activePage,
  onNavigatePage,
  onOpenCart,
  onOpenTrackOrder,
  onOpenBuyerAuth,
  onOpenBuyerAccount,
}: StorefrontInformationSettingsPageProps) {
  const {
    state,
    getBuyerCheckoutInfo,
    saveBuyerCheckoutInfo,
    clearBuyerCheckoutInfo,
    getPaymentSettings,
    pushToast,
  } = useStore();

  const theme = resolveThemeTokens(store.branding, store.templateId);
  const isMobile = viewport === 'mobile';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useBodyScrollLock(mobileMenuOpen && !isPreview);

  const activeBuyer = currentBuyer ?? state.currentBuyer;
  const savedInfo = activeBuyer ? getBuyerCheckoutInfo() : null;
  const hasSavedInfo = Boolean(
    activeBuyer &&
      savedInfo &&
      (savedInfo.fullName.trim() ||
        savedInfo.phoneNumber.trim() ||
        savedInfo.deliveryAddress.trim())
  );

  const paymentSettings = getPaymentSettings(store.id);
  const enabledStorePaymentKeys = useMemo(() => {
    const keys = new Set<PreferredCheckoutPaymentKey>();
    if (paymentSettings.gcashEnabled) keys.add('gcash');
    if (paymentSettings.mayaEnabled) keys.add('maya');
    if (paymentSettings.bankTransferEnabled) keys.add('bank');
    if (paymentSettings.codEnabled) keys.add('cod');
    return keys;
  }, [paymentSettings]);

  const [isEditing, setIsEditing] = useState(!hasSavedInfo);
  const [fullName, setFullName] = useState(savedInfo?.fullName ?? currentBuyer?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(savedInfo?.phoneNumber ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState(savedInfo?.deliveryAddress ?? '');
  const [notes, setNotes] = useState(savedInfo?.notes ?? '');
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<
    PreferredCheckoutPaymentKey | ''
  >(savedInfo?.preferredPaymentMethod ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    setFullName(savedInfo?.fullName ?? currentBuyer?.name ?? '');
    setPhoneNumber(savedInfo?.phoneNumber ?? '');
    setDeliveryAddress(savedInfo?.deliveryAddress ?? '');
    setNotes(savedInfo?.notes ?? '');
    setPreferredPaymentMethod(savedInfo?.preferredPaymentMethod ?? '');
    setIsEditing(!hasSavedInfo);
    setErrors({});
  }, [
    savedInfo?.updatedAt,
    savedInfo?.fullName,
    savedInfo?.phoneNumber,
    savedInfo?.deliveryAddress,
    savedInfo?.notes,
    savedInfo?.preferredPaymentMethod,
    currentBuyer?.id,
    currentBuyer?.name,
    hasSavedInfo,
  ]);

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBuyer) {
      onOpenBuyerAuth?.();
      return;
    }
    const nextErrors: FieldErrors = {};

    if (fullName.trim().length < 2) {
      nextErrors.fullName = 'Please enter your full name.';
    }
    if (phoneNumber.trim().length < 7) {
      nextErrors.phoneNumber = 'Please enter a valid contact phone number.';
    }
    if (deliveryAddress.trim().length < 5) {
      nextErrors.deliveryAddress = 'Please enter your complete delivery address.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    saveBuyerCheckoutInfo({
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      deliveryAddress: deliveryAddress.trim(),
      notes: notes.trim() || undefined,
      preferredPaymentMethod: preferredPaymentMethod || undefined,
    });

    setIsEditing(false);
    pushToast({
      type: 'success',
      title: 'Information Settings Saved',
      description: 'Your checkout fields will auto-fill automatically on your next order.',
    });
  };

  const handleCancelEdit = () => {
    setFullName(savedInfo?.fullName ?? currentBuyer?.name ?? '');
    setPhoneNumber(savedInfo?.phoneNumber ?? '');
    setDeliveryAddress(savedInfo?.deliveryAddress ?? '');
    setNotes(savedInfo?.notes ?? '');
    setPreferredPaymentMethod(savedInfo?.preferredPaymentMethod ?? '');
    setErrors({});
    setIsEditing(false);
  };

  const handleClearSaved = () => {
    clearBuyerCheckoutInfo();
    setFullName(currentBuyer?.name ?? '');
    setPhoneNumber('');
    setDeliveryAddress('');
    setNotes('');
    setPreferredPaymentMethod('');
    setErrors({});
    setIsEditing(true);
    pushToast({
      type: 'info',
      title: 'Saved Information Cleared',
      description: 'You can enter fresh checkout details anytime.',
    });
  };

  const preferredMethodMeta = PAYMENT_PREFERENCE_OPTIONS.find(
    (opt) => opt.key === (savedInfo?.preferredPaymentMethod ?? '')
  );

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
        cartCount={cartCount}
        cartLabel={TEMPLATE_CART_LABELS[store.templateId] ?? 'Shopping Bag'}
        currentBuyer={currentBuyer}
        hasSavedBuyerInfo={hasSavedInfo}
        activePage={activePage}
        onNavigatePage={onNavigatePage}
        onToggle={() => setMobileMenuOpen((prev) => !prev)}
        onClose={() => setMobileMenuOpen(false)}
        onOpenBuyerAuth={onOpenBuyerAuth}
        onOpenBuyerAccount={onOpenBuyerAccount}
        onOpenTrackOrder={onOpenTrackOrder}
        onOpenCart={onOpenCart}
      />

      <TemplateAnnouncementBar store={store} theme={theme} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6">
        {/* Page Header */}
        <div
          className="border-b pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
          style={{ borderColor: theme.borderColor }}
        >
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onNavigatePage('home')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 cursor-pointer"
              style={{ color: theme.accentTextColor }}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Back to {store.name} Home</span>
            </button>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ fontFamily: theme.headingFontFamily, color: theme.textPrimary }}
            >
              Information Settings
            </h1>
            <p className="text-xs sm:text-sm max-w-xl" style={{ color: theme.textMuted }}>
              Set your delivery and contact details once. Whenever you check out, all saved
              information will auto-fill automatically.
            </p>
          </div>

          {activeBuyer && hasSavedInfo && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 border text-xs font-semibold shrink-0 ${theme.chipRadiusClass}`}
              style={{
                backgroundColor: theme.subtleBg,
                borderColor: theme.borderColor,
                color: theme.accentTextColor,
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Auto-Fill Active</span>
            </div>
          )}
        </div>

        {/* Signed-In Gate vs Saved Summary View vs Editable Form */}
        {!activeBuyer ? (
          <section
            className="rounded-2xl border p-6 sm:p-8 text-center space-y-4"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border"
              style={{
                backgroundColor: theme.subtleBg,
                borderColor: theme.borderColor,
                color: theme.accentTextColor,
              }}
            >
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h2
                className="text-lg font-bold"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                Sign in required
              </h2>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.textMuted }}>
                Information Settings is available for signed-in accounts. Sign in to save and
                edit your checkout details for automatic fill.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              {onOpenBuyerAuth && (
                <button
                  type="button"
                  onClick={onOpenBuyerAuth}
                  className={`inline-flex items-center gap-2 min-h-[42px] px-5 py-2 text-xs sm:text-sm font-semibold cursor-pointer hover:opacity-90 ${theme.buttonRadiusClass}`}
                  style={{
                    backgroundColor: theme.primaryColor,
                    color: theme.onPrimaryText,
                  }}
                >
                  <User className="w-4 h-4" />
                  <span>Sign In / Sign Up</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigatePage('home')}
                className={`min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold border cursor-pointer hover:opacity-85 ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.canvasBg,
                  borderColor: theme.borderColor,
                  color: theme.textPrimary,
                }}
              >
                Back to {store.name}
              </button>
            </div>
          </section>
        ) : hasSavedInfo && !isEditing && savedInfo ? (
          <section
            className="rounded-2xl border p-5 sm:p-6 space-y-5"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0" style={{ color: theme.accentTextColor }} />
                  <h2
                    className="text-base sm:text-lg font-bold"
                    style={{ fontFamily: theme.headingFontFamily }}
                  >
                    Saved Checkout Information
                  </h2>
                </div>
                <p className="text-xs" style={{ color: theme.textMuted }}>
                  Last updated:{' '}
                  {new Date(savedInfo.updatedAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-semibold border cursor-pointer transition-opacity hover:opacity-85 ${theme.buttonRadiusClass}`}
                  style={{
                    backgroundColor: theme.primaryColor,
                    borderColor: theme.primaryColor,
                    color: theme.onPrimaryText,
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Information</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSaved}
                  aria-label="Clear saved information"
                  className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold border cursor-pointer transition-opacity hover:opacity-80 ${theme.buttonRadiusClass}`}
                  style={{
                    backgroundColor: theme.canvasBg,
                    borderColor: theme.borderColor,
                    color: theme.textMuted,
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div
                className="p-3.5 rounded-xl border space-y-1"
                style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
              >
                <p
                  className="text-[11px] font-semibold flex items-center gap-1.5"
                  style={{ color: theme.textMuted }}
                >
                  <User className="w-3.5 h-3.5" style={{ color: theme.accentTextColor }} />
                  <span>Full Name</span>
                </p>
                <p className="text-sm font-semibold">{savedInfo.fullName}</p>
              </div>

              <div
                className="p-3.5 rounded-xl border space-y-1"
                style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
              >
                <p
                  className="text-[11px] font-semibold flex items-center gap-1.5"
                  style={{ color: theme.textMuted }}
                >
                  <Phone className="w-3.5 h-3.5" style={{ color: theme.accentTextColor }} />
                  <span>Phone Number</span>
                </p>
                <p className="text-sm font-mono font-semibold tabular-nums">
                  {savedInfo.phoneNumber}
                </p>
              </div>

              <div
                className="p-3.5 rounded-xl border space-y-1 sm:col-span-2"
                style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
              >
                <p
                  className="text-[11px] font-semibold flex items-center gap-1.5"
                  style={{ color: theme.textMuted }}
                >
                  <MapPin className="w-3.5 h-3.5" style={{ color: theme.accentTextColor }} />
                  <span>Delivery Address</span>
                </p>
                <p className="text-sm font-medium leading-relaxed">{savedInfo.deliveryAddress}</p>
              </div>

              <div
                className="p-3.5 rounded-xl border space-y-1"
                style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
              >
                <p
                  className="text-[11px] font-semibold flex items-center gap-1.5"
                  style={{ color: theme.textMuted }}
                >
                  <FileText className="w-3.5 h-3.5" style={{ color: theme.accentTextColor }} />
                  <span>Default Order Notes</span>
                </p>
                <p className="text-xs leading-relaxed" style={{ color: savedInfo.notes ? theme.textPrimary : theme.textMuted }}>
                  {savedInfo.notes || 'None set'}
                </p>
              </div>

              <div
                className="p-3.5 rounded-xl border space-y-1"
                style={{ backgroundColor: theme.subtleBg, borderColor: theme.borderColor }}
              >
                <p
                  className="text-[11px] font-semibold flex items-center gap-1.5"
                  style={{ color: theme.textMuted }}
                >
                  <Banknote className="w-3.5 h-3.5" style={{ color: theme.accentTextColor }} />
                  <span>Preferred Payment Method</span>
                </p>
                <p className="text-xs font-semibold">
                  {preferredMethodMeta?.label ?? 'Choose at checkout'}
                </p>
                {savedInfo.preferredPaymentMethod &&
                  !enabledStorePaymentKeys.has(savedInfo.preferredPaymentMethod) && (
                    <p className="text-[11px]" style={{ color: theme.textMuted }}>
                      Note: {store.name} currently uses its enabled store payment options at
                      checkout.
                    </p>
                  )}
              </div>
            </div>

            <div
              className="pt-4 border-t flex flex-wrap items-center justify-between gap-3"
              style={{ borderColor: theme.borderColor }}
            >
              <button
                type="button"
                onClick={() => onNavigatePage('products')}
                className={`min-h-[40px] px-4 py-2 text-xs font-semibold border cursor-pointer hover:opacity-85 ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.canvasBg,
                  borderColor: theme.borderColor,
                  color: theme.textPrimary,
                }}
              >
                Browse All Products
              </button>

              {cartCount > 0 && onOpenCart && (
                <button
                  type="button"
                  onClick={onOpenCart}
                  className={`inline-flex items-center gap-2 min-h-[40px] px-5 py-2 text-xs font-semibold cursor-pointer hover:opacity-90 ${theme.buttonRadiusClass}`}
                  style={{
                    backgroundColor: theme.primaryColor,
                    color: theme.onPrimaryText,
                  }}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Go to Checkout ({cartCount})</span>
                </button>
              )}
            </div>
          </section>
        ) : (
          <form
            onSubmit={handleSaveSubmit}
            noValidate
            className="rounded-2xl border p-5 sm:p-6 space-y-5"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.borderColor,
            }}
          >
            <div className="space-y-1">
              <h2
                className="text-base sm:text-lg font-bold"
                style={{ fontFamily: theme.headingFontFamily }}
              >
                {hasSavedInfo ? 'Edit Checkout Information' : 'Set Your Checkout Information'}
              </h2>
              <p className="text-xs" style={{ color: theme.textMuted }}>
                All required details below match what is asked during checkout so your order forms
                fill in automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="buyer-info-fullname" className="block text-xs font-semibold">
                  Full Name
                </label>
                <input
                  id="buyer-info-fullname"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                  }}
                  placeholder="Juan Dela Cruz"
                  aria-invalid={Boolean(errors.fullName)}
                  className={`w-full min-h-[42px] px-3 py-2 text-sm border rounded-xl outline-none transition-all ${
                    errors.fullName ? 'ring-4 ring-rose-500/20' : 'focus:ring-2'
                  }`}
                  style={{
                    backgroundColor: theme.canvasBg,
                    borderColor: errors.fullName ? '#f43f5e' : theme.borderColor,
                    color: theme.textPrimary,
                  }}
                />
                {errors.fullName && (
                  <p className={`text-xs font-medium ${theme.isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="buyer-info-phone" className="block text-xs font-semibold">
                  Phone Number
                </label>
                <input
                  id="buyer-info-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (errors.phoneNumber) {
                      setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                    }
                  }}
                  placeholder="0917 555 0123"
                  aria-invalid={Boolean(errors.phoneNumber)}
                  className={`w-full min-h-[42px] px-3 py-2 text-sm font-mono border rounded-xl outline-none transition-all ${
                    errors.phoneNumber ? 'ring-4 ring-rose-500/20' : 'focus:ring-2'
                  }`}
                  style={{
                    backgroundColor: theme.canvasBg,
                    borderColor: errors.phoneNumber ? '#f43f5e' : theme.borderColor,
                    color: theme.textPrimary,
                  }}
                />
                {errors.phoneNumber && (
                  <p className={`text-xs font-medium ${theme.isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                    {errors.phoneNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="buyer-info-address" className="block text-xs font-semibold">
                Delivery Address
              </label>
              <textarea
                id="buyer-info-address"
                rows={2}
                value={deliveryAddress}
                onChange={(e) => {
                  setDeliveryAddress(e.target.value);
                  if (errors.deliveryAddress) {
                    setErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
                  }
                }}
                placeholder="Street, Barangay, City, Landmark"
                aria-invalid={Boolean(errors.deliveryAddress)}
                className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none transition-all resize-none ${
                  errors.deliveryAddress ? 'ring-4 ring-rose-500/20' : 'focus:ring-2'
                }`}
                style={{
                  backgroundColor: theme.canvasBg,
                  borderColor: errors.deliveryAddress ? '#f43f5e' : theme.borderColor,
                  color: theme.textPrimary,
                }}
              />
              {errors.deliveryAddress && (
                <p className={`text-xs font-medium ${theme.isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                  {errors.deliveryAddress}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="buyer-info-notes" className="block text-xs font-semibold">
                Default Order Notes <span style={{ color: theme.textMuted }}>(Optional)</span>
              </label>
              <textarea
                id="buyer-info-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Delivery gate code, utensils, landmark instructions..."
                className="w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 resize-y"
                style={{
                  backgroundColor: theme.canvasBg,
                  borderColor: theme.borderColor,
                  color: theme.textPrimary,
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold">
                Preferred Payment Method <span style={{ color: theme.textMuted }}>(Optional)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PAYMENT_PREFERENCE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = preferredPaymentMethod === opt.key;
                  return (
                    <button
                      key={opt.key || 'default'}
                      type="button"
                      onClick={() => setPreferredPaymentMethod(opt.key)}
                      className="p-3 rounded-xl border text-left flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                      style={
                        active
                          ? {
                              borderColor: theme.primaryColor,
                              backgroundColor: theme.subtleBg,
                            }
                          : {
                              borderColor: theme.borderColor,
                              backgroundColor: theme.canvasBg,
                            }
                      }
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" style={{ color: theme.accentTextColor }} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{opt.label}</p>
                          <p className="text-[11px] truncate" style={{ color: theme.textMuted }}>
                            {opt.description}
                          </p>
                        </div>
                      </div>
                      <span
                        className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                        style={{
                          borderColor: active ? theme.primaryColor : theme.borderColor,
                        }}
                      >
                        {active && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: theme.primaryColor }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="pt-4 border-t flex flex-wrap items-center justify-end gap-2.5"
              style={{ borderColor: theme.borderColor }}
            >
              {hasSavedInfo && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className={`min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold border cursor-pointer hover:opacity-85 ${theme.buttonRadiusClass}`}
                  style={{
                    backgroundColor: theme.canvasBg,
                    borderColor: theme.borderColor,
                    color: theme.textPrimary,
                  }}
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                className={`min-h-[42px] px-6 py-2 text-xs sm:text-sm font-semibold cursor-pointer hover:opacity-90 ${theme.buttonRadiusClass}`}
                style={{
                  backgroundColor: theme.primaryColor,
                  color: theme.onPrimaryText,
                }}
              >
                {hasSavedInfo ? 'Save Changes' : 'Save Information'}
              </button>
            </div>
          </form>
        )}
      </main>

      <TemplateFooter store={store} theme={theme} isMobileLayout={isMobile} />
    </div>
  );
}
