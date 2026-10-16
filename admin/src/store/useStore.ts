// ============================================
// AutoParts Pro - Zustand Store
// ============================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  UserRole, SparePartRequest, Offer, Order, Transaction,
  Conversation, Message, Notification, InventoryItem, Category,
  ActivityLog, Client, Seller, RequestStatus, OfferStatus, OrderStatus
} from '../types';
import {
  mockRequests, mockOffers, mockOrders, mockTransactions,
  mockConversations, mockClientNotifications, mockSellerNotifications,
  mockInventory, mockCategories, mockActivityLogs,
  mockClient, mockSeller, mockClients, mockSellers
} from '../data/mockData';

interface AppState {
  // Auth
  currentRole: UserRole;
  isAuthenticated: boolean;
  setRole: (role: UserRole) => void;
  login: (role: UserRole) => void;
  logout: () => void;

  // Clients & Sellers
  clients: Client[];
  sellers: Seller[];
  currentClient: Client;
  currentSeller: Seller;
  updateClient: (client: Partial<Client>) => void;
  updateSeller: (seller: Partial<Seller>) => void;
  toggleUserStatus: (userId: string) => void;

  // Requests
  requests: SparePartRequest[];
  addRequest: (request: SparePartRequest) => void;
  updateRequest: (id: string, updates: Partial<SparePartRequest>) => void;
  updateRequestStatus: (id: string, status: RequestStatus) => void;
  deleteRequest: (id: string) => void;

  // Offers
  offers: Offer[];
  addOffer: (offer: Offer) => void;
  updateOffer: (id: string, updates: Partial<Offer>) => void;
  updateOfferStatus: (id: string, status: OfferStatus) => void;
  acceptOffer: (offerId: string) => void;
  rejectOffer: (offerId: string) => void;

  // Orders
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  updateOrderStatus: (id: string, status: OrderStatus) => void;

  // Transactions
  transactions: Transaction[];
  transactionPagination: { page: number; limit: number; total: number };
  transactionTotals: { grossOrderValueTnd: string; completedOrderValueTnd: string; cancelledOrderValueTnd: string; orderCount: number };
  addTransaction: (transaction: Transaction) => void;

  // Conversations & Messages
  conversations: Conversation[];
  addMessage: (conversationId: string, message: Message) => void;
  addConversation: (conversation: Conversation) => void;
  markConversationRead: (conversationId: string) => void;

  // Notifications
  clientNotifications: Notification[];
  sellerNotifications: Notification[];
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (role: UserRole) => void;
  deleteNotification: (id: string) => void;

  // Inventory
  inventory: InventoryItem[];
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;

