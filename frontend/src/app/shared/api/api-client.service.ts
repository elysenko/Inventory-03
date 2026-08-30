import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

/** The envelope every paginated list endpoint returns. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * A normalised API failure.
 *
 * `field` carries the server's field-scoped 409s (duplicate SKU, duplicate
 * location name) so a form can attach the message to the offending control
 * instead of dumping it in a page-level banner.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly field: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Resolves the REST prefix from the document's <base href>, so the same bundle
 * works served at the origin root (`/api`) or under a path prefix
 * (`/<prefix>/api`). nginx proxies that prefix to the NestJS container.
 */
export function resolveApiBase(): string {
  if (typeof document === 'undefined') return '/api';
  const href = document.querySelector('base')?.getAttribute('href') ?? '/';
  return `${href.replace(/\/+$/, '')}/api`;
}

/** Turns an HttpErrorResponse into an ApiError with a human-readable message. */
function normalise(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(0, error instanceof Error ? error.message : String(error));
  }
  // status 0 means the request never reached the server (offline / DNS / CORS).
  if (error.status === 0) {
    return new ApiError(0, 'The StockRoom API is unreachable. Check that the server is running.');
  }

  const body: unknown = error.error;
  let message = `Request failed with status ${error.status}.`;
  let field: string | null = null;

  if (typeof body === 'string' && body.trim().length > 0) {
    message = body;
  } else if (body !== null && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const raw = record['message'];
    // class-validator returns an array of messages; Nest's own filters a string.
    if (Array.isArray(raw)) message = raw.map((entry) => String(entry)).join(' ');
    else if (typeof raw === 'string' && raw.trim().length > 0) message = raw;
    if (typeof record['field'] === 'string') field = record['field'];
  }

  return new ApiError(error.status, message, field);
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  readonly base = resolveApiBase();

  get<T>(path: string, query?: Query): Promise<T> {
    return this.run(this.http.get<T>(this.url(path), { params: this.params(query) }));
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.run(this.http.post<T>(this.url(path), body ?? {}));
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.run(this.http.patch<T>(this.url(path), body ?? {}));
  }

  delete<T>(path: string): Promise<T> {
    return this.run(this.http.delete<T>(this.url(path)));
  }

  private url(path: string): string {
    return `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /** Empty values are dropped so `?q=` never reaches the server as a filter. */
  private params(query?: Query): HttpParams {
    let params = new HttpParams();
    if (!query) return params;
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === '') continue;
      params = params.set(key, String(value));
    }
    return params;
  }

  private async run<T>(source: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(source);
    } catch (error) {
      throw normalise(error);
    }
  }
}

/** The message to show a user for any thrown API failure. */
export function describeError(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}
