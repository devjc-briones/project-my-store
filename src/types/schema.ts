export type IndustryTemplateId =
  | 'food-restaurant'
  | 'cafe-drinks'
  | 'clothing-apparel'
  | 'footwear-shoes'
  | 'gadgets-accessories'
  | 'food-bistro-pro'
  | 'cafe-atelier-pro'
  | 'clothing-editorial-pro'
  | 'footwear-studio-pro'
  | 'gadgets-flagship-pro';

export type StoreStatus = 'draft' | 'published' | 'restricted';
export type UserStatus = 'active' | 'restricted';

export enum Roles {
  Admin = 'admin',
  Seller = 'seller',
  Buyer = 'buyer',
}

export type UserRole = Roles;

export type FontPairingId =
  | 'modern-sans'
  | 'editorial-serif'
  | 'bold-display'
  | 'athletic-condensed'
  | 'minimal-mono';

export type BackgroundMode = 'light' | 'cream' | 'dark';

export type ButtonStyle = 'rounded' | 'pill' | 'sharp';

export type CurrencyCode = 'PHP' | 'USD' | 'SGD' | 'EUR';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role?: Roles;
  avatarUrl?: string;
  plan: 'starter' | 'pro';
  status?: UserStatus;
  restrictedReason?: string;
  planPeriodEndsAt?: string;
  cancelAtPeriodEnd?: boolean;
  lastActiveAt?: string;
  createdAt: string;
}

export interface SubscriptionTransaction {
  id: string;
  referenceId: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: 'starter' | 'pro';
  amount: number;
  paymentMethod: string;
  status: 'pending' | 'dues' | 'paid' | 'refunded';
  proofUrl?: string;
  approvedAt?: string;
  createdAt: string;
}

export type PreferredCheckoutPaymentKey = 'gcash' | 'maya' | 'bank' | 'cod';

export interface BuyerCheckoutInfo {
  fullName: string;
  phoneNumber: string;
  deliveryAddress: string;
  notes?: string;
  preferredPaymentMethod?: PreferredCheckoutPaymentKey;
  updatedAt: string;
}

export interface BuyerAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Roles;
  createdAt: string;
  storeId?: string;
  storeName?: string;
  savedCheckoutInfo?: BuyerCheckoutInfo;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
}

export interface StoreBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  backgroundMode?: BackgroundMode;
  buttonStyle?: ButtonStyle;
  fontPairing: FontPairingId;
  logoText: string;
  logoImageUrl?: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  heroBannerUrl?: string;
  bio: string;
  announcementEnabled: boolean;
  announcementText: string;
  address?: string;
  contactNumber?: string;
  socialLinks: SocialLinks;
}

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  /** Full canonical display domain: e.g. mystore.com/brew-cafe */
  domainUrl: string;
  templateId: IndustryTemplateId;
  status: StoreStatus;
  restrictedReason?: string;
  branding: StoreBranding;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  label: string;
  /** Examples: "Size", "Color", "Roast", "Storage" */
  attributeName: string;
  value: string;
  priceDelta: number;
  stock: number;
  sku?: string;
}

export type DiscountType = 'none' | 'percentage' | 'fixed';

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  /** Discount calculation mode */
  discountType?: DiscountType;
  /** Raw discount value (% or fixed currency amount depending on discountType) */
  discountValue?: number;
  /** Percentage discount 0 - 95 */
  discountPercent: number;
  /** Optional merchant cost price for profit margin readouts */
  costPrice?: number;
  /** Auto-calculated selling price */
  finalPrice: number;
  sku: string;
  stock: number;
  imageUrl?: string;
  variants: ProductVariant[];
  isFeatured: boolean;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransferDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  qrImageUrl?: string;
}

export interface EWalletDetails {
  accountName: string;
  mobileNumber: string;
  qrNote?: string;
  qrImageUrl?: string;
}

export interface PaymentSettings {
  storeId: string;
  currency: CurrencyCode;
  codEnabled: boolean;
  codInstructions?: string;
  gcashEnabled: boolean;
  gcashDetails: EWalletDetails;
  mayaEnabled: boolean;
  mayaDetails: EWalletDetails;
  bankTransferEnabled: boolean;
  bankDetails: BankTransferDetails;
  taxPercent: number;
  serviceChargePercent?: number;
  shippingFee: number;
  freeShippingThreshold: number;
  updatedAt: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

export interface IndustryTemplateMeta {
  id: IndustryTemplateId;
  tier: 'free' | 'pro';
  name: string;
  categoryLabel: string;
  tagline: string;
  layoutSummary: string;
  recommendedCategories: string[];
  defaultBranding: StoreBranding;
}

export interface OrderItemSummary {
  productId: string;
  name: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
}

export type OrderFulfillmentStatus =
  | 'Pending'
  | 'Preparing'
  | 'Out for Delivery'
  | 'Completed';

export interface CustomerOrder {
  id: string;
  storeId: string;
  storeName?: string;
  buyerId?: string;
  customerName: string;
  phoneNumber: string;
  deliveryAddress: string;
  notes?: string;
  paymentMethod: string;
  paymentProofUrl?: string;
  items: OrderItemSummary[];
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  serviceChargeAmount: number;
  grandTotal: number;
  status: OrderFulfillmentStatus;
  createdAt: string;
}

export type PlatformPaymentChannelType = 'ewallet' | 'bank' | 'custom';

export interface PlatformPaymentChannel {
  id: string;
  type: PlatformPaymentChannelType;
  label: string;
  subtitle: string;
  enabled: boolean;
  requiresReceipt: boolean;
  accountName: string;
  numberLabel: string;
  accountNumber: string;
  note?: string;
  qrImageUrl?: string;
}

export interface PlatformPaymentSettings {
  channels: PlatformPaymentChannel[];
  updatedAt: string;
}

export interface GlobalAppState {
  currentUser: User | null;
  users?: User[];
  currentBuyer: BuyerAccount | null;
  buyers: BuyerAccount[];
  stores: Store[];
  products: Product[];
  paymentSettingsByStore: Record<string, PaymentSettings>;
  platformPaymentSettings?: PlatformPaymentSettings;
  placedOrders?: CustomerOrder[];
  subscriptionTransactions?: SubscriptionTransaction[];
  readNotificationIds?: string[];
  dismissedNotificationIds?: string[];
  activeStoreId: string | null;
}
