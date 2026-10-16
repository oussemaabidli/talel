import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { ToastContainer } from './components/ui';
import { SellerLayout } from './layouts/SellerLayout';
import { api } from './api/client';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const SellerStatusPage = lazy(() => import('./pages/SellerStatusPage'));
const SellerDashboard = lazy(() => import('./pages/seller/SellerDashboard'));
const SellerRequests = lazy(() => import('./pages/seller/SellerRequests'));
const SellerRequestDetail = lazy(() => import('./pages/seller/SellerRequestDetail'));
const SellerCreateOffer = lazy(() => import('./pages/seller/SellerCreateOffer'));
const SellerOffers = lazy(() => import('./pages/seller/SellerOffers'));
const SellerOrders = lazy(() => import('./pages/seller/SellerOrders'));
const SellerOrderDetail = lazy(() => import('./pages/seller/SellerOrderDetail'));
const SellerInventory = lazy(() => import('./pages/seller/SellerInventory'));
const SellerSales = lazy(() => import('./pages/seller/SellerSales'));
const SellerMessages = lazy(() => import('./pages/seller/SellerMessages'));
const SellerNotifications = lazy(() => import('./pages/seller/SellerNotifications'));
const SellerProfile = lazy(() => import('./pages/seller/SellerProfile'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-text-secondary">Loading...</p>
    </div>
  </div>
);

const AppRoutes: React.FC = () => {
  const { isAuthenticated, login, logout, updateSeller } = useStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<{ data: { id: string; email: string; profile?: { name: string; shopName: string; description: string; address: string | null; city: string | null; specialties: string[]; verificationStatus?: string } | null } }>('/auth/me')
      .then(({ data }) => {
        if (active) {
          login('seller', data.profile?.verificationStatus === 'verified');
          if (data.profile) {
            updateSeller({
              id: data.id,
              name: data.profile.name,
              email: data.email,
              shopName: data.profile.shopName,
              shopDescription: data.profile.description,
              address: data.profile.address || '',
              city: data.profile.city || '',
              specialties: data.profile.specialties,
              isVerified: data.profile.verificationStatus === 'verified'
            });
          }
        }
      })
      .catch(() => {
        // A local mock session must never keep protected pages available without a server session.
        logout();
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => { active = false; };
  }, [login, logout, updateSeller]);

  if (!authChecked) return <PageLoader />;

  return (
    <Routes>
      <Route path="/" element={
        isAuthenticated ? <Navigate to="/seller/dashboard" replace /> : <LoginPage />
      } />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/seller/dashboard" replace /> : <RegisterPage />} />
      <Route path="/seller/status" element={<SellerStatusPage />} />

      <Route path="/seller" element={isAuthenticated ? <SellerLayout /> : <Navigate to="/" replace />}>
        <Route index element={<Navigate to="dashboard" />} />
        <Route path="dashboard" element={<SellerDashboard />} />
        <Route path="requests" element={<SellerRequests />} />
        <Route path="requests/:id" element={<SellerRequestDetail />} />
        <Route path="requests/:id/offer" element={<SellerCreateOffer />} />
        <Route path="offers" element={<SellerOffers />} />
        <Route path="orders" element={<SellerOrders />} />
        <Route path="orders/:id" element={<SellerOrderDetail />} />
        <Route path="inventory" element={<SellerInventory />} />
        <Route path="sales" element={<SellerSales />} />
        <Route path="messages" element={<SellerMessages />} />
        <Route path="notifications" element={<SellerNotifications />} />
        <Route path="profile" element={<SellerProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <ToastContainer />
    <Suspense fallback={<PageLoader />}><AppRoutes /></Suspense>
  </BrowserRouter>
);

export default App;

