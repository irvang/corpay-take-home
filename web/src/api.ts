import type { ApiErrorBody } from './types.ts';

const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.status = status;
    this.body = body;
  }
}

export class NetworkError extends Error {}

export async function apiFetch<T>(userId: number | null, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (userId !== null) headers.set('X-Demo-User', String(userId));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;

  try {
    res = await fetch(path, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError('No response from the server');
  } finally {
    clearTimeout(timer);
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const fallback = {
      error: {
        code: `HTTP_${res.status}`,
        message: res.statusText,
      },
    };
    throw new ApiError(res.status, body?.error ? body : fallback);
  }

  return body as T;
}
