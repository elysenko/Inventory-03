import { Injectable, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../shared/api/api-client.service';
import { AuthApi, AuthResponse } from '../shared/api/auth-api.service';
import { Role } from './models';
import { clearSession, readToken, sessionUser, writeSession, writeUser } from './session';

/** The seeded demo accounts (api/prisma/seed.ts). */
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_EMAIL: Record<Role, string> = { manager: 'manager@demo', clerk: 'clerk@demo' };

export interface AuthResult {
  ok: boolean;
  error?: string;
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'Something went wrong.';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly api = inject(AuthApi);

  /**
   * Restored synchronously from storage so the route guards can decide on the
   * very first navigation — an async check would bounce a deep-linked, signed-in
   * user to /login before the token had a chance to be validated.
   */
  readonly user = sessionUser.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isManager = computed(() => this.user()?.role === 'manager');

  constructor() {
    void this.revalidate();
  }

  /**
   * Confirms the stored token against GET /api/auth/me and picks up a role
   * change made server-side. Only a 401 signs the user out: a network failure
   * or a 5xx must not evict a session the server would still honour.
   */
  private async revalidate(): Promise<void> {
    if (!readToken()) return;
    try {
      writeUser(await this.api.me());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clearSession();
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const invalid = this.validate(email, password);
    if (invalid) return { ok: false, error: invalid };
    try {
      this.adopt(await this.api.login(email.trim(), password));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describe(error) };
    }
  }

  async signup(email: string, password: string): Promise<AuthResult> {
    const invalid = this.validate(email, password);
    if (invalid) return { ok: false, error: invalid };
    try {
      this.adopt(await this.api.signup(email.trim(), password));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describe(error) };
    }
  }

  /** Signs in as a seeded demo account rather than faking a client-side session. */
  demoLogin(role: Role = 'manager'): Promise<AuthResult> {
    return this.login(DEMO_EMAIL[role], DEMO_PASSWORD);
  }

  /**
   * Swaps role by signing in as the other seeded account, so the token really
   * carries that role and the API enforces it. The user is sent to /items
   * because the route they are on may now be manager-only.
   */
  async switchRole(role: Role): Promise<AuthResult> {
    const result = await this.demoLogin(role);
    if (result.ok) await this.router.navigateByUrl('/items');
    return result;
  }

  /** Logout is a client-side token discard — the JWT is stateless. */
  logout(): void {
    clearSession();
    void this.router.navigate(['/login']);
  }

  private adopt(response: AuthResponse): void {
    writeSession(response.accessToken, response.user);
  }

  private validate(email: string, password: string): string | null {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) return 'Enter both an email address and a password.';
    if (!/^[^\s@]+@[^\s@]+$/.test(cleanEmail)) return 'Enter a valid email address.';
    return null;
  }
}
