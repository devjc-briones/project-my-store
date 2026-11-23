import { PlatformPaymentChannel, PlatformPaymentSettings } from '../types/schema';

export const DEFAULT_PLATFORM_PAYMENT_CHANNELS: PlatformPaymentChannel[] = [];

export function createDefaultPlatformPaymentSettings(): PlatformPaymentSettings {
  return {
    channels: [],
    updatedAt: new Date().toISOString(),
  };
}
