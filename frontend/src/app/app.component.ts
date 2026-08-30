import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from './core/auth.service';

interface NavEntry {
  label: string;
  short: string;
  path: string;
  icon: string;
  managerOnly: boolean;
  testId: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly drawerOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Auth screens render standalone — no shell chrome around them. */
  readonly isAuthScreen = computed(() => /^\/(login|signup)\b/.test(this.url()));

  // Plain array, not a signal<T[]>: nav config is UI structure, never API data.
  readonly navEntries: readonly NavEntry[] = [
    { label: 'Items', short: 'Items', path: '/items', icon: '▦', managerOnly: false, testId: 'nav-items' },
    { label: 'Locations', short: 'Places', path: '/locations', icon: '⌂', managerOnly: false, testId: 'nav-locations' },
    { label: 'Record movement', short: 'Record', path: '/movements/new', icon: '↹', managerOnly: false, testId: 'nav-movement-new' },
    { label: 'Movement log', short: 'Log', path: '/movements', icon: '☰', managerOnly: true, testId: 'nav-movements' },
    { label: 'Low stock', short: 'Low', path: '/reports/low-stock', icon: '⚠', managerOnly: true, testId: 'nav-low-stock' },
    { label: 'Admin settings', short: 'Admin', path: '/admin/settings', icon: '⚙', managerOnly: true, testId: 'nav-admin-settings' },
  ];

  readonly visibleNav = computed(() =>
    this.navEntries.filter((entry) => !entry.managerOnly || this.auth.isManager()),
  );

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  onSwitchRole(): void {
    this.auth.switchRole(this.auth.isManager() ? 'clerk' : 'manager');
    this.closeDrawer();
  }

  onLogout(): void {
    this.closeDrawer();
    this.auth.logout();
  }
}
