import { PlatformPaymentChannel, PlatformPaymentSettings } from '../types/schema';
import { DEFAULT_PRO_MONTHLY_PRICE } from './plans';

export const PRO_PLAN_PRICE_ROW_ID = '__pro_plan_price__';

export const DEFAULT_PLATFORM_PAYMENT_CHANNELS: PlatformPaymentChannel[] = [];

export function createDefaultPlatformPaymentSettings(): PlatformPaymentSettings {
  return {
    channels: [],
    proMonthlyPrice: DEFAULT_PRO_MONTHLY_PRICE,
    updatedAt: new Date().toISOString(),
  };
}
