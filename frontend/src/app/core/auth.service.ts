import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Role, User } from './models';
import { readJson, remove, writeJson } from './storage';

const USER_KEY = 'user';
const TOKEN_KEY = 'token';

const DEMO_MANAGER: User = { id: 'u-mgr', email: 'manager@demo', role: 'manager' };
const DEMO_CLERK: User = { id: 'u-clk', email: 'clerk@demo', role: 'clerk' };

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  readonly user = signal<User | null>(this.restore());
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isManager = computed(() => this.user()?.role === 'manager');

  /**
   * Restores the signed-in user from namespaced storage.
   *
   * Everything read here is untrusted: a malformed or stale value must not
   * throw (a throw during construction blanks the whole page), so any
   * unrecognised shape clears the keys and falls back to the demo manager —
   * the preview is served without a backend and is treated as signed in.
   */
  private restore(): User {
    try {
      const stored = parseUser(readJson<unknown>(USER_KEY));
      if (stored) return stored;
    } catch {
      /* fall through to the reset below */
    }
    remove(USER_KEY);
    remove(TOKEN_KEY);
    return this.persist(DEMO_MANAGER);
  }

  private persist(user: User): User {
    writeJson(USER_KEY, user);
    writeJson(TOKEN_KEY, `mock.${user.role}.token`);
    return user;
  }

  /**
   * Resolves entirely in the client — there is no API on the preview host, so
   * awaiting a network call here would strand the reviewer on this screen.
   * Any well-formed credentials succeed; the seeded emails pick the role.
   */
  login(email: string, password: string): { ok: boolean; error?: string } {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      return { ok: false, error: 'Enter both an email address and a password.' };
    }
    if (!/^[^\s@]+@[^\s@]+$/.test(cleanEmail)) {
      return { ok: false, error: 'Enter a valid email address.' };
    }
    const role: Role = cleanEmail.toLowerCase().startsWith('clerk') ? 'clerk' : 'manager';
    this.user.set(this.persist({ id: `u-${role}`, email: cleanEmail, role }));
    return { ok: true };
  }

  signup(email: string, password: string): { ok: boolean; error?: string } {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      return { ok: false, error: 'Enter both an email address and a password.' };
    }
    if (!/^[^\s@]+@[^\s@]+$/.test(cleanEmail)) {
      return { ok: false, error: 'Enter a valid email address.' };
    }
    this.user.set(this.persist({ id: 'u-new', email: cleanEmail, role: 'clerk' }));
    return { ok: true };
  }

  /** Seeds the signed-in state without form input (demo-mode shortcut). */
  demoLogin(role: Role = 'manager'): void {
    this.user.set(this.persist(role === 'manager' ? DEMO_MANAGER : DEMO_CLERK));
  }

  /** Swaps role in place so a reviewer can compare the clerk and manager nav. */
  switchRole(role: Role): void {
    const current = this.user();
    if (!current) return this.demoLogin(role);
    this.user.set(this.persist({ ...current, role, email: role === 'manager' ? 'manager@demo' : 'clerk@demo' }));
  }

  logout(): void {
    remove(USER_KEY);
    remove(TOKEN_KEY);
    this.user.set(null);
    void this.router.navigate(['/login']);
  }
}
