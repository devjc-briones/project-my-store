/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StoreProvider, useStore } from './context/StoreContext';
import { Roles } from './types/schema';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { StoreCustomizerPage } from './pages/StoreCustomizerPage';
import { StoreProductsManagerPage } from './pages/StoreProductsManagerPage';
import { PublicStorefrontPage } from './pages/PublicStorefrontPage';
import { UpgradePlanPage } from './pages/UpgradePlanPage';
import { AdminPage } from './pages/AdminPage';
import { ToastContainer } from './components/common/ToastContainer';

function AppRouter() {
  const { route, state } = useStore();

  if (route.name === 'storefront') {
    return <PublicStorefrontPage />;
  }

  if (route.name === 'admin') {
    return <AdminPage />;
  }

  if (route.name === 'login') {
    return <AuthPage />;
  }

  if (
    route.name === 'dashboard' ||
    route.name === 'upgrade-plan' ||
    route.name === 'store-create' ||
    route.name === 'store-overview' ||
    route.name === 'store-products' ||
    route.name === 'store-customize' ||
    route.name === 'store-payments'
  ) {
    if (!state.currentUser) {
      return <AuthPage />;
    }
    if (
      state.currentUser.role === Roles.Admin &&
      (route.name === 'dashboard' || route.name === 'upgrade-plan' || route.name === 'store-create')
    ) {
      return <AdminPage />;
    }
    if (route.name === 'dashboard') {
      return <DashboardPage />;
    }
    if (route.name === 'upgrade-plan') {
      return <UpgradePlanPage />;
    }
    if (route.name === 'store-create' || route.name === 'store-customize') {
      return <StoreCustomizerPage />;
    }
    return <StoreProductsManagerPage />;
  }

  return <LandingPage />;
}

export default function App() {
  return (
    <StoreProvider>
      <AppRouter />
      <ToastContainer />
    </StoreProvider>
  );
}
