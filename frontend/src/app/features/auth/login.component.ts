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

  useAccount(email: string): void {
    this.email.set(email);
    this.password.set('Demo1234!');
    this.error.set(null);
  }

  /** Resolves locally — no network call, so submitting always completes. */
  submit(): void {
    const result = this.auth.login(this.email(), this.password());
    if (!result.ok) {
      this.error.set(result.error ?? 'Sign in failed.');
      return;
    }
    this.error.set(null);
    this.go();
  }

  /** Secondary shortcut: seeds the signed-in state and jumps straight in. */
  skipLogin(): void {
    this.auth.demoLogin('manager');
    this.go();
  }

  private go(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    void this.router.navigateByUrl(returnUrl && returnUrl !== '/login' ? returnUrl : '/items');
  }
}
