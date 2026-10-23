import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { ToastContainer } from './components/ui';
import { ClientLayout } from './layouts/ClientLayout';
import { clientApiRoutes, clientAuth } from './api/client';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
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
const ClientSupport = lazy(() => import('./pages/client/ClientSupport'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-text-secondary">Loading...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionError, setSessionError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const load = async <T,>(resource: 'requests' | 'offers' | 'orders' | 'notifications' | 'conversations', fetcher: () => Promise<T>, map: (value: T) => unknown, apply: (value: any) => void) => {
      try {
        const value = await fetcher();
        if (Array.isArray(value) === false) throw new Error(`The ${resource} service returned an invalid response.`);
        if (cancelled) return false;
        apply(map(value));
        useStore.getState().setClientResourceLoadState(resource, 'ready');
        return false;
      } catch (error) {
        if (!cancelled) useStore.getState().setClientResourceLoadState(resource, 'error', error instanceof Error ? error.message : `Could not load ${resource}.`);
        return (error as { status?: number })?.status === 401;
      }
    };
    const restore = async () => {
      try {
        const { id, email, clientProfile }: any = await clientAuth.me();
        if (!id) throw new Error('The session response was incomplete.');
        if (cancelled) return;
        useStore.getState().beginClientDataLoad();
        useStore.getState().updateClient({ id, email, name: clientProfile?.name ?? '', phone: clientProfile?.phone ?? '', city: clientProfile?.city ?? '', address: clientProfile?.address ?? '', savedVehicles: clientProfile?.vehicles ?? [] });
        useStore.getState().login('client');
        const clientName = clientProfile?.name ?? '';
        const jobs = await Promise.all([
          load('requests', clientApiRoutes.requests, (rows: any[]) => rows.map((r: any) => ({ ...r, clientName, vehicle: { id: r.id, brand: r.vehicleMake ?? '', model: r.vehicleModel ?? '', year: r.vehicleYear ?? 0, engine: r.vehicleEngine ?? '' }, referenceNumber: r.oemReference, status: String(r.status).toLowerCase(), minBudget: Number(r.minBudget ?? 0), maxBudget: Number(r.maxBudget ?? 0), offersCount: r._count?.offers ?? 0, images: (r.images ?? []).map((image: { id: string }) => image.id) })), (requests) => useStore.getState().hydrateClientData({ requests: requests as any })),
          load('offers', clientApiRoutes.offers, (rows: any[]) => rows.map((o: any) => ({ ...o, orderStatus: o.order?.status ? String(o.order.status).toLowerCase() : undefined, sellerName: o.seller?.profile?.shopName ?? '', sellerShop: o.seller?.profile?.shopName ?? 'Seller', sellerRating: 0, sellerReviews: 0, sellerVerified: o.seller?.profile?.verificationStatus === 'verified', sellerAvatar: '', partBrand: o.brand ?? '', referenceNumber: o.referenceNumber ?? '', condition: String(o.condition).toLowerCase(), price: Number(o.price), deliveryCost: Number(o.deliveryFee ?? 0), deliveryTime: o.estimatedDelivery ?? '', availability: 'Available', deliveryMethod: 'delivery', images: [], expiresAt: o.expiresAt ?? '', status: String(o.status).toLowerCase(), request: o.request ? { ...o.request, status: String(o.request.status).toLowerCase(), vehicle: { brand: o.request.vehicleMake ?? '', model: o.request.vehicleModel ?? '', year: o.request.vehicleYear ?? 0, engine: o.request.vehicleEngine ?? '' } } : undefined })), (offers) => useStore.getState().hydrateClientData({ offers: offers as any })),
          load('orders', clientApiRoutes.orders, (rows: any[]) => rows.map((o: any) => ({ ...o, clientId: id, clientName, sellerName: o.seller?.profile?.shopName ?? '', sellerShop: o.seller?.profile?.shopName ?? 'Seller', partName: o.request?.partName ?? '', partBrand: o.offer?.brand ?? '', referenceNumber: o.offer?.referenceNumber ?? '', condition: String(o.offer?.condition ?? 'EITHER').toLowerCase(), quantity: o.offer?.quantity ?? 1, price: Number(o.offer?.price ?? 0), deliveryCost: Number(o.offer?.deliveryFee ?? 0), totalAmount: Number(o.totalAmount), deliveryMethod: o.request?.deliveryMethod ?? 'delivery', location: o.request?.location ?? '', governorate: o.request?.governorate ?? '', status: String(o.status).toLowerCase().replace('dispatched','delivery'), timeline: (o.events ?? []).map((event: any) => ({ status: String(event.status).toLowerCase().replace('dispatched','delivery'), label: String(event.status).replaceAll('_',' '), date: event.createdAt, description: event.note, completed: true })) })), (orders) => useStore.getState().hydrateClientData({ orders: orders as any })),
          load('notifications', clientApiRoutes.notifications, (rows: any[]) => rows.map((n: any) => ({ ...n, isRead: !!n.readAt })), (clientNotifications) => useStore.getState().hydrateClientData({ clientNotifications: clientNotifications as any })),
          load('conversations', clientApiRoutes.conversations, (rows: any[]) => rows.map((c: any) => {
            const rawMessages = c.messages ?? [];
            const participants = c.participants.map((p: any) => ({ id: p.user.id, name: p.user.clientProfile?.name ?? p.user.profile?.shopName ?? p.user.profile?.name ?? 'Talel member', role: String(p.user.role).toLowerCase(), avatar: '' }));
            const contextType = (c.orderId ? 'order' : 'request') as 'order'|'request';
            const messages = rawMessages.map((m: any) => { const sender = participants.find((p: any) => p.id === m.senderId); return { id: m.id, contextType, contextId: c.orderId ?? c.requestId ?? c.id, contextLabel: c.request?.partName ?? `Order ${c.orderId ?? ''}`, senderId: m.senderId, senderName: sender?.name ?? 'Talel member', senderRole: sender?.role ?? 'seller', senderAvatar: '', content: m.body, timestamp: m.createdAt, isRead: true }; });
            return { id: c.id, contextType, contextId: c.orderId ?? c.requestId ?? c.id, contextLabel: c.request?.partName ?? `Order ${c.orderId ?? ''}`, participants, messages, lastMessage: messages.at(-1)?.content ?? '', lastMessageTime: messages.at(-1)?.timestamp ?? c.createdAt, unreadCount: 0 };
          }), (conversations) => useStore.getState().hydrateClientData({ conversations: conversations as any })),
        ]);
        // Only logout if a 401 was returned — don't logout on transient network/data errors
        if (!cancelled && jobs.some(Boolean)) useStore.getState().logout();
      } catch (error) {
        if (!cancelled) {
          if ((error as { status?: number })?.status === 401) useStore.getState().logout();
          else setSessionError(error instanceof Error ? error.message : 'Could not verify your session. Check your connection and retry.');
        }
      } finally { if (!cancelled) setSessionChecked(true); }
    };
    void restore();
    return () => { cancelled = true; };
  }, []);

  if (sessionError) return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><section className="card max-w-lg p-6 text-center"><h1 className="text-lg font-bold">Unable to verify your session</h1><p role="alert" className="mt-2 text-sm text-text-secondary">{sessionError}</p><button className="btn-primary mt-5" onClick={() => window.location.reload()}>Retry</button></section></main>;

  return (
    <BrowserRouter>
      <ToastContainer />
      <Suspense fallback={<PageLoader />}>
        {!sessionChecked ? <PageLoader /> : <Routes>
          <Route path="/" element={
            isAuthenticated ? <Navigate to="/client/dashboard" /> : <LoginPage />
          } />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/client/dashboard" replace /> : <RegisterPage />} />

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
            <Route path="support" element={<ClientSupport />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>}
      </Suspense>
    </BrowserRouter>
  );
};

export default App;