  // Categories
  categories: Category[];
  addCategory: (category: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  // Activity Logs
  activityLogs: ActivityLog[];
  addActivityLog: (log: ActivityLog) => void;

  // Toast
  toasts: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ---------- Auth ----------
      currentRole: 'client',
      isAuthenticated: false,
      setRole: (role) => set({ currentRole: role }),
      login: (role) => set({ currentRole: role, isAuthenticated: true }),
      logout: () => set({ isAuthenticated: false }),

      // ---------- Users ----------
      clients: mockClients,
      sellers: mockSellers,
      currentClient: mockClient,
      currentSeller: mockSeller,
      updateClient: (updates) => set((state) => ({
        currentClient: { ...state.currentClient, ...updates },
        clients: state.clients.map(c => c.id === state.currentClient.id ? { ...c, ...updates } : c)
      })),
      updateSeller: (updates) => set((state) => ({
        currentSeller: { ...state.currentSeller, ...updates },
        sellers: state.sellers.map(s => s.id === state.currentSeller.id ? { ...s, ...updates } : s)
      })),
      toggleUserStatus: (userId) => set((state) => ({
        clients: state.clients.map(c => c.id === userId ? { ...c, isActive: !c.isActive } : c),
        sellers: state.sellers.map(s => s.id === userId ? { ...s, isActive: !s.isActive } : s),
      })),

      // ---------- Requests ----------
      requests: mockRequests,
      addRequest: (request) => set((state) => {
        const logs = [...state.activityLogs, {
          id: `log-${Date.now()}`,
          userId: request.clientId,
          userName: request.clientName,
          userRole: 'client' as UserRole,
          action: 'Created Request',
          details: `Request #${request.id} - ${request.partName} for ${request.vehicle.brand} ${request.vehicle.model} ${request.vehicle.year}`,
          timestamp: new Date().toISOString(),
        }];
        return { requests: [request, ...state.requests], activityLogs: logs };
      }),
      updateRequest: (id, updates) => set((state) => ({
        requests: state.requests.map(r => r.id === id ? { ...r, ...updates } : r)
      })),
      updateRequestStatus: (id, status) => set((state) => ({
        requests: state.requests.map(r => r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r)
      })),
      deleteRequest: (id) => set((state) => ({
        requests: state.requests.filter(r => r.id !== id)
      })),

      // ---------- Offers ----------
      offers: mockOffers,
      addOffer: (offer) => set((state) => {
        // Update request offers count
        const requests = state.requests.map(r => {
          if (r.id === offer.requestId) {
            const newStatus = r.status === 'published' ? 'offers_received' : r.status;
            return { ...r, offersCount: r.offersCount + 1, status: newStatus };
          }
          return r;
        });

        // Add notification for client
        const request = state.requests.find(r => r.id === offer.requestId);
        const notification: Notification = {
          id: `notif-${Date.now()}`,
          userId: request?.clientId || '',
          type: 'offer_received',
          title: 'New Offer Received',
          message: `${offer.sellerShop} sent you an offer for ${offer.partName}`,
          link: `/client/offers/${offer.id}`,
          isRead: false,
          createdAt: new Date().toISOString(),
        };

        const logs = [...state.activityLogs, {
          id: `log-${Date.now()}`,
          userId: offer.sellerId,
          userName: offer.sellerName,
          userRole: 'seller' as UserRole,
          action: 'Sent Offer',
          details: `Offer #${offer.id} for Request #${offer.requestId}`,
          timestamp: new Date().toISOString(),
        }];

        return {
          offers: [offer, ...state.offers],
          requests,
          clientNotifications: [notification, ...state.clientNotifications],
          activityLogs: logs
        };
      }),
      updateOffer: (id, updates) => set((state) => ({
        offers: state.offers.map(o => o.id === id ? { ...o, ...updates } : o)
      })),
      updateOfferStatus: (id, status) => set((state) => ({
        offers: state.offers.map(o => o.id === id ? { ...o, status } : o)
      })),

      acceptOffer: (offerId) => {
        const state = get();
        const offer = state.offers.find(o => o.id === offerId);
        if (!offer) return;

        const request = state.requests.find(r => r.id === offer.requestId);
        if (!request) return;

        // Create order
        const orderId = `ORD-${1000 + state.orders.length + 1}`;
        const now = new Date().toISOString();
        const newOrder: Order = {
          id: orderId,
          requestId: offer.requestId,
          offerId: offer.id,
          clientId: request.clientId,
          clientName: request.clientName,
          sellerId: offer.sellerId,
          sellerName: offer.sellerName,
          sellerShop: offer.sellerShop,
          partName: offer.partName,
          partBrand: offer.partBrand,
          referenceNumber: offer.referenceNumber,
          condition: offer.condition,
          quantity: offer.quantity,
          price: offer.price,
          deliveryCost: offer.deliveryCost,
          totalAmount: offer.price + offer.deliveryCost,
          deliveryMethod: offer.deliveryMethod,
          location: request.location,
          status: 'offer_accepted',
          timeline: [
            { status: 'offer_accepted', label: 'Offer Accepted', date: now, completed: true },
            { status: 'seller_confirmed', label: 'Seller Confirmed', date: '', completed: false },
            { status: 'preparing', label: 'Preparing', date: '', completed: false },
            { status: 'ready', label: 'Ready', date: '', completed: false },
            { status: 'delivery', label: 'Delivery', date: '', completed: false },
            { status: 'completed', label: 'Completed', date: '', completed: false },
          ],
          createdAt: now,
          updatedAt: now,
        };

        // Create transaction
        const txn: Transaction = {
          id: `TXN-${3000 + state.transactions.length + 1}`,
          orderId,
          clientId: request.clientId,
          clientName: request.clientName,
          sellerId: offer.sellerId,
          sellerName: offer.sellerName,
          amount: newOrder.totalAmount,
          platformFee: Math.round(newOrder.totalAmount * 0.05),
          sellerAmount: newOrder.totalAmount - Math.round(newOrder.totalAmount * 0.05),
          status: 'pending',
          createdAt: now,
        };

        // Seller notification
        const sellerNotif: Notification = {
          id: `notif-s${Date.now()}`,
          userId: offer.sellerId,
          type: 'offer_accepted',
          title: 'Offer Accepted!',
          message: `Your offer for ${offer.partName} has been accepted. New order #${orderId} created.`,
          link: `/seller/orders/${orderId}`,
          isRead: false,
          createdAt: now,
        };

        const log: ActivityLog = {
          id: `log-${Date.now()}`,
          userId: request.clientId,
          userName: request.clientName,
          userRole: 'client',
          action: 'Accepted Offer',
          details: `Offer #${offerId} accepted → Order #${orderId} created`,
          timestamp: now,
        };

        set({
          offers: state.offers.map(o => o.id === offerId ? { ...o, status: 'accepted' as OfferStatus } : o),
          requests: state.requests.map(r => r.id === offer.requestId ? { ...r, status: 'offer_accepted' as RequestStatus } : r),
          orders: [newOrder, ...state.orders],
          transactions: [txn, ...state.transactions],
          sellerNotifications: [sellerNotif, ...state.sellerNotifications],
          activityLogs: [log, ...state.activityLogs],
        });
      },

      rejectOffer: (offerId) => set((state) => ({
        offers: state.offers.map(o => o.id === offerId ? { ...o, status: 'rejected' as OfferStatus } : o)
      })),

      // ---------- Orders ----------
      orders: mockOrders,
      addOrder: (order) => set((state) => ({
        orders: [order, ...state.orders]
      })),
      updateOrder: (id, updates) => set((state) => ({
        orders: state.orders.map(o => o.id === id ? { ...o, ...updates } : o)
      })),
      updateOrderStatus: (id, newStatus) => set((state) => {
        const now = new Date().toISOString();
        const statusOrder: OrderStatus[] = ['offer_accepted', 'seller_confirmed', 'preparing', 'ready', 'delivery', 'completed'];
        const statusIndex = statusOrder.indexOf(newStatus);

        const orders = state.orders.map(o => {
          if (o.id !== id) return o;
          const timeline = o.timeline.map((t, i) => {
            if (i <= statusIndex) {
              return { ...t, completed: true, date: t.date || now };
            }
            return t;
          });
          return { ...o, status: newStatus, timeline, updatedAt: now };
        });

        // Update transaction status
        const transactions = state.transactions.map(t => {
          if (t.orderId === id) {
            if (newStatus === 'completed') return { ...t, status: 'completed' as const };
            if (newStatus !== 'offer_accepted') return { ...t, status: 'processing' as const };
          }
          return t;
        });

        const order = state.orders.find(o => o.id === id);
        const log: ActivityLog = {
          id: `log-${Date.now()}`,
          userId: order?.sellerId || '',
          userName: order?.sellerName || '',
          userRole: 'seller',
          action: newStatus === 'completed' ? 'Completed Order' : `Updated Order to ${newStatus.replace('_', ' ')}`,
          details: `Order #${id}`,
          timestamp: now,
        };

        // Client notification
        const typeMap: Record<string, Notification['type']> = {
          'seller_confirmed': 'order_confirmed',
          'preparing': 'order_preparing',
          'ready': 'order_ready',
          'delivery': 'order_shipped',
          'completed': 'order_completed',
        };
        const messageMap: Record<string, string> = {
          'seller_confirmed': `Your order #${id} has been confirmed by the seller`,
          'preparing': `Your order #${id} is now being prepared`,
          'ready': `Your order #${id} is ready for delivery/pickup`,
          'delivery': `Your order #${id} has been shipped`,
          'completed': `Order #${id} has been completed. Thank you!`,
        };

        let clientNotifications = state.clientNotifications;
        if (typeMap[newStatus] && order) {
          const notif: Notification = {
            id: `notif-${Date.now()}`,
            userId: order.clientId,
            type: typeMap[newStatus],
            title: messageMap[newStatus].split(' ').slice(0, 3).join(' '),
            message: messageMap[newStatus],
            link: `/client/orders/${id}`,
            isRead: false,
            createdAt: now,
          };
          clientNotifications = [notif, ...clientNotifications];
        }

        // If completed, update request status too
        let requests = state.requests;
        if (newStatus === 'completed' && order) {
          requests = requests.map(r =>
            r.id === order.requestId ? { ...r, status: 'completed' as RequestStatus } : r
          );
        }

        return { orders, transactions, activityLogs: [log, ...state.activityLogs], clientNotifications, requests };
      }),

      // ---------- Transactions ----------
      transactions: mockTransactions,
      transactionPagination: { page: 1, limit: 50, total: mockTransactions.length },
      transactionTotals: { grossOrderValueTnd: '0', completedOrderValueTnd: '0', cancelledOrderValueTnd: '0', orderCount: mockTransactions.length },
      addTransaction: (transaction) => set((state) => ({
        transactions: [transaction, ...state.transactions]
      })),

      // ---------- Conversations ----------
      conversations: mockConversations,
      addMessage: (conversationId, message) => set((state) => ({
        conversations: state.conversations.map(c => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            messages: [...c.messages, message],
            lastMessage: message.content,
            lastMessageTime: message.timestamp,
          };
        })
      })),
      addConversation: (conversation) => set((state) => ({
        conversations: [conversation, ...state.conversations]
      })),
      markConversationRead: (conversationId) => set((state) => ({
        conversations: state.conversations.map(c => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            unreadCount: 0,
            messages: c.messages.map(m => ({ ...m, isRead: true }))
          };
        })
      })),

      // ---------- Notifications ----------
      clientNotifications: mockClientNotifications,
      sellerNotifications: mockSellerNotifications,
      addNotification: (notification) => set((state) => {
        if (notification.userId.startsWith('client')) {
          return { clientNotifications: [notification, ...state.clientNotifications] };
        }
        return { sellerNotifications: [notification, ...state.sellerNotifications] };
      }),
      markNotificationRead: (id) => set((state) => ({
        clientNotifications: state.clientNotifications.map(n => n.id === id ? { ...n, isRead: true } : n),
        sellerNotifications: state.sellerNotifications.map(n => n.id === id ? { ...n, isRead: true } : n),
      })),
      markAllNotificationsRead: (role) => set((state) => {
        if (role === 'client') {
          return { clientNotifications: state.clientNotifications.map(n => ({ ...n, isRead: true })) };
        }
        return { sellerNotifications: state.sellerNotifications.map(n => ({ ...n, isRead: true })) };
      }),
      deleteNotification: (id) => set((state) => ({
        clientNotifications: state.clientNotifications.filter(n => n.id !== id),
        sellerNotifications: state.sellerNotifications.filter(n => n.id !== id),
      })),

      // ---------- Inventory ----------
      inventory: mockInventory,
      addInventoryItem: (item) => set((state) => ({
        inventory: [item, ...state.inventory]
      })),
      updateInventoryItem: (id, updates) => set((state) => ({
        inventory: state.inventory.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i)
      })),
      deleteInventoryItem: (id) => set((state) => ({
        inventory: state.inventory.filter(i => i.id !== id)
      })),

      // ---------- Categories ----------
      categories: mockCategories,
      addCategory: (category) => set((state) => ({
        categories: [...state.categories, category]
      })),
      updateCategory: (id, updates) => set((state) => ({
        categories: state.categories.map(c => c.id === id ? { ...c, ...updates } : c)
      })),
      deleteCategory: (id) => set((state) => ({
        categories: state.categories.filter(c => c.id !== id)
      })),

      // ---------- Activity Logs ----------
      activityLogs: mockActivityLogs,
      addActivityLog: (log) => set((state) => ({
        activityLogs: [log, ...state.activityLogs]
      })),

      // ---------- Toast ----------
      toasts: [],
      addToast: (type, message) => {
        const id = `toast-${Date.now()}`;
        set((state) => ({
          toasts: [...state.toasts, { id, type, message }]
        }));
        setTimeout(() => {
          set((state) => ({
            toasts: state.toasts.filter(t => t.id !== id)
          }));
        }, 4000);
      },
      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
      })),
    }),
    {
      name: 'autoparts-pro-store',
      version: 2,
      migrate: () => ({} as AppState),
      partialize: (state) => ({ currentRole: state.currentRole, isAuthenticated: false }),
    }
  )
);

