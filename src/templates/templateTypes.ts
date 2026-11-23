import { useState } from 'react';
import {
  BackgroundMode,
  BuyerAccount,
  ButtonStyle,
  CurrencyCode,
  FontPairingId,
  IndustryTemplateId,
  Product,
  Store,
  StoreBranding,
} from '../types/schema';

export type StorefrontViewPage = 'home' | 'products' | 'info-settings';

export interface StorefrontTemplateProps {
  store: Store;
  products: Product[];
  currency?: CurrencyCode;
  viewport?: 'desktop' | 'mobile';
  isPreview?: boolean;
  cartCount?: number;
  showSearchBar?: boolean;
  activePage?: StorefrontViewPage;
  onChangePage?: (page: StorefrontViewPage) => void;
  currentBuyer?: BuyerAccount | null;
  hasSavedBuyerInfo?: boolean;
  onOpenCart?: () => void;
  onOpenTrackOrder?: () => void;
  onOpenBuyerAuth?: () => void;
  onOpenBuyerAccount?: () => void;
  onSelectProduct?: (product: Product, preselectedVariant?: string) => void;
  onAddToCart?: (product: Product, selectedVariant?: string) => void;
}

export function useStorefrontPage(
  controlledPage?: StorefrontViewPage,
  onChangePage?: (page: StorefrontViewPage) => void
): [StorefrontViewPage, (next: StorefrontViewPage) => void] {
  const [internalPage, setInternalPage] = useState<StorefrontViewPage>('home');
  const activePage = controlledPage ?? internalPage;
  const navigatePage = (next: StorefrontViewPage) => {
    if (onChangePage) {
      onChangePage(next);
    } else {
      setInternalPage(next);
    }
  };
  return [activePage, navigatePage];
}

export interface ResolvedThemeTokens {
  mode: BackgroundMode;
  isDark: boolean;
  canvasBg: string;
  cardBg: string;
  subtleBg: string;
  borderColor: string;
  textPrimary: string;
  textMuted: string;
  primaryColor: string;
  accentTextColor: string;
  onPrimaryText: string;
  buttonRadiusClass: string;
  chipRadiusClass: string;
  headingFontFamily: string;
  bodyFontFamily: string;
}

function parseHexRgb(hexColor: string): [number, number, number] | null {
  const cleaned = hexColor.replace('#', '').trim();
  const fullHex =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;

  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) {
    return null;
  }

  return [
    parseInt(fullHex.slice(0, 2), 16),
    parseInt(fullHex.slice(2, 4), 16),
    parseInt(fullHex.slice(4, 6), 16),
  ];
}

function getRelativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(hexA: string, hexB: string): number {
  const rgbA = parseHexRgb(hexA);
  const rgbB = parseHexRgb(hexB);
  if (!rgbA || !rgbB) return 1;
  const lumA = getRelativeLuminance(rgbA);
  const lumB = getRelativeLuminance(rgbB);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}

