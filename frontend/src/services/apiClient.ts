const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface ApiErrorBody {
  message?: string;
  detail?: string;
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('nutrikids.accessToken');
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body: ApiErrorBody | null = await response.json().catch(() => null);
    throw new ApiError(
      body?.message || body?.detail || '요청을 처리하지 못했어요.',
      response.status,
      body,
    );
  }

  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}
