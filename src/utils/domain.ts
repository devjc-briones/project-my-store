export const PLATFORM_DOMAIN = 'mystore.com';

export const RESERVED_ROUTE_SLUGS = new Set([
  'login',
  'signup',
  'register',
  'auth',
  'dashboard',
  'store',
  'stores',
  'shop',
  'templates',
  'pricing',
  'plans',
  'upgrade-plan',
  'onboarding',
  'settings',
  'admin',
  'api',
  'preview',
  'help',
  'docs',
  'about',
  'terms',
  'privacy',
]);

/**
 * Converts a raw store name or custom input into a clean URL-safe slug.
 * Example: "Brew & Co. Cafe!" -> "brew-co-cafe"
 */
export function slugifyStoreName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isReservedRouteSlug(slug: string): boolean {
  return RESERVED_ROUTE_SLUGS.has(slug.toLowerCase());
}

export interface SlugValidationResult {
  valid: boolean;
  normalizedSlug: string;
  error?: string;
}

export function validateStoreSlug(
  rawInput: string,
  existingSlugs: string[] = [],
  currentStoreSlug?: string
): SlugValidationResult {
  const normalized = slugifyStoreName(rawInput);

  if (!normalized || normalized.length < 3) {
    return {
      valid: false,
      normalizedSlug: normalized,
      error: 'Store handle must be at least 3 alphanumeric characters.',
    };
  }

  if (normalized.length > 48) {
    return {
      valid: false,
      normalizedSlug: normalized,
      error: 'Store handle must be 48 characters or fewer.',
    };
  }

  if (isReservedRouteSlug(normalized)) {
    return {
      valid: false,
      normalizedSlug: normalized,
      error: `"${normalized}" is a reserved platform path. Please pick another brand handle.`,
    };
  }

  const taken = existingSlugs.some(
    (s) => s.toLowerCase() === normalized && s.toLowerCase() !== currentStoreSlug?.toLowerCase()
  );

  if (taken) {
    return {
      valid: false,
      normalizedSlug: normalized,
      error: `${PLATFORM_DOMAIN}/${normalized} is already taken.`,
    };
  }

  return {
    valid: true,
    normalizedSlug: normalized,
  };
}

/**
 * Generates a collision-free store slug from a store name.
 */
export function generateUniqueStoreSlug(
  storeName: string,
  existingSlugs: string[] = []
): string {
  let baseSlug = slugifyStoreName(storeName);
  if (!baseSlug || baseSlug.length < 3) {
    baseSlug = 'my-brand-store';
  }
  if (isReservedRouteSlug(baseSlug)) {
    baseSlug = `${baseSlug}-shop`;
  }

  const lowerExisting = new Set(existingSlugs.map((s) => s.toLowerCase()));
  if (!lowerExisting.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  while (lowerExisting.has(`${baseSlug}-${counter}`)) {
    counter += 1;
  }
  return `${baseSlug}-${counter}`;
}

/**
 * Builds the canonical mystore.com/<store-slug> display URL.
 */
export function buildStoreDomainUrl(slug: string): string {
  const cleanSlug = slugifyStoreName(slug);
  return `${PLATFORM_DOMAIN}/${cleanSlug}`;
}

/**
 * Builds the local in-app route path for previewing/opening the storefront.
 */
export function buildStorefrontRoute(slug: string): string {
  const cleanSlug = slugifyStoreName(slug);
  return `/${cleanSlug}`;
}
