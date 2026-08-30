import { Injectable, inject } from '@angular/core';
import { User } from '../../core/models';
import { ApiClient } from './api-client.service';

export interface AuthResponse {
  accessToken: string;
  user: User;
}

/** POST /api/auth/login · POST /api/auth/signup · GET /api/auth/me */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly api = inject(ApiClient);

  login(email: string, password: string): Promise<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', { email, password });
  }

  signup(email: string, password: string): Promise<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/signup', { email, password });
  }

  /** Rehydrates the session on boot; a 401 here means the stored token is stale. */
  me(): Promise<User> {
    return this.api.get<User>('/auth/me');
  }
}