function resolveContrastSafeAccent(
  primaryColor: string,
  surfaceHex: string,
  isDark: boolean
): string {
  if (getContrastRatio(primaryColor, surfaceHex) >= 4.2) {
    return primaryColor;
  }

  const rgb = parseHexRgb(primaryColor);
  if (!rgb) {
    return isDark ? '#E2E8F0' : '#0F172A';
  }

  const target: [number, number, number] = isDark ? [248, 250, 252] : [15, 23, 42];
  for (let step = 1; step <= 10; step += 1) {
    const t = step / 10;
    const mixed: [number, number, number] = [
      Math.round(rgb[0] + (target[0] - rgb[0]) * t),
      Math.round(rgb[1] + (target[1] - rgb[1]) * t),
      Math.round(rgb[2] + (target[2] - rgb[2]) * t),
    ];
    const hex = `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    if (getContrastRatio(hex, surfaceHex) >= 4.5) {
      return hex;
    }
  }

  return isDark ? '#F8FAFC' : '#0F172A';
}

export function getContrastTextColor(hexColor: string): string {
  const rgb = parseHexRgb(hexColor);
  if (!rgb) {
    return '#FFFFFF';
  }
  const [r, g, b] = rgb;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 162 ? '#0F172A' : '#FFFFFF';
}

export function resolveBackgroundMode(branding: StoreBranding, fallbackTemplateId?: IndustryTemplateId): BackgroundMode {
  if (branding.backgroundMode) return branding.backgroundMode;
  const surface = branding.surfaceColor?.toLowerCase();
  if (surface === '#0f172a' || surface === '#09090b' || surface === '#18181b') {
    return 'dark';
  }
  if (surface === '#faf8f5' || surface === '#fbf9f6') {
    return 'cream';
  }
  if (
    fallbackTemplateId === 'gadgets-accessories' ||
    fallbackTemplateId === 'gadgets-flagship-pro'
  ) {
    return 'dark';
  }
  if (
    fallbackTemplateId === 'food-restaurant' ||
    fallbackTemplateId === 'cafe-drinks' ||
    fallbackTemplateId === 'food-bistro-pro' ||
    fallbackTemplateId === 'cafe-atelier-pro'
  ) {
    return 'cream';
  }
  return 'light';
}

export function resolveFontFamilies(fontPairing: FontPairingId): {
  heading: string;
  body: string;
} {
  switch (fontPairing) {
    case 'editorial-serif':
      return {
        heading: "'Playfair Display', Georgia, serif",
        body: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
      };
    case 'bold-display':
    case 'athletic-condensed':
      return {
        heading: "'Oswald', 'Outfit', sans-serif",
        body: "'DM Sans', 'Plus Jakarta Sans', sans-serif",
      };
    case 'minimal-mono':
      return {
        heading: "'Outfit', 'Plus Jakarta Sans', sans-serif",
        body: "'DM Sans', 'Plus Jakarta Sans', sans-serif",
      };
    case 'modern-sans':
    default:
      return {
        heading: "'Plus Jakarta Sans', 'Outfit', sans-serif",
        body: "'DM Sans', 'Plus Jakarta Sans', sans-serif",
      };
  }
}

export function resolveButtonRadius(buttonStyle: ButtonStyle = 'rounded'): {
  button: string;
  chip: string;
} {
  switch (buttonStyle) {
    case 'pill':
      return { button: 'rounded-full', chip: 'rounded-full' };
    case 'sharp':
      return { button: 'rounded-none', chip: 'rounded-none' };
    case 'rounded':
    default:
      return { button: 'rounded-xl', chip: 'rounded-lg' };
  }
}

export function resolveThemeTokens(
  branding: StoreBranding,
  templateId?: IndustryTemplateId
): ResolvedThemeTokens {
  const mode = resolveBackgroundMode(branding, templateId);
  const fonts = resolveFontFamilies(branding.fontPairing);
  const radii = resolveButtonRadius(branding.buttonStyle ?? 'rounded');
  const primaryColor = branding.primaryColor || '#0F172A';

  if (mode === 'dark') {
    const cardBg = '#131C31';
    return {
      mode,
      isDark: true,
      canvasBg: '#0B1120',
      cardBg,
      subtleBg: '#1B2742',
      borderColor: '#253352',
      textPrimary: '#F8FAFC',
      textMuted: '#94A3B8',
      primaryColor,
      accentTextColor: resolveContrastSafeAccent(primaryColor, '#1B2742', true),
      onPrimaryText: getContrastTextColor(primaryColor),
      buttonRadiusClass: radii.button,
      chipRadiusClass: radii.chip,
      headingFontFamily: fonts.heading,
      bodyFontFamily: fonts.body,
    };
  }

  if (mode === 'cream') {
    const cardBg = '#FFFFFF';
    return {
      mode,
      isDark: false,
      canvasBg: '#FAF8F5',
      cardBg,
      subtleBg: '#F3EFE8',
      borderColor: '#E5DFD3',
      textPrimary: '#1C1917',
      textMuted: '#57534E',
      primaryColor,
      accentTextColor: resolveContrastSafeAccent(primaryColor, '#F3EFE8', false),
      onPrimaryText: getContrastTextColor(primaryColor),
      buttonRadiusClass: radii.button,
      chipRadiusClass: radii.chip,
      headingFontFamily: fonts.heading,
      bodyFontFamily: fonts.body,
    };
  }

  return {
    mode,
    isDark: false,
    canvasBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    subtleBg: '#F8FAFC',
    borderColor: '#E2E8F0',
    textPrimary: '#0F172A',
    textMuted: '#475569',
    primaryColor,
    accentTextColor: resolveContrastSafeAccent(primaryColor, '#F8FAFC', false),
    onPrimaryText: getContrastTextColor(primaryColor),
    buttonRadiusClass: radii.button,
    chipRadiusClass: radii.chip,
    headingFontFamily: fonts.heading,
    bodyFontFamily: fonts.body,
  };
}

export interface TemplateDisplayProduct {
  product: Product;
  isSamplePreview: boolean;
  metaTag?: string;
  secondaryDetail?: string;
}

export function getDisplayProductsForTemplate(
  _store: Store,
  storeProducts: Product[]
): TemplateDisplayProduct[] {
  return storeProducts
    .filter((p) => p.isAvailable)
    .map((product) => ({
      product,
      isSamplePreview: false,
    }));
}
