const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) { super(message); this.name = 'ApiError'; this.status = status; this.code = code; }
}

// In-flight request deduplication map to prevent accidental infinite query storms
const activeGetRequests = new Map<string, Promise<any>>();

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();

  // Deduplicate concurrent GET requests to the exact same path
  if (method === 'GET') {
    const existing = activeGetRequests.get(path);
    if (existing) return existing as Promise<T>;
  }

  const fetchPromise = (async () => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        credentials: 'include',
        headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      });
    } catch {
      throw new ApiError(0, 'Talel server is unavailable. Please try again later.');
    } finally {
      if (method === 'GET') {
        activeGetRequests.delete(path);
      }
    }
    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status, payload?.error?.message || 'The request could not be completed.', payload?.error?.code);
    return payload as T;
  })();

  if (method === 'GET') {
    activeGetRequests.set(path, fetchPromise);
  }

  return fetchPromise;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File) => apiRequest<T>(path, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) } }),
};
