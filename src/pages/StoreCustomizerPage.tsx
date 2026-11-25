import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Crown,
  Globe,
  Image as ImageIcon,
  LayoutTemplate,
  Lock,
  Monitor,
  Palette,
  Phone,
  Save,
  Smartphone,
  Sparkles,
  Store as StoreIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getPlanLimits } from '../data/plans';
import {
  FREE_TEMPLATE_LIST,
  INDUSTRY_TEMPLATES,
  INDUSTRY_TEMPLATE_LIST,
  PRO_TEMPLATE_LIST,
  isProTemplate,
} from '../data/templates';
import { TEMPLATE_SHOWCASE_MEDIA } from '../data/templateVisuals';
import { TEMPLATE_IMAGE_ASSETS } from '../data/templateAssets';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { StorefrontRenderer } from '../templates/StorefrontRenderer';
import {
  BackgroundMode,
  ButtonStyle,
  FontPairingId,
  IndustryTemplateId,
  Roles,
  Store,
  StoreBranding,
} from '../types/schema';
import {
  buildStoreDomainUrl,
  generateUniqueStoreSlug,
  slugifyStoreName,
  validateStoreSlug,
} from '../utils/domain';

type CustomizerSectionId = 'template' | 'basic' | 'assets' | 'theme' | 'contact';

const CUSTOMIZER_SECTIONS: Array<{
  id: CustomizerSectionId;
  shortLabel: string;
  fullTitle: string;
  subtitle: string;
  icon: typeof LayoutTemplate;
}> = [
  {
    id: 'template',
    shortLabel: 'Template',
    fullTitle: 'Industry Template',
    subtitle: '10 storefront layouts (5 Free + 5 Pro)',
    icon: LayoutTemplate,
  },
  {
    id: 'basic',
    shortLabel: 'Info',
    fullTitle: 'Basic Info & Store URL',
    subtitle: 'Store name, URL slug, bio & announcement bar',
    icon: StoreIcon,
  },
  {
    id: 'assets',
    shortLabel: 'Branding',
    fullTitle: 'Branding Assets & Hero',
    subtitle: 'Logo, hero banner, headline & subheadline',
    icon: ImageIcon,
  },
  {
    id: 'theme',
    shortLabel: 'Theme',
    fullTitle: 'Theme & Styling',
    subtitle: 'Brand colors, canvas mode, buttons & fonts',
    icon: Palette,
  },
  {
    id: 'contact',
    shortLabel: 'Contact',
    fullTitle: 'Contact & Footer Info',
    subtitle: 'Address, phone & social media links',
    icon: Phone,
  },
];

const CURATED_PALETTES = [
  { name: 'Crimson Kitchen', primary: '#B91C1C', accent: '#D97706' },
  { name: 'Espresso Roast', primary: '#3F2E21', accent: '#7C4D2B' },
  { name: 'Obsidian Ink', primary: '#111827', accent: '#334155' },
  { name: 'Electric Cobalt', primary: '#2563EB', accent: '#3B82F6' },
  { name: 'Runner Orange', primary: '#EA580C', accent: '#09090B' },
  { name: 'Emerald Craft', primary: '#047857', accent: '#065F46' },
];

const BACKGROUND_MODES: Array<{ id: BackgroundMode; label: string; swatch: string }> = [
  { id: 'light', label: 'Light', swatch: '#FFFFFF' },
  { id: 'cream', label: 'Soft Cream', swatch: '#FAF8F5' },
  { id: 'dark', label: 'Dark', swatch: '#0B1120' },
];

const BUTTON_STYLES: Array<{ id: ButtonStyle; label: string; previewClass: string }> = [
  { id: 'rounded', label: 'Rounded', previewClass: 'rounded-xl' },
  { id: 'pill', label: 'Pill', previewClass: 'rounded-full' },
  { id: 'sharp', label: 'Sharp', previewClass: 'rounded-none' },
];

