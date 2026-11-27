/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
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
import { PageLoader } from './components/common/PageLoader';
import { ToastContainer } from './components/common/ToastContainer';

function AppRouter() {
  const { route, state, isAuthChecking, navigate } = useStore();

  useEffect(() => {
    if ((route.name === 'landing' || route.name === 'login') && state.currentUser) {
      if (state.currentUser.role === Roles.Admin) {
        navigate({ name: 'admin' }, { replace: true });
      } else if (state.currentUser.role === Roles.Seller) {
        navigate({ name: 'dashboard' }, { replace: true });
      }
    }
  }, [route.name, state.currentUser, navigate]);

  if (route.name === 'storefront') {
    return <PublicStorefrontPage />;
  }

  if (route.name === 'admin') {
    if (state.currentUser?.role !== Roles.Admin && isAuthChecking) {
      return <PageLoader label="Loading admin console..." />;
    }
    return <AdminPage />;
  }

  if (route.name === 'login') {
    if (state.currentUser?.role === Roles.Admin) {
      return <AdminPage />;
    }
    if (state.currentUser?.role === Roles.Seller) {
      return <DashboardPage />;
    }
    if (isAuthChecking) {
      return <PageLoader label="Checking session..." />;
    }
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
    if (!state.currentUser || state.currentUser.role === Roles.Buyer) {
      if (isAuthChecking) {
        return <PageLoader label="Loading dashboard..." />;
      }
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

  if (state.currentUser?.role === Roles.Admin) {
    return <AdminPage />;
  }
  if (state.currentUser?.role === Roles.Seller) {
    return <DashboardPage />;
  }
  if (isAuthChecking) {
    return <PageLoader label="Loading..." />;
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
