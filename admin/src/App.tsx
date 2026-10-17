import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { ToastContainer } from './components/ui';
import { AdminLayout } from './layouts/AdminLayout';
import { hostApi, hydrateHostStore } from './api/host';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const HostOverview = lazy(() => import('./pages/admin/HostOverview'));
const HostUsers = lazy(() => import('./pages/admin/HostUsers'));
const HostClients = lazy(() => import('./pages/admin/HostClients'));
const HostSellers = lazy(() => import('./pages/admin/HostSellers'));
const HostRequests = lazy(() => import('./pages/admin/HostRequests'));
const HostOffers = lazy(() => import('./pages/admin/HostOffers'));
const HostOrders = lazy(() => import('./pages/admin/HostOrders'));
const HostTransactions = lazy(() => import('./pages/admin/HostTransactions'));
const HostReports = lazy(() => import('./pages/admin/HostReports'));
const HostCategories = lazy(() => import('./pages/admin/HostCategories'));
const HostActivity = lazy(() => import('./pages/admin/HostActivity'));
const HostSettings = lazy(() => import('./pages/admin/HostSettings'));
const HostSupport = lazy(() => import('./pages/admin/HostSupport'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-text-secondary">Loading...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const { isAuthenticated } = useStore();
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    hostApi('/host/auth/me').then(async () => {
      await hydrateHostStore();
      if (mounted) useStore.getState().login('host');
    }).catch(() => { if (mounted) useStore.getState().logout(); }).finally(() => { if (mounted) setAuthReady(true); });
    return () => { mounted = false; };
  }, []);

  return (
    <BrowserRouter>
      <ToastContainer />
      <Suspense fallback={<PageLoader />}>
        {!authReady ? <PageLoader /> : null}
        {authReady && <Routes>
          <Route path="/" element={
            isAuthenticated ? <Navigate to="/admin/overview" /> : <LoginPage />
          } />

          <Route path="/admin" element={isAuthenticated ? <AdminLayout /> : <Navigate to="/" replace />}>
            <Route index element={<Navigate to="overview" />} />
            <Route path="overview" element={<HostOverview />} />
            <Route path="users" element={<HostUsers />} />
            <Route path="clients" element={<HostClients />} />
            <Route path="sellers" element={<HostSellers />} />
            <Route path="requests" element={<HostRequests />} />
            <Route path="offers" element={<HostOffers />} />
            <Route path="orders" element={<HostOrders />} />
            <Route path="transactions" element={<HostTransactions />} />
            <Route path="reports" element={<HostReports />} />
            <Route path="categories" element={<HostCategories />} />
            <Route path="activity" element={<HostActivity />} />
            <Route path="settings" element={<HostSettings />} />
            <Route path="support" element={<HostSupport />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>}
      </Suspense>
    </BrowserRouter>
  );
};

export default App;

