import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrls: ['./auth.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly name = signal('Dana Okafor');
  readonly email = signal('dana@demo');
  readonly password = signal('Demo1234!');
  readonly confirm = signal('Demo1234!');
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  /**
   * POST /api/auth/signup. The API decides the role — the first account on an
   * empty database is a manager, every later one a clerk — and answers 409 with
   * `field: 'email'` when the address is taken.
   */
  async submit(): Promise<void> {
    if (this.submitting()) return;
    if (!this.name().trim()) {
      this.error.set('Enter your name.');
      return;
    }
    if (this.password() !== this.confirm()) {
      this.error.set('The two passwords do not match.');
      return;
    }
    this.submitting.set(true);
    try {
      const result = await this.auth.signup(this.email(), this.password());
      if (!result.ok) {
        this.error.set(result.error ?? 'Sign up failed.');
        return;
      }
      this.error.set(null);
      await this.router.navigateByUrl('/items');
    } finally {
      this.submitting.set(false);
    }
  }

  /** Shortcut that signs in as the seeded manager account. */
  async skipSignup(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    try {
      const result = await this.auth.demoLogin('manager');
      if (!result.ok) {
        this.error.set(result.error ?? 'Sign in failed.');
        return;
      }
      await this.router.navigateByUrl('/items');
    } finally {
      this.submitting.set(false);
    }
  }
}
