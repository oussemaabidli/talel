import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { ToastContainer } from './components/ui';
import { ClientLayout } from './layouts/ClientLayout';
import { clientApiRoutes, clientAuth } from './api/client';

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
  const { isAuthenticated, login, logout, updateClient, hydrateClientData, addToast } = useStore();
  const [sessionChecked, setSessionChecked] = useState(false);
  useEffect(() => {
    clientAuth.me().then(async ({ id, email, clientProfile }: any) => {
      updateClient({ id, email, name: clientProfile?.name ?? '', phone: clientProfile?.phone ?? '', city: clientProfile?.city ?? '', address: clientProfile?.address ?? '', savedVehicles: clientProfile?.vehicles ?? [] });
      login('client');
      try {
      const [rawRequests, rawOffers, rawOrders, rawNotifications, rawConversations] = await Promise.all([clientApiRoutes.requests(), clientApiRoutes.offers(), clientApiRoutes.orders(), clientApiRoutes.notifications(), clientApiRoutes.conversations()]);
      const requests = rawRequests.map((r: any) => ({ ...r, clientName: clientProfile?.name ?? '', vehicle: { id: r.id, brand: r.vehicleMake ?? '', model: r.vehicleModel ?? '', year: r.vehicleYear ?? 0, engine: '' }, referenceNumber: r.oemReference, status: String(r.status).toLowerCase(), minBudget: Number(r.minBudget ?? 0), maxBudget: Number(r.maxBudget ?? 0), offersCount: r._count?.offers ?? 0, images: [] }));
      const offerMap = (o: any) => ({ ...o, sellerName: o.seller?.profile?.shopName ?? '', sellerShop: o.seller?.profile?.shopName ?? 'Seller', sellerRating: 0, sellerReviews: 0, sellerVerified: o.seller?.profile?.verificationStatus === 'verified', sellerAvatar: '', partBrand: o.brand ?? '', referenceNumber: o.referenceNumber ?? '', condition: String(o.condition).toLowerCase(), price: Number(o.price), deliveryCost: Number(o.deliveryFee ?? 0), deliveryTime: o.estimatedDelivery ?? '', availability: 'Available', deliveryMethod: 'delivery', images: [], expiresAt: '', status: String(o.status).toLowerCase(), request: o.request });
      const offers = rawOffers.map(offerMap);
      const orders = rawOrders.map((o: any) => ({ ...o, clientId: id, clientName: clientProfile?.name ?? '', sellerName: o.seller?.profile?.shopName ?? '', sellerShop: o.seller?.profile?.shopName ?? 'Seller', partName: o.request?.partName ?? '', partBrand: o.offer?.brand ?? '', referenceNumber: o.offer?.referenceNumber ?? '', condition: String(o.offer?.condition ?? 'EITHER').toLowerCase(), quantity: o.offer?.quantity ?? 1, price: Number(o.offer?.price ?? 0), deliveryCost: Number(o.offer?.deliveryFee ?? 0), totalAmount: Number(o.totalAmount), deliveryMethod: o.request?.deliveryMethod ?? 'delivery', location: o.request?.location ?? '', status: String(o.status).toLowerCase().replace('dispatched','delivery'), timeline: (o.events ?? []).map((event: any) => ({ status: String(event.status).toLowerCase().replace('dispatched','delivery'), label: String(event.status).replaceAll('_',' '), date: event.createdAt, description: event.note, completed: true })) }));
      const clientNotifications = rawNotifications.map((n: any) => ({ ...n, isRead: !!n.readAt }));
      const conversations = await Promise.all(rawConversations.map(async (c: any) => {
        const rawMessages = await clientApiRoutes.messages(c.id);
        const participants = c.participants.map((p: any) => ({ id: p.user.id, name: p.user.clientProfile?.name ?? p.user.profile?.shopName ?? p.user.profile?.name ?? 'Talel member', role: String(p.user.role).toLowerCase(), avatar: '' }));
        const contextType = (c.orderId ? 'order' : 'request') as 'order'|'request';
        const messages = rawMessages.map((m: any) => { const sender = participants.find((p: any) => p.id === m.senderId); return { id: m.id, contextType, contextId: c.orderId ?? c.requestId ?? c.id, contextLabel: c.request?.partName ?? `Order ${c.orderId ?? ''}`, senderId: m.senderId, senderName: sender?.name ?? 'Talel member', senderRole: sender?.role ?? 'seller', senderAvatar: '', content: m.body, timestamp: m.createdAt, isRead: true }; });
        return { id: c.id, contextType, contextId: c.orderId ?? c.requestId ?? c.id, contextLabel: c.request?.partName ?? `Order ${c.orderId ?? ''}`, participants, messages, lastMessage: messages.at(-1)?.content ?? '', lastMessageTime: messages.at(-1)?.timestamp ?? c.createdAt, unreadCount: 0 };
      }));
      hydrateClientData({ requests, offers, orders, clientNotifications, conversations });
      } catch (error) {
        hydrateClientData({ requests: [], offers: [], orders: [], clientNotifications: [], conversations: [] });
        if ((error as { status?: number })?.status === 401) logout();
        else addToast('error', error instanceof Error ? error.message : 'Could not load your account data. Please retry.');
      }
    }).catch(() => logout()).finally(() => setSessionChecked(true));
  }, [login, logout, updateClient, hydrateClientData, addToast]);

  return (
    <BrowserRouter>
      <ToastContainer />
      <Suspense fallback={<PageLoader />}>
        {!sessionChecked ? <PageLoader /> : <Routes>
          <Route path="/" element={
            isAuthenticated ? <Navigate to="/client/dashboard" /> : <LoginPage />
          } />

          <Route path="/client" element={isAuthenticated ? <ClientLayout /> : <Navigate to="/" replace />}>
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
        </Routes>}
      </Suspense>
    </BrowserRouter>
  );
};

export default App;

