import { isReservedRouteSlug, slugifyStoreName } from '../utils/domain';

export type AuthMode = 'signin' | 'signup';

export type AppRoute =
  | { name: 'landing' }
  | { name: 'login'; mode?: AuthMode }
  | { name: 'templates' }
  | { name: 'dashboard' }
  | { name: 'upgrade-plan' }
  | { name: 'admin' }
  | { name: 'store-create' }
  | { name: 'store-overview'; storeId: string }
  | { name: 'store-products'; storeId: string; initialTab?: 'overview' | 'products' | 'payments' | 'orders' }
  | { name: 'store-customize'; storeId: string }
  | { name: 'store-payments'; storeId: string }
  | { name: 'storefront'; storeSlug: string; view?: 'home' | 'products' | 'info-settings' }
  | { name: 'not-found'; path: string };

/**
 * Parses a browser pathname into a typed AppRoute.
 * Supports platform routes (/dashboard, /login, /store/*), public /shop/:storeSlug,
 * and canonical subpath storefronts (/<store-slug>, matching mystore.com/<store-slug>).
 */
export function parseRoute(pathname: string, search = ''): AppRoute {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { name: 'landing' };
  }

  const [first, second, third, fourth] = segments;

  if (first === 'login' && segments.length === 1) {
    const params = new URLSearchParams(search);
    const modeParam = params.get('mode');
    return {
      name: 'login',
      mode: modeParam === 'signup' ? 'signup' : 'signin',
    };
  }

  if (first === 'templates' && segments.length === 1) {
    return { name: 'templates' };
  }

  if (first === 'upgrade-plan' && segments.length === 1) {
    return { name: 'upgrade-plan' };
  }

  if (first === 'admin' && segments.length === 1) {
    return { name: 'admin' };
  }

  if (first === 'store') {
    if (second === 'new' && segments.length === 2) {
      return { name: 'store-create' };
    }
    if (second) {
      if (segments.length === 2) {
        return { name: 'store-overview', storeId: second };
      }
      if (third === 'products' && segments.length === 3) {
        const tabParam = new URLSearchParams(search).get('tab');
        const initialTab =
          tabParam === 'overview' ||
          tabParam === 'products' ||
          tabParam === 'payments' ||
          tabParam === 'orders'
            ? tabParam
            : undefined;
        return { name: 'store-products', storeId: second, initialTab };
      }
      if (third === 'customize' && segments.length === 3) {
        return { name: 'store-customize', storeId: second };
      }
      if (third === 'payments' && segments.length === 3) {
        return { name: 'store-payments', storeId: second };
      }
    }
    return { name: 'not-found', path: cleanPath };
  }

  if (first === 'shop' && second) {
    if (segments.length === 2) {
      return { name: 'storefront', storeSlug: slugifyStoreName(second), view: 'home' };
    }
    if (segments.length === 3 && third === 'products') {
      return { name: 'storefront', storeSlug: slugifyStoreName(second), view: 'products' };
    }
    if (segments.length === 3 && third === 'information-settings') {
      return { name: 'storefront', storeSlug: slugifyStoreName(second), view: 'info-settings' };
    }
  }

  if (first === 'dashboard') {
    if (segments.length === 1) {
      return { name: 'dashboard' };
    }
    if (second === 'upgrade-plan' && segments.length === 2) {
      return { name: 'upgrade-plan' };
    }
    if (second === 'stores' && third === 'new' && segments.length === 3) {
      return { name: 'store-create' };
    }
    if (second === 'stores' && third) {
      if (segments.length === 3) {
        return { name: 'store-overview', storeId: third };
      }
      if (fourth === 'products' && segments.length === 4) {
        return { name: 'store-products', storeId: third };
      }
      if (fourth === 'customize' && segments.length === 4) {
        return { name: 'store-customize', storeId: third };
      }
      if (fourth === 'payments' && segments.length === 4) {
        return { name: 'store-payments', storeId: third };
      }
    }
    return { name: 'not-found', path: cleanPath };
  }

  // Single-segment non-reserved path resolves to a tenant storefront: mystore.com/<store-slug>
  if (segments.length === 1 && !isReservedRouteSlug(first)) {
    return { name: 'storefront', storeSlug: slugifyStoreName(first), view: 'home' };
  }

  if (segments.length === 2 && second === 'products' && !isReservedRouteSlug(first)) {
    return { name: 'storefront', storeSlug: slugifyStoreName(first), view: 'products' };
  }

  if (segments.length === 2 && second === 'information-settings' && !isReservedRouteSlug(first)) {
    return { name: 'storefront', storeSlug: slugifyStoreName(first), view: 'info-settings' };
  }

  return { name: 'not-found', path: cleanPath };
}

export function buildRoutePath(route: AppRoute): string {
  switch (route.name) {
    case 'landing':
      return '/';
    case 'login':
      return route.mode === 'signup' ? '/login?mode=signup' : '/login';
    case 'templates':
      return '/templates';
    case 'dashboard':
      return '/dashboard';
    case 'upgrade-plan':
      return '/upgrade-plan';
    case 'admin':
      return '/admin';
    case 'store-create':
      return '/store/new';
    case 'store-overview':
      return `/store/${route.storeId}`;
    case 'store-products':
      return route.initialTab
        ? `/store/${route.storeId}/products?tab=${route.initialTab}`
        : `/store/${route.storeId}/products`;
    case 'store-customize':
      return `/store/${route.storeId}/customize`;
    case 'store-payments':
      return `/store/${route.storeId}/payments`;
    case 'storefront':
      if (route.view === 'products') return `/${route.storeSlug}/products`;
      if (route.view === 'info-settings') return `/${route.storeSlug}/information-settings`;
      return `/${route.storeSlug}`;
    case 'not-found':
      return route.path;
  }
}
