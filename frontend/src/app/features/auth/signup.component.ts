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

  submit(): void {
    if (!this.name().trim()) {
      this.error.set('Enter your name.');
      return;
    }
    if (this.password() !== this.confirm()) {
      this.error.set('The two passwords do not match.');
      return;
    }
    const result = this.auth.signup(this.email(), this.password());
    if (!result.ok) {
      this.error.set(result.error ?? 'Sign up failed.');
      return;
    }
    this.error.set(null);
    void this.router.navigateByUrl('/items');
  }

  skipSignup(): void {
    this.auth.demoLogin('manager');
    void this.router.navigateByUrl('/items');
  }
}