const FONT_PAIRINGS: Array<{ id: FontPairingId; label: string; sample: string; fontFamily: string }> = [
  {
    id: 'modern-sans',
    label: 'Modern Sans',
    sample: 'Plus Jakarta + DM Sans',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  {
    id: 'editorial-serif',
    label: 'Editorial Serif',
    sample: 'Playfair Display + Sans',
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  {
    id: 'bold-display',
    label: 'Bold Display',
    sample: 'Oswald + DM Sans',
    fontFamily: "'Oswald', sans-serif",
  },
];

const PRESET_LOGOS = [
  { label: 'Monogram Badge', url: '' },
  {
    label: 'Kitchen Crest',
    url: TEMPLATE_IMAGE_ASSETS['food-restaurant'],
  },
  {
    label: 'Roastery Mark',
    url: TEMPLATE_IMAGE_ASSETS['cafe-drinks'],
  },
  {
    label: 'Studio Emblem',
    url: TEMPLATE_IMAGE_ASSETS['gadgets-accessories'],
  },
];

function isPresetLogoUrl(url?: string): boolean {
  return !url || PRESET_LOGOS.some((preset) => preset.url === url);
}

function isPresetBannerUrl(url?: string): boolean {
  return (
    !url ||
    INDUSTRY_TEMPLATE_LIST.some((tpl) => TEMPLATE_SHOWCASE_MEDIA[tpl.id].imageUrl === url)
  );
}

function createEmptyStoreBranding(templateId: IndustryTemplateId): StoreBranding {
  const {
    primaryColor,
    secondaryColor,
    accentColor,
    surfaceColor,
    textColor,
    backgroundMode,
    buttonStyle,
    fontPairing,
  } = INDUSTRY_TEMPLATES[templateId].defaultBranding;

  return {
    primaryColor,
    secondaryColor,
    accentColor,
    surfaceColor,
    textColor,
    backgroundMode,
    buttonStyle,
    fontPairing,
    logoText: '',
    logoImageUrl: undefined,
    heroTitle: '',
    heroSubtitle: '',
    heroCtaLabel: '',
    heroBannerUrl: undefined,
    bio: '',
    announcementEnabled: false,
    announcementText: '',
    address: '',
    contactNumber: '',
    socialLinks: {},
  };
}

function createDraftNewStore(
  templateId: IndustryTemplateId = 'food-restaurant',
  ownerId = ''
): Store {
  const now = new Date().toISOString();

  return {
    id: 'draft_new_store',
    ownerId,
    name: '',
    slug: '',
    domainUrl: buildStoreDomainUrl(''),
    templateId,
    status: 'draft',
    branding: createEmptyStoreBranding(templateId),
    createdAt: now,
    updatedAt: now,
  };
}

export function StoreCustomizerPage() {
  const {
    route,
    state,
    navigate,
    goBack,
    createStore,
    updateStoreMeta,
    getStoreProducts,
    getPaymentSettings,
    pushToast,
  } = useStore();

  const isCreateMode = route.name === 'store-create';
  const routeStoreId = route.name === 'store-customize' ? route.storeId : undefined;
  const existingStore = useMemo(
    () => (routeStoreId ? state.stores.find((s) => s.id === routeStoreId) : undefined),
    [routeStoreId, state.stores]
  );

  const existingSlugs = useMemo(() => state.stores.map((s) => s.slug), [state.stores]);

  const [draftStore, setDraftStore] = useState<Store>(() => {
    if (!isCreateMode && existingStore) {
      return existingStore;
    }
    return createDraftNewStore('food-restaurant', state.currentUser?.id ?? '');
  });

  const [slugTouched, setSlugTouched] = useState(!isCreateMode);
  const [hasCustomizedTheme, setHasCustomizedTheme] = useState(!isCreateMode);
  const [activeSection, setActiveSection] = useState<CustomizerSectionId>('template');
  const [mobileSheetSection, setMobileSheetSection] = useState<CustomizerSectionId | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(() => {
    const initialLogo = !isCreateMode && existingStore ? existingStore.branding.logoImageUrl : undefined;
    return initialLogo && !isPresetLogoUrl(initialLogo) ? initialLogo : null;
  });
  const [customBannerUrl, setCustomBannerUrl] = useState<string | null>(() => {
    const initialBanner =
      !isCreateMode && existingStore ? existingStore.branding.heroBannerUrl : undefined;
    return initialBanner && !isPresetBannerUrl(initialBanner) ? initialBanner : null;
  });

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const baselineViewportHeightRef = useRef<number>(
    typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 0
  );
  const viewportShrunkRef = useRef<boolean>(false);
  const blurTimeoutRef = useRef<number | null>(null);

  useBodyScrollLock(mobileSheetSection !== null);

  const closeMobileSheet = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    viewportShrunkRef.current = false;
    setIsKeyboardOpen(false);
    setMobileSheetSection(null);
  };

  // Sync draftStore if user navigates between two different existing stores or /store/new
  useEffect(() => {
    if (isCreateMode) {
      setDraftStore(
        createDraftNewStore('food-restaurant', state.currentUser?.id ?? '')
      );
      setSlugTouched(false);
      setHasCustomizedTheme(false);
      setActiveSection('template');
      setMobileSheetSection(null);
      setValidationError(null);
      setCustomLogoUrl(null);
      setCustomBannerUrl(null);
      return;
    }

    if (existingStore) {
      setDraftStore(existingStore);
      setSlugTouched(true);
      setHasCustomizedTheme(true);
      setMobileSheetSection(null);
      setValidationError(null);
      setCustomLogoUrl(
        existingStore.branding.logoImageUrl &&
          !isPresetLogoUrl(existingStore.branding.logoImageUrl)
          ? existingStore.branding.logoImageUrl
          : null
      );
      setCustomBannerUrl(
        existingStore.branding.heroBannerUrl &&
          !isPresetBannerUrl(existingStore.branding.heroBannerUrl)
          ? existingStore.branding.heroBannerUrl
          : null
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateMode, existingStore?.id]);

  // Close mobile bottom sheet on Escape key
  useEffect(() => {
    if (!mobileSheetSection) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMobileSheet();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileSheetSection]);

  // Ensure mobile sheet closes (and releases scroll lock) if resized to desktop lg: breakpoint
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        closeMobileSheet();
      }
    };
    mq.addEventListener('change', handleMediaChange);
    return () => mq.removeEventListener('change', handleMediaChange);
  }, []);

  // Hide mobile floating bottom nav while the virtual keyboard / text input is active
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const nonKeyboardTypes = new Set([
      'button',
      'submit',
      'reset',
      'checkbox',
      'radio',
      'file',
      'color',
      'range',
      'hidden',
      'image',
    ]);

    const isTextKeyboardTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.tagName === 'TEXTAREA') {
        const textarea = target as HTMLTextAreaElement;
        return !textarea.readOnly && !textarea.disabled;
      }
      if (target.tagName === 'INPUT') {
        const input = target as HTMLInputElement;
        if (input.readOnly || input.disabled) return false;
        return !nonKeyboardTypes.has((input.type || 'text').toLowerCase());
      }
      return target.isContentEditable;
    };

    const getViewportHeight = () => window.visualViewport?.height ?? window.innerHeight;

    const handleFocusIn = (e: FocusEvent) => {
      if (!isTextKeyboardTarget(e.target)) return;
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      setIsKeyboardOpen(true);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (isTextKeyboardTarget(e.target) && document.activeElement === e.target) {
        if (blurTimeoutRef.current !== null) {
          window.clearTimeout(blurTimeoutRef.current);
          blurTimeoutRef.current = null;
        }
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
      blurTimeoutRef.current = window.setTimeout(() => {
        blurTimeoutRef.current = null;
        const activeIsText = isTextKeyboardTarget(document.activeElement);
        const currentHeight = getViewportHeight();
        if (baselineViewportHeightRef.current - currentHeight < 90) {
          viewportShrunkRef.current = false;
        }
        if (!activeIsText && !viewportShrunkRef.current) {
          setIsKeyboardOpen(false);
        }
      }, 120);
    };

    const handleViewportResize = () => {
      const currentHeight = getViewportHeight();
      if (currentHeight > baselineViewportHeightRef.current) {
        baselineViewportHeightRef.current = currentHeight;
      }
      const heightDrop = baselineViewportHeightRef.current - currentHeight;

      if (heightDrop > 110) {
        viewportShrunkRef.current = true;
        setIsKeyboardOpen(true);
      } else if (viewportShrunkRef.current && heightDrop < 70) {
        viewportShrunkRef.current = false;
        setIsKeyboardOpen(false);
      } else if (!isTextKeyboardTarget(document.activeElement) && heightDrop < 70) {
        baselineViewportHeightRef.current = currentHeight;
        viewportShrunkRef.current = false;
        setIsKeyboardOpen(false);
      }
    };

    const handleOrientationChange = () => {
      window.setTimeout(() => {
        baselineViewportHeightRef.current = getViewportHeight();
        viewportShrunkRef.current = false;
        if (!isTextKeyboardTarget(document.activeElement)) {
          setIsKeyboardOpen(false);
        }
      }, 200);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleViewportResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  // Guard against invalid store ID in /store/:storeId/customize
  if (!isCreateMode && !existingStore) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-700">
            <StoreIcon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Store Not Found</h1>
          <p className="text-sm text-slate-600">
            The store you are trying to customize does not exist or has been removed.
          </p>
          <button
            type="button"
            onClick={() => navigate({ name: 'dashboard' })}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const storeProducts = useMemo(
    () => (existingStore ? getStoreProducts(existingStore.id) : []),
    [existingStore, getStoreProducts]
  );

  const currency = existingStore ? getPaymentSettings(existingStore.id).currency : 'PHP';

  const slugValidation = useMemo(
    () => validateStoreSlug(draftStore.slug, existingSlugs, existingStore?.slug),
    [draftStore.slug, existingSlugs, existingStore?.slug]
  );

  const planLimits = getPlanLimits(state.currentUser?.plan ?? 'starter');
  const ownerId = state.currentUser?.id ?? '';
  const ownerStoreCount = state.stores.filter((s) => s.ownerId === ownerId).length;
  if (isCreateMode && ownerStoreCount >= planLimits.maxStores) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Store Limit Reached</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your <strong>{planLimits.label}</strong> plan allows up to{' '}
            <strong>
              {planLimits.maxStores} active store{planLimits.maxStores === 1 ? '' : 's'}
            </strong>
            . Your existing stores stay safe—upgrade your plan to add more storefronts.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => navigate({ name: 'dashboard' })}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate({ name: 'upgrade-plan' })}
              className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  const updateBranding = (patch: Partial<StoreBranding>) => {
    setDraftStore((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        ...patch,
      },
    }));
  };

  const handleNameChange = (nextName: string) => {
    setValidationError(null);
    setDraftStore((prev) => {
      const nextSlug = slugTouched ? prev.slug : slugifyStoreName(nextName);

      return {
        ...prev,
        name: nextName,
        slug: nextSlug,
        domainUrl: buildStoreDomainUrl(nextSlug),
      };
    });
  };

  const handleSlugChange = (rawSlug: string) => {
    setValidationError(null);
    setSlugTouched(true);
    const cleaned = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-');
    setDraftStore((prev) => ({
      ...prev,
      slug: cleaned,
      domainUrl: buildStoreDomainUrl(cleaned),
    }));
  };

  const handleSelectTemplate = (templateId: IndustryTemplateId) => {
    const templateTheme = INDUSTRY_TEMPLATES[templateId].defaultBranding;

    setDraftStore((prev) => {
      if (isCreateMode && !hasCustomizedTheme) {
        return {
          ...prev,
          templateId,
          branding: {
            ...prev.branding,
            primaryColor: templateTheme.primaryColor,
            secondaryColor: templateTheme.secondaryColor,
            accentColor: templateTheme.accentColor,
            surfaceColor: templateTheme.surfaceColor,
            textColor: templateTheme.textColor,
            backgroundMode: templateTheme.backgroundMode,
            buttonStyle: templateTheme.buttonStyle,
            fontPairing: templateTheme.fontPairing,
          },
        };
      }
      return {
        ...prev,
        templateId,
      };
    });
  };

  const handleApplyTemplatePalette = () => {
    const templateMeta = INDUSTRY_TEMPLATES[draftStore.templateId];
    setHasCustomizedTheme(true);
    updateBranding({
      primaryColor: templateMeta.defaultBranding.primaryColor,
      secondaryColor: templateMeta.defaultBranding.secondaryColor,
      accentColor: templateMeta.defaultBranding.accentColor,
      surfaceColor: templateMeta.defaultBranding.surfaceColor,
      textColor: templateMeta.defaultBranding.textColor,
      backgroundMode: templateMeta.defaultBranding.backgroundMode,
      buttonStyle: templateMeta.defaultBranding.buttonStyle,
      fontPairing: templateMeta.defaultBranding.fontPairing,
    });
    pushToast({
      type: 'info',
      title: 'Template styling applied',
      description: `Loaded theme colors and typography for ${templateMeta.name}.`,
    });
  };

  const handleImageFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 'logo' | 'banner'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast({
        type: 'error',
        title: 'Unsupported file',
        description: 'Please choose a PNG, JPG, or WebP image file.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      if (target === 'logo') {
        setCustomLogoUrl(dataUrl);
        updateBranding({ logoImageUrl: dataUrl });
        pushToast({ type: 'success', title: 'Logo updated' });
      } else {
        setCustomBannerUrl(dataUrl);
        updateBranding({ heroBannerUrl: dataUrl });
        pushToast({ type: 'success', title: 'Hero banner updated' });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleBackgroundModeChange = (mode: BackgroundMode) => {
    const surfaceMap: Record<BackgroundMode, { surface: string; text: string }> = {
      light: { surface: '#FFFFFF', text: '#0F172A' },
      cream: { surface: '#FAF8F5', text: '#1C1917' },
      dark: { surface: '#0F172A', text: '#F8FAFC' },
    };
    setHasCustomizedTheme(true);
    updateBranding({
      backgroundMode: mode,
      surfaceColor: surfaceMap[mode].surface,
      textColor: surfaceMap[mode].text,
    });
  };

  const focusBasicSection = () => {
    setActiveSection('basic');
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileSheetSection('basic');
    }
  };

  const isProUser =
    state.currentUser?.plan === 'pro' || state.currentUser?.role === Roles.Admin;

  const focusTemplateSection = () => {
    setActiveSection('template');
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileSheetSection('template');
    }
  };

  const handleSaveChanges = async () => {
    if (isSaving) return;

    if (
      !isProUser &&
      isProTemplate(draftStore.templateId) &&
      (isCreateMode || existingStore?.templateId !== draftStore.templateId)
    ) {
      focusTemplateSection();
      pushToast({
        type: 'error',
        title: 'Pro Plan Required',
        description: `${INDUSTRY_TEMPLATES[draftStore.templateId].name} is a Pro template. Upgrade to Pro or choose a Free template before saving.`,
      });
      return;
    }

    const trimmedName = draftStore.name.trim();
    if (trimmedName.length < 2) {
      setValidationError('Please enter a store name (at least 2 characters).');
      focusBasicSection();
      pushToast({
        type: 'error',
        title: 'Store name required',
        description: 'Enter a valid store name in Info before saving.',
      });
      return;
    }

    if (!slugValidation.valid) {
      setValidationError(slugValidation.error ?? 'Invalid store URL slug.');
      focusBasicSection();
      pushToast({
        type: 'error',
        title: 'Check your Store URL Slug',
        description: slugValidation.error,
      });
      return;
    }

    setIsSaving(true);
    try {
      if (isCreateMode) {
        const created = await createStore({
          name: trimmedName,
          customSlug: slugValidation.normalizedSlug,
          templateId: draftStore.templateId,
          status: 'draft',
          branding: draftStore.branding,
        });

        if (created.error || !created.store) {
          setValidationError(created.error ?? 'Could not create store.');
          focusBasicSection();
          pushToast({
            type: 'error',
            title: 'Could not save store',
            description: created.error,
          });
          return;
        }

        closeMobileSheet();
        pushToast({
          type: 'success',
          title: 'Store created & changes saved!',
          description: `${created.store.name} (${created.store.domainUrl}) is saved.`,
        });
        navigate({ name: 'store-customize', storeId: created.store.id }, { replace: true });
        return;
      }

      if (!existingStore) return;

      const metaResult = await updateStoreMeta(existingStore.id, {
        name: trimmedName,
        slug: slugValidation.normalizedSlug,
        status: existingStore.status,
        templateId: draftStore.templateId,
        branding: draftStore.branding,
      });

      if (!metaResult.success) {
        setValidationError(metaResult.error ?? 'Could not update store details.');
        focusBasicSection();
        pushToast({
          type: 'error',
          title: 'Update failed',
          description: metaResult.error,
        });
        return;
      }

      closeMobileSheet();

      pushToast({
        type: 'success',
        title: 'Store UI changes saved!',
        description: `All appearance updates for ${trimmedName} have been saved.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const activeTemplateMeta = INDUSTRY_TEMPLATES[draftStore.templateId];
  const isLockedProPreview = !isProUser && isProTemplate(draftStore.templateId);

  const renderSectionContent = (sectionId: CustomizerSectionId) => {
    switch (sectionId) {
      case 'template':
        return (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Pick from 5 free layouts or 5 Pro animated editorial templates tailored to your niche.
            </p>

            {/* 5 Free Templates */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>Free Templates (5)</span>
                <span>Included</span>
              </div>
              <div className="space-y-2">
                {FREE_TEMPLATE_LIST.map((tpl) => {
                  const selected = draftStore.templateId === tpl.id;
                  const media = TEMPLATE_SHOWCASE_MEDIA[tpl.id];
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                        selected
                          ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 shadow-xs'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <img
                        src={media.imageUrl}
                        alt={tpl.name}
                        referrerPolicy="no-referrer"
                        className="w-16 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {tpl.name}
                          </span>
                          {selected && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {tpl.tagline}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5 Pro Premium Templates */}
            <div className="space-y-2 pt-2 border-t border-slate-200/80">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1.5 text-slate-900">
                  <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Pro Premium Templates (5)</span>
                </span>
                <span className={isProUser ? 'text-emerald-700' : 'text-amber-700'}>
                  {isProUser ? 'Unlocked' : 'Pro Plan'}
                </span>
              </div>
              <div className="space-y-2">
                {PRO_TEMPLATE_LIST.map((tpl) => {
                  const selected = draftStore.templateId === tpl.id;
                  const media = TEMPLATE_SHOWCASE_MEDIA[tpl.id];
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                        selected
                          ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 shadow-xs'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <img
                        src={media.imageUrl}
                        alt={tpl.name}
                        referrerPolicy="no-referrer"
                        className="w-16 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {tpl.name}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              PRO
                            </span>
                            {!isProUser && (
                              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            {selected && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {tpl.tagline}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {isLockedProPreview && (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/80 space-y-2">
                <p className="text-xs font-semibold text-amber-950">
                  Previewing Pro Template ({activeTemplateMeta.name})
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  You can preview this animated Pro layout right now. Upgrade to Pro to save and publish your store with it.
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'upgrade-plan' })}
                  className="w-full min-h-[36px] px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Upgrade to Pro (₱369/mo)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleApplyTemplatePalette}
              className="w-full min-h-[38px] px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Apply {activeTemplateMeta.name} Theme Colors &amp; Fonts
            </button>
          </div>
        );

      case 'basic':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="store-name-input" className="block text-xs font-semibold text-slate-700">
                Store Name
              </label>
              <input
                id="store-name-input"
                type="text"
                value={draftStore.name}
                onChange={(e) => {
                  handleNameChange(e.target.value);
                }}
                placeholder="e.g. Brew & Crumb"
                className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="store-slug-input" className="block text-xs font-semibold text-slate-700">
                  Store URL Slug
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (draftStore.name.trim().length < 2) {
                      pushToast({
                        type: 'info',
                        title: 'Enter a store name first',
                        description: 'Type your store name above to generate its URL slug.',
                      });
                      return;
                    }
                    setSlugTouched(false);
                    const autoSlug = generateUniqueStoreSlug(
                      draftStore.name,
                      existingSlugs.filter((s) => s !== existingStore?.slug)
                    );
                    setDraftStore((prev) => ({
                      ...prev,
                      slug: autoSlug,
                      domainUrl: buildStoreDomainUrl(autoSlug),
                    }));
                  }}
                  className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Auto-generate
                </button>
              </div>
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-slate-900">
                <span className="px-3 py-2.5 bg-slate-50 border-r border-slate-200 text-xs font-mono text-slate-500 shrink-0">
                  mystore.com/
                </span>
                <input
                  id="store-slug-input"
                  type="text"
                  value={draftStore.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="your-store-slug"
                  className="flex-1 min-w-0 min-h-[42px] px-3 py-2 text-sm font-mono bg-white focus:outline-none"
                />
              </div>
              {!slugValidation.valid && (draftStore.slug.length > 0 || validationError !== null) && (
                <p className="text-xs text-rose-600">{slugValidation.error}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="store-bio-input" className="block text-xs font-semibold text-slate-700">
                Tagline / Store Bio
              </label>
              <textarea
                id="store-bio-input"
                rows={3}
                value={draftStore.branding.bio}
                onChange={(e) => {
                  updateBranding({ bio: e.target.value });
                }}
                placeholder="Describe your storefront in 1-2 sentences..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              />
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label htmlFor="announcement-text-input" className="text-xs font-semibold text-slate-700">
                  Announcement Bar
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draftStore.branding.announcementEnabled}
                  onClick={() =>
                    updateBranding({
                      announcementEnabled: !draftStore.branding.announcementEnabled,
                    })
                  }
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                    draftStore.branding.announcementEnabled
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {draftStore.branding.announcementEnabled ? 'Enabled' : 'Hidden'}
                </button>
              </div>
              <input
                id="announcement-text-input"
                type="text"
                value={draftStore.branding.announcementText}
                onChange={(e) => {
                  updateBranding({ announcementText: e.target.value });
                }}
                placeholder="Free delivery on orders over ₱500!"
                className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        );

      case 'assets':
        return (
          <div className="space-y-5">
            {/* Logo Text & Uploader */}
            <div className="space-y-2.5">
              <label htmlFor="logo-text-input" className="block text-xs font-semibold text-slate-700">
                Storefront Wordmark
              </label>
              <input
                id="logo-text-input"
                type="text"
                value={draftStore.branding.logoText}
                onChange={(e) => {
                  updateBranding({ logoText: e.target.value });
                }}
                placeholder="Displayed in header"
                className="w-full min-h-[40px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-semibold text-slate-700">Store Logo Image</span>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFileUpload(e, 'logo')}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {customLogoUrl ? 'Replace Logo' : 'Upload Logo'}
                </button>
              </div>

              {customLogoUrl && (
                <div
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
                    draftStore.branding.logoImageUrl === customLogoUrl
                      ? 'border-slate-900 ring-1 ring-slate-900 bg-slate-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateBranding({ logoImageUrl: customLogoUrl })}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <img
                      src={customLogoUrl}
                      alt="Uploaded store logo"
                      className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          Uploaded Logo
                        </span>
                        {draftStore.branding.logoImageUrl === customLogoUrl && (
                          <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                        )}
                      </div>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {draftStore.branding.logoImageUrl === customLogoUrl
                          ? 'Active on storefront'
                          : 'Tap to use uploaded logo'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-label="Remove uploaded logo"
                    onClick={() => {
                      setCustomLogoUrl(null);
                      if (draftStore.branding.logoImageUrl === customLogoUrl) {
                        updateBranding({ logoImageUrl: undefined });
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                {PRESET_LOGOS.map((preset) => {
                  const active = (draftStore.branding.logoImageUrl ?? '') === preset.url;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => updateBranding({ logoImageUrl: preset.url || undefined })}
                      className={`p-1.5 rounded-xl border text-center transition-colors cursor-pointer ${
                        active
                          ? 'border-slate-900 ring-1 ring-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {preset.url ? (
                        <img
                          src={preset.url}
                          alt={preset.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-10 object-cover rounded-lg"
                        />
                      ) : (
                        <div
                          className="w-full h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: draftStore.branding.primaryColor }}
                        >
                          {(draftStore.branding.logoText || draftStore.name || 'M')
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                      <span className="block text-[10px] text-slate-600 mt-1 truncate">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hero Banner Uploader + Presets */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">Hero Banner Image</span>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFileUpload(e, 'banner')}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {customBannerUrl ? 'Replace Banner' : 'Upload Banner'}
                </button>
              </div>

              {customBannerUrl && (
                <div
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
                    draftStore.branding.heroBannerUrl === customBannerUrl
                      ? 'border-slate-900 ring-1 ring-slate-900 bg-slate-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateBranding({ heroBannerUrl: customBannerUrl })}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <img
                      src={customBannerUrl}
                      alt="Uploaded hero banner"
                      className="w-16 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          Uploaded Banner
                        </span>
                        {draftStore.branding.heroBannerUrl === customBannerUrl && (
                          <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                        )}
                      </div>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {draftStore.branding.heroBannerUrl === customBannerUrl
                          ? 'Active on storefront'
                          : 'Tap to use uploaded banner'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-label="Remove uploaded banner"
                    onClick={() => {
                      setCustomBannerUrl(null);
                      if (draftStore.branding.heroBannerUrl === customBannerUrl) {
                        updateBranding({ heroBannerUrl: undefined });
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-5 gap-1.5">
                {INDUSTRY_TEMPLATE_LIST.map((tpl) => {
                  const imgUrl = TEMPLATE_SHOWCASE_MEDIA[tpl.id].imageUrl;
                  const active = draftStore.branding.heroBannerUrl === imgUrl;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      title={active ? `Clear ${tpl.name} banner` : `Use ${tpl.name} banner`}
                      onClick={() => updateBranding({ heroBannerUrl: active ? undefined : imgUrl })}
                      className={`relative aspect-square rounded-lg overflow-hidden border cursor-pointer ${
                        active ? 'border-slate-900 ring-2 ring-slate-900' : 'border-slate-200'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={tpl.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hero Copy */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <label htmlFor="hero-title-input" className="block text-xs font-semibold text-slate-700">
                  Hero Headline
                </label>
                <input
                  id="hero-title-input"
                  type="text"
                  value={draftStore.branding.heroTitle}
                  onChange={(e) => {
                    updateBranding({ heroTitle: e.target.value });
                  }}
                  placeholder="e.g. Freshly Crafted Daily"
                  className="w-full min-h-[40px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="hero-subtitle-input" className="block text-xs font-semibold text-slate-700">
                  Hero Subheadline
                </label>
                <textarea
                  id="hero-subtitle-input"
                  rows={2}
                  value={draftStore.branding.heroSubtitle}
                  onChange={(e) => {
                    updateBranding({ heroSubtitle: e.target.value });
                  }}
                  placeholder="Describe what makes your store special..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="hero-cta-input" className="block text-xs font-semibold text-slate-700">
                  Hero Button Label
                </label>
                <input
                  id="hero-cta-input"
                  type="text"
                  value={draftStore.branding.heroCtaLabel}
                  onChange={(e) => {
                    updateBranding({ heroCtaLabel: e.target.value });
                  }}
                  placeholder="e.g. Shop Now"
                  className="w-full min-h-[40px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>
        );

      case 'theme':
        return (
          <div className="space-y-5">
            {/* Primary Brand Color + Curated Palettes */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="brand-color-picker" className="text-xs font-semibold text-slate-700">
                  Primary Brand Color
                </label>
                <span className="text-xs font-mono text-slate-500 uppercase">
                  {draftStore.branding.primaryColor}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="brand-color-picker"
                  type="color"
                  value={draftStore.branding.primaryColor}
                  onChange={(e) => {
                    setHasCustomizedTheme(true);
                    updateBranding({ primaryColor: e.target.value });
                  }}
                  className="w-12 h-10 rounded-lg border border-slate-200 p-1 bg-white cursor-pointer"
                />
                <input
                  type="text"
                  aria-label="Primary Brand Color Hex"
                  value={draftStore.branding.primaryColor}
                  onChange={(e) => {
                    setHasCustomizedTheme(true);
                    updateBranding({ primaryColor: e.target.value });
                  }}
                  className="flex-1 min-h-[40px] px-3 py-1.5 text-sm font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {CURATED_PALETTES.map((palette) => {
                  const active =
                    draftStore.branding.primaryColor.toLowerCase() ===
                    palette.primary.toLowerCase();
                  return (
                    <button
                      key={palette.name}
                      type="button"
                      onClick={() => {
                        setHasCustomizedTheme(true);
                        updateBranding({
                          primaryColor: palette.primary,
                          accentColor: palette.accent,
                        });
                      }}
                      className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                        active ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ backgroundColor: palette.primary }}
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-black/10"
                          style={{ backgroundColor: palette.accent }}
                        />
                      </div>
                      <span className="block text-[11px] font-medium text-slate-700 mt-1.5 truncate">
                        {palette.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Background Mode */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-700">Background Mode</span>
              <div className="grid grid-cols-3 gap-2">
                {BACKGROUND_MODES.map((bg) => {
                  const currentMode = draftStore.branding.backgroundMode ?? 'light';
                  const active = currentMode === bg.id;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => handleBackgroundModeChange(bg.id)}
                      className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                        style={{ backgroundColor: bg.swatch }}
                      />
                      <span className="truncate">{bg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Button Style */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-700">Button Style</span>
              <div className="grid grid-cols-3 gap-2">
                {BUTTON_STYLES.map((btn) => {
                  const currentBtn = draftStore.branding.buttonStyle ?? 'rounded';
                  const active = currentBtn === btn.id;
                  return (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => {
                        setHasCustomizedTheme(true);
                        updateBranding({ buttonStyle: btn.id });
                      }}
                      className={`min-h-[40px] px-3 py-2 border text-xs font-semibold cursor-pointer transition-colors ${btn.previewClass} ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {btn.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Pairings */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-700">Font Pairing</span>
              <div className="space-y-2">
                {FONT_PAIRINGS.map((fp) => {
                  const normalizedCurrent =
                    draftStore.branding.fontPairing === 'athletic-condensed'
                      ? 'bold-display'
                      : draftStore.branding.fontPairing === 'minimal-mono'
                        ? 'modern-sans'
                        : draftStore.branding.fontPairing;
                  const active = normalizedCurrent === fp.id;
                  return (
                    <button
                      key={fp.id}
                      type="button"
                      onClick={() => {
                        setHasCustomizedTheme(true);
                        updateBranding({ fontPairing: fp.id });
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        active
                          ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <p
                          className="text-sm font-bold text-slate-900"
                          style={{ fontFamily: fp.fontFamily }}
                        >
                          {fp.label}
                        </p>
                        <p className="text-[11px] text-slate-500">{fp.sample}</p>
                      </div>
                      {active && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="store-address-input" className="block text-xs font-semibold text-slate-700">
                Address / Location
              </label>
              <input
                id="store-address-input"
                type="text"
                value={draftStore.branding.address ?? ''}
                onChange={(e) => updateBranding({ address: e.target.value })}
                placeholder="e.g. 42 Salcedo Street, Makati"
                className="w-full min-h-[40px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="store-phone-input" className="block text-xs font-semibold text-slate-700">
                Contact Number
              </label>
              <input
                id="store-phone-input"
                type="text"
                value={draftStore.branding.contactNumber ?? ''}
                onChange={(e) => updateBranding({ contactNumber: e.target.value })}
                placeholder="+63 917 555 0148"
                className="w-full min-h-[40px] px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700">Social Media Links</p>

              <div className="space-y-1.5">
                <label htmlFor="social-ig-input" className="block text-[11px] font-medium text-slate-500">
                  Instagram
                </label>
                <input
                  id="social-ig-input"
                  type="text"
                  value={draftStore.branding.socialLinks.instagram ?? ''}
                  onChange={(e) =>
                    updateBranding({
                      socialLinks: {
                        ...draftStore.branding.socialLinks,
                        instagram: e.target.value,
                      },
                    })
                  }
                  placeholder="@yourbrand"
                  className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="social-fb-input" className="block text-[11px] font-medium text-slate-500">
                  Facebook
                </label>
                <input
                  id="social-fb-input"
                  type="text"
                  value={draftStore.branding.socialLinks.facebook ?? ''}
                  onChange={(e) =>
                    updateBranding({
                      socialLinks: {
                        ...draftStore.branding.socialLinks,
                        facebook: e.target.value,
                      },
                    })
                  }
                  placeholder="facebook.com/yourbrand"
                  className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="social-tt-input" className="block text-[11px] font-medium text-slate-500">
                  TikTok
                </label>
                <input
                  id="social-tt-input"
                  type="text"
                  value={draftStore.branding.socialLinks.tiktok ?? ''}
                  onChange={(e) =>
                    updateBranding({
                      socialLinks: {
                        ...draftStore.branding.socialLinks,
                        tiktok: e.target.value,
                      },
                    })
                  }
                  placeholder="@yourbrand.ph"
                  className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>
        );
    }
  };

  const activeDesktopMeta =
    CUSTOMIZER_SECTIONS.find((sec) => sec.id === activeSection) ?? CUSTOMIZER_SECTIONS[0];
  const activeMobileMeta = mobileSheetSection
    ? CUSTOMIZER_SECTIONS.find((sec) => sec.id === mobileSheetSection) ?? null
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Clean 2-Element Fixed Top Navigation Bar */}
      <header className="fixed top-0 inset-x-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goBack({ name: 'dashboard' })}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={handleSaveChanges}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Save className="w-4 h-4 shrink-0" />
          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </header>
      <div className="h-16 shrink-0" aria-hidden="true" />

      {/* Responsive Workspace: Full-height live preview on Mobile (< lg), Split-Screen on Desktop (lg:) */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[430px_1fr] lg:h-[calc(100vh-64px)] lg:overflow-hidden">
        {/* DESKTOP LEFT PANEL: Tabbed Customization Controls */}
        <aside
          aria-label="Store UI Customization Controls"
          className="hidden lg:flex lg:flex-col bg-white border-r border-slate-200/80 h-full overflow-hidden"
        >
          {/* 5-Tab Bar */}
          <div
            role="tablist"
            aria-label="Store customization sections"
            className="grid grid-cols-5 border-b border-slate-200/80 bg-slate-50/70 px-2 pt-2 gap-1 shrink-0"
          >
            {CUSTOMIZER_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isSelected = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-[11px] font-semibold rounded-t-xl border-b-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-900 border-slate-900 shadow-xs'
                      : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-white/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate max-w-full">{section.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Active Section Header + Form Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {validationError && (
              <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700">
                {validationError}
              </div>
            )}

            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{activeDesktopMeta.fullTitle}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{activeDesktopMeta.subtitle}</p>
            </div>

            {renderSectionContent(activeSection)}
          </div>
        </aside>

        {/* LIVE INTERACTIVE PREVIEW CANVAS (Full-Height on Mobile, Right Split on Desktop) */}
        <section
          aria-label="Live Storefront Preview"
          className="flex-1 flex flex-col bg-slate-200/75 min-h-[calc(100dvh-64px)] lg:min-h-0 lg:h-full lg:overflow-hidden"
        >
          {/* Preview Browser Toolbar */}
          <div className="h-12 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0 text-xs text-slate-600 font-mono truncate">
              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {draftStore.slug ? draftStore.domainUrl : 'mystore.com/your-store'}
              </span>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="hidden sm:inline font-sans text-slate-500">
                {activeTemplateMeta.name}
              </span>
            </div>

            {/* Desktop / Mobile Viewport Toggle */}
            <div
              role="group"
              aria-label="Preview viewport size"
              className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg shrink-0"
            >
              <button
                type="button"
                onClick={() => setPreviewViewport('desktop')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  previewViewport === 'desktop'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport('mobile')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  previewViewport === 'mobile'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>
          </div>

          {/* Live Preview Scroll Container (with bottom clearance for floating dock on mobile) */}
          <div
            className={`flex-1 lg:overflow-y-auto p-3 sm:p-5 ${
              isKeyboardOpen ? 'pb-4' : 'pb-28'
            } lg:pb-6 flex justify-center items-start`}
          >
            <div
              className={`bg-white border border-slate-300 shadow-lg transition-all duration-200 overflow-hidden ${
                previewViewport === 'mobile'
                  ? 'w-[390px] max-w-full rounded-[28px] ring-4 ring-slate-900/10'
                  : 'w-full rounded-2xl'
              }`}
            >
              <StorefrontRenderer
                store={draftStore}
                products={storeProducts}
                currency={currency}
                viewport={previewViewport}
                isPreview
                onAddToCart={(product, variant) => {
                  pushToast({
                    type: 'info',
                    title: 'Preview Bag Updated',
                    description: `${product.name}${variant ? ` (${variant})` : ''} added in preview.`,
                  });
                }}
              />
            </div>
          </div>
        </section>
      </div>

      {/* MOBILE FLOATING BOTTOM PILL DOCK (< lg) — hides automatically when keyboard/text input is active */}
      <nav
        aria-label="Mobile customization tools"
        aria-hidden={isKeyboardOpen}
        className={`fixed bottom-3 left-3 right-3 z-50 ${
          isKeyboardOpen ? 'hidden' : 'flex'
        } justify-center pointer-events-none lg:hidden`}
      >
        <div className="pointer-events-auto w-full max-w-md bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl shadow-slate-900/15 rounded-full p-1.5 grid grid-cols-5 gap-1">
          {CUSTOMIZER_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = mobileSheetSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                aria-expanded={isActive}
                onClick={() => {
                  setActiveSection(section.id);
                  setMobileSheetSection((prev) => (prev === section.id ? null : section.id));
                }}
                className={`min-h-[46px] px-1 py-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer touch-manipulation select-none ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate max-w-full leading-tight">{section.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* MOBILE FLOATING SHEET MODAL (< lg) — anchored above the z-50 bottom dock when keyboard is closed */}
      {mobileSheetSection && activeMobileMeta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeMobileMeta.fullTitle}
          className={`fixed inset-0 z-40 lg:hidden flex flex-col items-center px-3 pt-[68px] ${
            isKeyboardOpen ? 'pb-3' : 'pb-[80px]'
          } pointer-events-none`}
        >
          {/* Light backdrop keeps top navbar and floating dock cleanly framed while allowing tap-outside close */}
          <div
            aria-hidden="true"
            onClick={closeMobileSheet}
            className="fixed inset-0 bg-slate-950/20 pointer-events-auto transition-opacity"
          />

          <section className="relative z-10 pointer-events-auto w-full max-w-md flex-1 min-h-0 flex flex-col bg-white border border-slate-200/80 rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-900/5 border border-slate-200/80 flex items-center justify-center text-slate-800 shrink-0">
                  <activeMobileMeta.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 truncate">
                    {activeMobileMeta.fullTitle}
                  </h2>
                  <p className="text-[11px] text-slate-500 truncate">
                    {activeMobileMeta.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Done and close settings"
                onClick={closeMobileSheet}
                className="inline-flex items-center justify-center min-h-[36px] px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-colors shrink-0 cursor-pointer"
              >
                Done
              </button>
            </div>

            {/* Bottom Sheet Scrollable Controls */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
              {validationError && (
                <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700">
                  {validationError}
                </div>
              )}

              {renderSectionContent(mobileSheetSection)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
