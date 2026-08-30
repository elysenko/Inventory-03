/**
 * Namespaced browser storage.
 *
 * Mockups are served many-per-origin at /<mockup_id>/ and storage is
 * origin-scoped (not path-scoped), so every key is prefixed with the mockup's
 * base path segment using a colon separator: `<mockup_id>:user`.
 *
 * When the app is served at the root the first path segment is an app route
 * (e.g. /items), which would make the namespace change as the user navigates.
 * `resolveNamespace` therefore falls back to a stable literal in that case.
 */
const APP_ROUTE_SEGMENTS = new Set([
  '',
  'login',
  'signup',
  'items',
  'locations',
  'movements',
  'reports',
  'admin',
]);

function resolveNamespace(): string {
  if (typeof location === 'undefined') return 'app';
  const segment = location.pathname.split('/')[1] ?? '';
  return APP_ROUTE_SEGMENTS.has(segment) ? 'app' : segment;
}

export const NS = resolveNamespace();

/** Prefixes a storage key with this mockup's namespace. */
export const nsKey = (key: string): string => `${NS}:${key}`;

/** Base href segment, used so router links work under /<mockup_id>/. */
export const baseSegment = (): string => (NS === 'app' ? '' : `/${NS}`);

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(nsKey(key));
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(nsKey(key), JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — the mockup still works */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(nsKey(key));
  } catch {
    /* ignore */
  }
}
