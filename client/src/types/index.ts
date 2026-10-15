// ============================================
// AutoParts Pro - Type Definitions
// ============================================

// ---------- Enums ----------
export type UserRole = 'client' | 'seller' | 'host';

export type RequestStatus = 'draft' | 'published' | 'offers_received' | 'offer_accepted' | 'in_progress' | 'completed' | 'cancelled';

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export type OrderStatus = 'offer_accepted' | 'seller_confirmed' | 'preparing' | 'ready' | 'delivery' | 'completed' | 'cancelled';

export type PartCondition = 'new' | 'used' | 'either';

export type DeliveryMethod = 'delivery' | 'pickup' | 'both';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'refunded' | 'failed';

export type NotificationType = 'offer_received' | 'offer_accepted' | 'offer_rejected' | 'order_confirmed' | 'order_preparing' | 'order_ready' | 'order_shipped' | 'order_completed' | 'request_published' | 'new_request' | 'system';

// ---------- Core Entities ----------
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastActive: string;
}

export interface Client extends User {
  role: 'client';
  address: string;
  city: string;
  savedVehicles: Vehicle[];
  totalRequests: number;
  totalOrders: number;
}

export interface Seller extends User {
  role: 'seller';
  shopName: string;
  shopDescription: string;
  shopLogo: string;
  address: string;
  city: string;
  rating: number;
  totalReviews: number;
  totalSales: number;
  revenue: number;
  responseRate: number;
  responseTime: string;
  specialties: string[];
  joinedAt: string;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  engine: string;
  image?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  isActive: boolean;
  partCount: number;
}

export interface SparePartRequest {
  id: string;
  clientId: string;
  clientName: string;
  vehicle: Vehicle;
  category: string;
  partName: string;
  referenceNumber?: string;
  quantity: number;
  condition: PartCondition;
  description: string;
  images: string[];
  additionalRequirements?: string;
  minBudget: number;
  maxBudget: number;
  deliveryMethod: DeliveryMethod;
  location: string;
  status: RequestStatus;
  offersCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  requestId: string;
  sellerId: string;
  sellerName: string;
  sellerShop: string;
  sellerRating: number;
  sellerReviews: number;
  sellerVerified: boolean;
  sellerAvatar: string;
  partName: string;
  partBrand: string;
  referenceNumber: string;
  condition: PartCondition;
  price: number;
  quantity: number;
  availability: string;
  warranty: string;
  deliveryMethod: DeliveryMethod;
  deliveryCost: number;
  deliveryTime: string;
  description: string;
  images: string[];
  status: OfferStatus;
  createdAt: string;
  expiresAt: string;
}

export interface OrderTimelineEvent {
  status: OrderStatus;
  label: string;
  date: string;
  description?: string;
  completed: boolean;
}

export interface Order {
  id: string;
  requestId: string;
  offerId: string;
  clientId: string;
  clientName: string;
  sellerId: string;
  sellerName: string;
  sellerShop: string;
  partName: string;
  partBrand: string;
  referenceNumber: string;
  condition: PartCondition;
  quantity: number;
  price: number;
  deliveryCost: number;
  totalAmount: number;
  deliveryMethod: DeliveryMethod;
  location: string;
  status: OrderStatus;
  timeline: OrderTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  orderId: string;
  clientId: string;
  clientName: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  platformFee: number;
  sellerAmount: number;
  status: TransactionStatus;
  createdAt: string;
}

export interface Message {
  id: string;
  contextType: 'request' | 'order';
  contextId: string;
  contextLabel: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  contextType: 'request' | 'order';
  contextId: string;
  contextLabel: string;
  participants: { id: string; name: string; role: UserRole; avatar: string }[];
  messages: Message[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  sellerId: string;
  partName: string;
  category: string;
  brand: string;
  referenceNumber: string;
  compatibleVehicles: string[];
  condition: PartCondition;
  price: number;
  quantity: number;
  warranty: string;
  images: string[];
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  timestamp: string;
}

// ---------- Dashboard Stats ----------
export interface ClientStats {
  activeRequests: number;
  offersReceived: number;
  ordersInProgress: number;
  completedOrders: number;
  activeRequestsChange: number;
  offersReceivedChange: number;
  ordersInProgressChange: number;
  completedOrdersChange: number;
}

export interface SellerStats {
  newRequests: number;
  activeOffers: number;
  pendingOrders: number;
  completedOrders: number;
  totalSales: number;
  revenue: number;
  newRequestsChange: number;
  activeOffersChange: number;
  pendingOrdersChange: number;
  completedOrdersChange: number;
}

export interface HostStats {
  totalUsers: number;
  totalClients: number;
  totalSellers: number;
  totalRequests: number;
  totalOrders: number;
  completedOrders: number;
  totalSales: number;
  platformRevenue: number;
}

// ---------- Chart Data ----------
export interface ChartDataPoint {
  name: string;
  value: number;
  value2?: number;
}

// ---------- Form Types ----------
export interface RequestFormData {
  vehicle: Vehicle | null;
  category: string;
  partName: string;
  referenceNumber: string;
  quantity: number;
  condition: PartCondition;
  description: string;
  images: string[];
  additionalRequirements: string;
  minBudget: number;
  maxBudget: number;
  deliveryMethod: DeliveryMethod;
  location: string;
}

export interface OfferFormData {
  requestId: string;
  partName: string;
  partBrand: string;
  referenceNumber: string;
  condition: PartCondition;
  price: number;
  quantity: number;
  availability: string;
  warranty: string;
  deliveryMethod: DeliveryMethod;
  deliveryCost: number;
  deliveryTime: string;
  description: string;
  images: string[];
}

export interface InventoryFormData {
  partName: string;
  category: string;
  brand: string;
  referenceNumber: string;
  compatibleVehicles: string[];
  condition: PartCondition;
  price: number;
  quantity: number;
  warranty: string;
  images: string[];
  description: string;
}

