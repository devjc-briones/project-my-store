import { User } from '../types/schema';

export type PlanId = User['plan'];

export const DEFAULT_PRO_MONTHLY_PRICE = 369;

export function formatPlanPriceLabel(amount: number): string {
  const safe = Number.isFinite(amount) && amount >= 0 ? amount : DEFAULT_PRO_MONTHLY_PRICE;
  return Number.isInteger(safe)
    ? `₱${safe.toLocaleString('en-US')}`
    : `₱${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface PlatformPlan {
  id: PlanId;
  name: string;
  audience: string;
  monthlyPrice: number;
  priceLabel: string;
  cadence: string;
  highlights: string[];
  landingCta: string;
  featured: boolean;
}

export function getPlatformPlans(proMonthlyPrice = DEFAULT_PRO_MONTHLY_PRICE): PlatformPlan[] {
  const safeProPrice =
    Number.isFinite(proMonthlyPrice) && proMonthlyPrice > 0
      ? Math.round(proMonthlyPrice * 100) / 100
      : DEFAULT_PRO_MONTHLY_PRICE;

  return [
    {
      id: 'starter',
      name: 'Free',
      audience: 'For first-time sellers',
      monthlyPrice: 0,
      priceLabel: '₱0',
      cadence: 'Forever free',
      highlights: [
        '1 active online store',
        'Up to 25 products with variants',
        '5 free customizable templates included',
        'Subpath link at mystore.com/your-brand',
      ],
      landingCta: 'Start Free',
      featured: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      audience: 'For multi-brand merchants',
      monthlyPrice: safeProPrice,
      priceLabel: formatPlanPriceLabel(safeProPrice),
      cadence: 'per month',
      highlights: [
        'Up to 15 active online stores',
        'Unlimited adding of products & variants',
        '10 customizable templates (5 free + 5 premium)',
        'COD, GCash, Maya, Card & Bank checkout',
        'Full brand font & theme controls',
      ],
      landingCta: 'Get Pro',
      featured: true,
    },
  ];
}

export const PLATFORM_PLANS: PlatformPlan[] = getPlatformPlans(DEFAULT_PRO_MONTHLY_PRICE);

export interface PlanLimits {
  maxStores: number;
  maxProductsPerStore: number;
  label: string;
}

export function getPlanLimits(plan: PlanId = 'starter'): PlanLimits {
  switch (plan) {
    case 'pro':
      return {
        maxStores: 15,
        maxProductsPerStore: Number.POSITIVE_INFINITY,
        label: 'Pro',
      };
    case 'starter':
    default:
      return {
        maxStores: 1,
        maxProductsPerStore: 25,
        label: 'Free',
      };
  }
}
