import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Every guard here redirects at most once and never bounces off /login, so a
 * guard/shell redirect loop (which would hang the main thread and render a
 * permanently blank page) is structurally impossible.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Managers only. Clerks are sent to /items rather than looping to /login. */
export const managerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  if (auth.isManager()) return true;
  return router.createUrlTree(['/items']);
};
