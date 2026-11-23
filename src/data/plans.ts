import { User } from '../types/schema';

export type PlanId = User['plan'];

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

export const PLATFORM_PLANS: PlatformPlan[] = [
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
    monthlyPrice: 369,
    priceLabel: '₱369',
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
