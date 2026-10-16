export const CLIENT_API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code; }
}

export async function clientApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${CLIENT_API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body && !(options.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload?.error?.message ?? 'The request failed.', response.status, payload?.error?.code);
  return payload.data as T;
}

export const clientAuth = {
  me: () => clientApi<any>('/client/auth/me'),
  login: (email: string, password: string) => clientApi<any>('/client/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (input: { email: string; password: string; name: string; phone?: string }) => clientApi<any>('/client/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => clientApi<void>('/client/auth/logout', { method: 'POST' }),
};
export const clientApiRoutes = {
  requests: () => clientApi<any[]>('/client/requests'),
  request: (id: string) => clientApi<any>(`/client/requests/${encodeURIComponent(id)}`),
  createRequest: (input: unknown) => clientApi<any>('/client/requests', { method: 'POST', body: JSON.stringify(input) }),
  editRequest: (id: string, input: unknown) => clientApi<any>(`/client/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  cancelRequest: (id: string) => clientApi<any>(`/client/requests/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  offers: () => clientApi<any[]>('/client/offers'),
  acceptOffer: (id: string) => clientApi<any>(`/client/offers/${encodeURIComponent(id)}/accept`, { method: 'POST' }),
  rejectOffer: (id: string) => clientApi<any>(`/client/offers/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
  offerConversation: (id: string) => clientApi<any>(`/client/offers/${encodeURIComponent(id)}/conversation`, { method: 'POST' }),
  orders: () => clientApi<any[]>('/client/orders'),
  order: (id: string) => clientApi<any>(`/client/orders/${encodeURIComponent(id)}`),
  cancelOrder: (id: string) => clientApi<any>(`/client/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  profile: (input: unknown) => clientApi<any>('/client/profile', { method: 'PATCH', body: JSON.stringify(input) }),
  categories: () => clientApi<Array<{id: string; name: string; description: string; icon: string}>>('/client/categories'),
  conversations: () => clientApi<any[]>('/client/conversations'),
  messages: (id: string) => clientApi<any[]>(`/client/conversations/${encodeURIComponent(id)}/messages`),
  sendMessage: (id: string, body: string) => clientApi<any>(`/client/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  notifications: () => clientApi<any[]>('/client/notifications'),
  markRead: (id: string) => clientApi<void>(`/client/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  markAllRead: () => clientApi<any>('/client/notifications/read-all', { method: 'PATCH' }),
};
