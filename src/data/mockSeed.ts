import { GlobalAppState, PaymentSettings } from '../types/schema';
import { createDefaultPlatformPaymentSettings } from './platformPayments';

export function createDefaultPaymentSettings(storeId: string): PaymentSettings {
  return {
    storeId,
    currency: 'PHP',
    codEnabled: false,
    codInstructions: '',
    gcashEnabled: false,
    gcashDetails: {
      accountName: '',
      mobileNumber: '',
      qrNote: '',
      qrImageUrl: undefined,
    },
    mayaEnabled: false,
    mayaDetails: {
      accountName: '',
      mobileNumber: '',
      qrNote: '',
      qrImageUrl: undefined,
    },
    bankTransferEnabled: false,
    bankDetails: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      qrImageUrl: undefined,
    },
    taxPercent: 0,
    serviceChargePercent: 0,
    shippingFee: 0,
    freeShippingThreshold: 0,
    updatedAt: new Date().toISOString(),
  };
}

export const INITIAL_SEED_STATE: GlobalAppState = {
  currentUser: null,
  users: [],
  currentBuyer: null,
  buyers: [],
  placedOrders: [],
  stores: [],
  products: [],
  paymentSettingsByStore: {},
  activeStoreId: null,
  subscriptionTransactions: [],
  readNotificationIds: [],
  dismissedNotificationIds: [],
  platformPaymentSettings: createDefaultPlatformPaymentSettings(),
};
