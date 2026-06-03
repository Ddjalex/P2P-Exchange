const BASE = '/api/admin';

export function getAdminToken(): string | null {
  return localStorage.getItem('admin_token');
}

export function setAdminToken(token: string | null) {
  if (token) localStorage.setItem('admin_token', token);
  else localStorage.removeItem('admin_token');
}

export async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });
  if (res.status === 401) {
    setAdminToken(null);
    window.location.href = '/auth';
    throw new Error('Unauthorized');
  }
  return res;
}

export async function adminGet<T>(path: string): Promise<T> {
  const res = await adminFetch(path);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function adminPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await adminFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

export async function adminPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await adminFetch(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

export async function adminDelete<T>(path: string): Promise<T> {
  const res = await adminFetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
