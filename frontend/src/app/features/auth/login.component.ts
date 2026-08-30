import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./auth.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly email = signal('manager@demo');
  readonly password = signal('Demo1234!');
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  useAccount(email: string): void {
    this.email.set(email);
    this.password.set('Demo1234!');
    this.error.set(null);
  }

  /** Exchanges the credentials for a real bearer token at POST /api/auth/login. */
  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    try {
      const result = await this.auth.login(this.email(), this.password());
      if (!result.ok) {
        this.error.set(result.error ?? 'Sign in failed.');
        return;
      }
      this.error.set(null);
      await this.go();
    } finally {
      this.submitting.set(false);
    }
  }

  /** Shortcut that signs in as the seeded manager account. */
  async skipLogin(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    try {
      const result = await this.auth.demoLogin('manager');
      if (!result.ok) {
        this.error.set(result.error ?? 'Sign in failed.');
        return;
      }
      this.error.set(null);
      await this.go();
    } finally {
      this.submitting.set(false);
    }
  }

  /** Honours ?returnUrl= so a deep link survives the sign-in detour. */
  private async go(): Promise<void> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    await this.router.navigateByUrl(returnUrl && !returnUrl.startsWith('/login') ? returnUrl : '/items');
  }
}
