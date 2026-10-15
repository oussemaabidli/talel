import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { ToastContainer } from './components/ui';
import { ClientLayout } from './layouts/ClientLayout';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const ClientRequests = lazy(() => import('./pages/client/ClientRequests'));
const ClientRequestDetail = lazy(() => import('./pages/client/ClientRequestDetail'));
const ClientCreateRequest = lazy(() => import('./pages/client/ClientCreateRequest'));
const ClientOffers = lazy(() => import('./pages/client/ClientOffers'));
const ClientOfferDetail = lazy(() => import('./pages/client/ClientOfferDetail'));
const ClientOrders = lazy(() => import('./pages/client/ClientOrders'));
const ClientOrderDetail = lazy(() => import('./pages/client/ClientOrderDetail'));
const ClientMessages = lazy(() => import('./pages/client/ClientMessages'));
const ClientNotifications = lazy(() => import('./pages/client/ClientNotifications'));
const ClientProfile = lazy(() => import('./pages/client/ClientProfile'));

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

  return (
    <BrowserRouter>
      <ToastContainer />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={
            isAuthenticated ? <Navigate to="/client/dashboard" /> : <LoginPage />
          } />

          <Route path="/client" element={<ClientLayout />}>
            <Route index element={<Navigate to="dashboard" />} />
            <Route path="dashboard" element={<ClientDashboard />} />
            <Route path="requests" element={<ClientRequests />} />
            <Route path="requests/new" element={<ClientCreateRequest />} />
            <Route path="requests/:id" element={<ClientRequestDetail />} />
            <Route path="offers" element={<ClientOffers />} />
            <Route path="offers/:id" element={<ClientOfferDetail />} />
            <Route path="orders" element={<ClientOrders />} />
            <Route path="orders/:id" element={<ClientOrderDetail />} />
            <Route path="messages" element={<ClientMessages />} />
            <Route path="notifications" element={<ClientNotifications />} />
            <Route path="profile" element={<ClientProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;

