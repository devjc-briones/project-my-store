import { CurrencyCode, DiscountType } from '../types/schema';

const CURRENCY_LOCALES: Record<CurrencyCode, { locale: string; symbol: string }> = {
  PHP: { locale: 'en-PH', symbol: '₱' },
  USD: { locale: 'en-US', symbol: '$' },
  SGD: { locale: 'en-SG', symbol: 'S$' },
  EUR: { locale: 'de-DE', symbol: '€' },
};

export function getCurrencySymbol(currency: CurrencyCode = 'PHP'): string {
  return (CURRENCY_LOCALES[currency] ?? CURRENCY_LOCALES.PHP).symbol;
}

/**
 * Calculates final discounted price rounded to 2 decimal places.
 */
export function calculateFinalPrice(basePrice: number, discountPercent: number): number {
  const safeBase = Math.max(0, Number.isFinite(basePrice) ? basePrice : 0);
  const safeDiscount = Math.min(95, Math.max(0, Number.isFinite(discountPercent) ? discountPercent : 0));
  const raw = safeBase * (1 - safeDiscount / 100);
  return Math.round(raw * 100) / 100;
}

/**
 * Calculates discount savings amount.
 */
export function calculateDiscountSavings(basePrice: number, discountPercent: number): number {
  const finalPrice = calculateFinalPrice(basePrice, discountPercent);
  return Math.max(0, Math.round((basePrice - finalPrice) * 100) / 100);
}

export interface SmartPricingInput {
  basePrice: number;
  discountType: DiscountType;
  discountValue: number;
  costPrice?: number;
}

export interface SmartPricingResult {
  finalPrice: number;
  customerSavings: number;
  effectiveDiscountPercent: number;
  profitAmount: number | null;
  profitMarginPercent: number | null;
}

/**
 * Smart pricing calculator for percentage or fixed-amount discounts and merchant profit margins.
 */
export function calculateSmartPricing({
  basePrice,
  discountType,
  discountValue,
  costPrice,
}: SmartPricingInput): SmartPricingResult {
  const safeBase = Math.max(0, Number.isFinite(basePrice) ? basePrice : 0);
  const safeVal = Math.max(0, Number.isFinite(discountValue) ? discountValue : 0);

  let finalPrice = safeBase;
  if (discountType === 'percentage') {
    const pct = Math.min(95, safeVal);
    finalPrice = safeBase * (1 - pct / 100);
  } else if (discountType === 'fixed') {
    const clampedFixed = Math.min(safeBase, safeVal);
    finalPrice = Math.max(0, safeBase - clampedFixed);
  }

  finalPrice = Math.round(finalPrice * 100) / 100;
  const customerSavings = Math.max(0, Math.round((safeBase - finalPrice) * 100) / 100);
  const effectiveDiscountPercent =
    safeBase > 0 ? Math.round((customerSavings / safeBase) * 1000) / 10 : 0;

  let profitAmount: number | null = null;
  let profitMarginPercent: number | null = null;

  if (costPrice !== undefined && Number.isFinite(costPrice) && costPrice >= 0) {
    profitAmount = Math.round((finalPrice - costPrice) * 100) / 100;
    profitMarginPercent =
      finalPrice > 0 ? Math.round((profitAmount / finalPrice) * 1000) / 10 : 0;
  }

  return {
    finalPrice,
    customerSavings,
    effectiveDiscountPercent,
    profitAmount,
    profitMarginPercent,
  };
}

/**
 * Formats a numeric price cleanly with currency code.
 */
export function formatCurrency(amount: number, currency: CurrencyCode = 'PHP'): string {
  const config = CURRENCY_LOCALES[currency] ?? CURRENCY_LOCALES.PHP;
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${config.symbol}${amount.toFixed(2)}`;
  }
}
