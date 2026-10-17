export const CLIENT_API_BASE = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

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

export async function clientApiBlob(path: string): Promise<Blob> {
  const response = await fetch(`${CLIENT_API_BASE}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload?.error?.message ?? 'The photo could not be loaded.', response.status, payload?.error?.code);
  }
  return response.blob();
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
  createRequest: (input: unknown, idempotencyKey: string) => clientApi<any>('/client/requests', { method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': idempotencyKey } }),
  uploadRequestPhoto: (file: File) => clientApi<{ id: string; originalName: string; mimeType: string; size: number }>('/client/request-photos', { method: 'POST', body: file, headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) } }),
  deleteRequestPhoto: (id: string) => clientApi<void>(`/client/request-photos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  requestPhoto: (requestId: string, imageId: string) => clientApiBlob(`/client/requests/${encodeURIComponent(requestId)}/images/${encodeURIComponent(imageId)}`),
  editRequest: (id: string, input: unknown) => clientApi<any>(`/client/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  cancelRequest: (id: string, reason?: string) => clientApi<any>(`/client/requests/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  offers: () => clientApi<any[]>('/client/offers'),
  acceptOffer: (id: string) => clientApi<any>(`/client/offers/${encodeURIComponent(id)}/accept`, { method: 'POST' }),
  rejectOffer: (id: string) => clientApi<any>(`/client/offers/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
  offerConversation: (id: string) => clientApi<any>(`/client/offers/${encodeURIComponent(id)}/conversation`, { method: 'POST' }),
  orders: () => clientApi<any[]>('/client/orders'),
  order: (id: string) => clientApi<any>(`/client/orders/${encodeURIComponent(id)}`),
  cancelOrder: (id: string) => clientApi<any>(`/client/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  profile: (input: unknown) => clientApi<any>('/client/profile', { method: 'PATCH', body: JSON.stringify(input) }),
  categories: () => clientApi<Array<{id: string; name: string; description: string; icon: string}>>('/client/categories'),
  governorates: () => clientApi<string[]>('/client/governorates'),
  startSupportConversation: () => clientApi<{ id: string; type: 'SUPPORT'; createdAt: string }>('/client/support/conversation', { method: 'POST' }),
  supportConversation: () => clientApi<{ id: string; type: 'SUPPORT'; createdAt: string } | null>('/client/support/conversation'),
  supportMessages: () => clientApi<any[]>('/client/support/conversation/messages'),
  sendSupportMessage: (body: string) => clientApi<any>('/client/support/conversation/messages', { method: 'POST', body: JSON.stringify({ body }) }),
  conversations: () => clientApi<any[]>('/client/conversations'),
  messages: (id: string) => clientApi<any[]>(`/client/conversations/${encodeURIComponent(id)}/messages`),
  sendMessage: (id: string, body: string) => clientApi<any>(`/client/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  notifications: () => clientApi<any[]>('/client/notifications'),
  markRead: (id: string) => clientApi<void>(`/client/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  markAllRead: () => clientApi<any>('/client/notifications/read-all', { method: 'PATCH' }),
};
