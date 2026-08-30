import { signal } from '@angular/core';
import { Role, User } from './models';
import { readJson, remove, writeJson } from './storage';

const USER_KEY = 'user';
const TOKEN_KEY = 'token';

/**
 * The signed-in session.
 *
 * It lives at module scope rather than inside AuthService so the HTTP
 * interceptor can clear it on a 401 without injecting AuthService — which
 * would close a DI cycle (AuthService -> AuthApi -> HttpClient -> interceptor).
 */
export const sessionUser = signal<User | null>(readUser());

/** Narrow an untrusted parsed value to a User, or null. */
function parseUser(value: unknown): User | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<User>;
  const roleOk = candidate.role === 'clerk' || candidate.role === 'manager';
  if (typeof candidate.id !== 'string' || !candidate.id) return null;
  if (typeof candidate.email !== 'string' || !candidate.email) return null;
  if (!roleOk) return null;
  return { id: candidate.id, email: candidate.email, role: candidate.role as Role };
}

/**
 * Reads the persisted user. Everything here is untrusted: a malformed or stale
 * value must not throw (a throw at module load blanks the whole page), so any
 * unrecognised shape is treated as signed out.
 */
export function readUser(): User | null {
  try {
    return parseUser(readJson<unknown>(USER_KEY));
  } catch {
    return null;
  }
}

export function readToken(): string | null {
  const token = readJson<unknown>(TOKEN_KEY);
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/** Persists a real bearer token from POST /api/auth/login|signup. */
export function writeSession(token: string, user: User): void {
  writeJson(TOKEN_KEY, token);
  writeJson(USER_KEY, user);
  sessionUser.set(user);
}

/** Keeps the token, refreshes the user after GET /api/auth/me. */
export function writeUser(user: User): void {
  writeJson(USER_KEY, user);
  sessionUser.set(user);
}

export function clearSession(): void {
  remove(TOKEN_KEY);
  remove(USER_KEY);
  sessionUser.set(null);
}
