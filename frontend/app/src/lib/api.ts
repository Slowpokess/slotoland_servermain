export class HttpError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.payload = payload;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  auth?: boolean;
  tokenType?: 'access' | 'refresh';
  headers?: HeadersInit;
}

export interface ApiTokens {
  accessToken: string;
  refreshToken: string;
}

export function normalizeBase(value: string): string {
  return String(value || '').replace(/\/+$/, '');
}

export function apiUrl(baseUrl: string, path: string): string {
  return `${normalizeBase(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  tokens: ApiTokens,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false) {
    const token = options.tokenType === 'refresh' ? tokens.refreshToken : tokens.accessToken;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(apiUrl(baseUrl, path), {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const rawText = await response.text();
  let payload: any = {};
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { raw: rawText };
    }
  }

  if (!response.ok) {
    throw new HttpError(payload?.what || `Request failed with status ${response.status}`, response.status, payload);
  }

  return payload as T;
}
