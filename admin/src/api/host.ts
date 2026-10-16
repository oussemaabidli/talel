import type { ActivityLog, Category, Client, Offer, Order, Seller, SparePartRequest, Transaction } from '../types';
import { useStore } from '../store/useStore';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

export class HostApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function hostApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new HostApiError(body?.error?.message ?? 'Host API request failed.', response.status);
  return body?.data as T;
}

export async function hydrateHostStore() {
  const [rawUsers, rawSellers, rawRequests, rawOffers, rawOrders, rawTransactions, categories, rawActivity] = await Promise.all([
    hostApi<any[]>('/host/users?role=CLIENT'), hostApi<any[]>('/host/sellers'), hostApi<any[]>('/host/requests'),
    hostApi<any[]>('/host/offers'), hostApi<any[]>('/host/orders'), hostApi<any>('/host/transactions?page=1&limit=50'),
    hostApi<Category[]>('/host/categories'), hostApi<any[]>('/host/activity'),
  ]);
  const clients = rawUsers.map((u): Client => ({ id: u.id, name: u.clientProfile?.name ?? u.email, email: u.email, phone: u.clientProfile?.phone ?? u.phone ?? '', avatar: '', role: 'client', isVerified: false, isActive: u.isActive, createdAt: u.createdAt, lastActive: u.createdAt, address: u.clientProfile?.address ?? '', city: u.clientProfile?.city ?? '', savedVehicles: Array.isArray(u.clientProfile?.vehicles) ? u.clientProfile.vehicles : [], totalRequests: 0, totalOrders: u._count.orders }));
  const sellers = rawSellers.map((u): Seller => ({ id: u.id, name: u.profile?.name ?? u.email, email: u.email, phone: u.phone ?? '', avatar: '', role: 'seller', isVerified: u.profile?.verificationStatus === 'verified', isActive: u.isActive, createdAt: u.createdAt, lastActive: u.createdAt, shopName: u.profile?.shopName ?? u.email, shopDescription: u.profile?.description ?? '', shopLogo: '', address: u.profile?.address ?? '', city: u.profile?.city ?? '', rating: 0, totalReviews: 0, totalSales: u._count.orders, revenue: Number(u.completedRevenueTnd ?? 0), responseRate: 0, responseTime: '', specialties: u.profile?.specialties ?? [], joinedAt: u.createdAt }));
  const requests = rawRequests.map((r): SparePartRequest => ({ id: r.id, clientId: r.clientId ?? '', clientName: r.clientId ?? 'Unknown buyer', vehicle: { id: '', brand: r.vehicleMake ?? '', model: r.vehicleModel ?? '', year: r.vehicleYear ?? 0, engine: '' }, category: r.category, partName: r.partName, referenceNumber: r.oemReference ?? '', quantity: r.quantity, condition: r.condition.toLowerCase(), description: r.description, images: [], minBudget: Number(r.minBudget ?? 0), maxBudget: Number(r.maxBudget ?? 0), deliveryMethod: r.deliveryMethod ?? 'delivery', location: r.location ?? '', status: r.status.toLowerCase(), offersCount: r._count.offers, createdAt: r.createdAt, updatedAt: r.updatedAt } as SparePartRequest));
  const offers = rawOffers.map((o): Offer => ({ id: o.id, requestId: o.requestId, sellerId: o.sellerId, sellerName: o.seller.profile?.name ?? o.seller.email, sellerShop: o.seller.profile?.shopName ?? o.seller.email, sellerRating: 0, sellerReviews: 0, sellerVerified: o.seller.profile?.verificationStatus === 'verified', sellerAvatar: '', partName: o.partName, partBrand: o.brand, referenceNumber: o.referenceNumber, condition: o.condition.toLowerCase(), price: Number(o.price), quantity: o.quantity, availability: '', warranty: o.warranty, deliveryMethod: 'delivery', deliveryCost: Number(o.deliveryFee), deliveryTime: o.estimatedDelivery, description: o.description, images: [], status: o.status.toLowerCase(), createdAt: o.createdAt, expiresAt: '' }));
  const orders = rawOrders.map((o): Order => ({ id: o.id, requestId: o.requestId, offerId: o.offerId, clientId: o.request.clientId ?? '', clientName: o.request.clientId ?? 'Unknown buyer', sellerId: o.sellerId, sellerName: o.offer.seller.profile?.name ?? o.offer.seller.email, sellerShop: o.offer.seller.profile?.shopName ?? o.offer.seller.email, partName: o.offer.partName, partBrand: o.offer.brand, referenceNumber: o.offer.referenceNumber, condition: o.offer.condition.toLowerCase(), quantity: o.offer.quantity, price: Number(o.offer.price), deliveryCost: Number(o.offer.deliveryFee), totalAmount: Number(o.totalAmount), deliveryMethod: o.request.deliveryMethod ?? 'delivery', location: o.request.location ?? '', status: o.status === 'DISPATCHED' ? 'delivery' : o.status.toLowerCase(), timeline: o.events.map((e: any) => ({ status: e.status === 'DISPATCHED' ? 'delivery' : e.status.toLowerCase(), label: e.status, date: e.createdAt, completed: true })), createdAt: o.createdAt, updatedAt: o.updatedAt } as Order));
  const transactions = rawTransactions.items.map((t: any): Transaction => ({ id: t.id, orderId: t.orderId, clientId: t.clientId ?? '', clientName: t.clientName, sellerId: t.sellerId, sellerName: t.sellerName, amount: Number(t.amountTnd), platformFee: 0, sellerAmount: Number(t.amountTnd), status: t.status.toLowerCase() as Transaction['status'], createdAt: t.createdAt }));
  const activityLogs = rawActivity.map((a): ActivityLog => ({ id: a.id, userId: a.actorId, userName: a.actor.email, userRole: 'host', action: a.action, details: `${a.entityType} ${a.entityId}`, timestamp: a.createdAt }));
  useStore.setState({ clients, sellers, requests, offers, orders, transactions, categories, activityLogs, transactionPagination: rawTransactions.pagination, transactionTotals: rawTransactions.totals });
}

