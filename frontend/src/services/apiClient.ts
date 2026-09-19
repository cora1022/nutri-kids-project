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

interface ValidationDetail {
  loc?: (string | number)[];
  msg?: string;
}

interface ApiErrorBody {
  message?: unknown;
  detail?: unknown;
}

const DEFAULT_ERROR_MESSAGE = '요청을 처리하지 못했어요.';

// FastAPI 기본 422 응답은 detail이 객체 배열이라 그대로 Error에 넣으면 "[object Object]"가 된다.
export function resolveErrorMessage(body: ApiErrorBody | null): string {
  if (!body) return DEFAULT_ERROR_MESSAGE;
  if (typeof body.message === 'string' && body.message) return body.message;
  if (typeof body.detail === 'string' && body.detail) return body.detail;
  if (Array.isArray(body.detail)) {
    const lines = (body.detail as ValidationDetail[])
      .filter((item) => typeof item?.msg === 'string')
      .map((item) => {
        const field = (item.loc ?? []).filter((part) => part !== 'body').join('.');
        return field ? `${field}: ${item.msg}` : String(item.msg);
      });
    if (lines.length) return lines.join('\n');
  }
  return DEFAULT_ERROR_MESSAGE;
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
    throw new ApiError(resolveErrorMessage(body), response.status, body);
  }

  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}