export async function loadHostTransactions(page: number, status = 'all') {
  const statusParam = status === 'all' ? '' : `&status=${encodeURIComponent(status.toUpperCase())}`;
  const result = await hostApi<any>(`/host/transactions?page=${page}&limit=50${statusParam}`);
  const transactions = result.items.map((t: any): Transaction => ({ id: t.id, orderId: t.orderId, clientId: t.clientId ?? '', clientName: t.clientName, sellerId: t.sellerId, sellerName: t.sellerName, amount: Number(t.amountTnd), platformFee: 0, sellerAmount: Number(t.amountTnd), status: t.status.toLowerCase() as Transaction['status'], createdAt: t.createdAt }));
  useStore.setState({ transactions, transactionPagination: result.pagination, transactionTotals: result.totals });
}

export async function hostLogin(email: string, password: string) {
  return hostApi<{ user: { id: string; email: string; role: 'HOST' } }>('/host/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export type HostSellerDocument = {
  id: string; kind: string; originalName: string; mimeType: string; size: number;
  status: 'pending' | 'approved' | 'rejected'; rejectionReason: string | null;
  submittedAt: string; reviewedAt: string | null; reviewer?: { email: string } | null;
};

type HostDocumentReviewResult = {
  id: string; sellerId: string; kind: string; status: 'approved' | 'rejected'; rejectionReason: string | null; reviewedAt: string | null;
};

export type HostRegistration = {
  id: string;
  email: string;
  phone: string | null;
  role: 'CLIENT' | 'SELLER';
  isActive: boolean;
  createdAt: string;
  clientProfile: null | { name: string; phone: string | null; address: string | null; city: string | null; vehicles: unknown };
  profile: null | {
    name: string; shopName: string; legalName: string | null; commercialName: string | null; legalForm: string | null;
    rneNumber: string | null; taxIdentifier: string | null; address: string | null; city: string | null; governorate: string | null;
    postalCode: string | null; businessPhone: string | null; businessEmail: string | null; website: string | null;
    categories: string[]; productsSold: string | null; salesType: string | null; locationType: string | null;
    experienceYears: number | null; businessHours: string | null; supportedMakes: string[]; specialties: string[];
    paymentTerms: string[]; description: string; verificationStatus: string; verificationRejectionReason: string | null;
  };
};

export async function getHostRegistration(userId: string) {
  return hostApi<HostRegistration>(`/host/users/${encodeURIComponent(userId)}/registration`);
}

export async function listSellerDocuments(sellerId: string) {
  return hostApi<HostSellerDocument[]>(`/host/sellers/${encodeURIComponent(sellerId)}/documents`);
}

export async function reviewSellerDocument(sellerId: string, documentId: string, status: 'approved' | 'rejected', rejectionReason?: string) {
  return hostApi<HostDocumentReviewResult>(
    `/host/sellers/${encodeURIComponent(sellerId)}/documents/${encodeURIComponent(documentId)}/review`,
    { method: 'PATCH', body: JSON.stringify({ status, ...(rejectionReason ? { rejectionReason } : {}) }) },
  );
}

export async function downloadSellerDocument(sellerId: string, documentId: string) {
  const response = await fetch(`${API_BASE}/host/sellers/${encodeURIComponent(sellerId)}/documents/${encodeURIComponent(documentId)}/file`, { credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new HostApiError(body?.error?.message ?? 'Unable to download document.', response.status);
  }
  return response.blob();
}
