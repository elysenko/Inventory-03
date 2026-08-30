import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { clearSession, readToken } from './session';

/** The two endpoints that legitimately answer 401 without the session being stale. */
const CREDENTIAL_ENDPOINTS = ['/auth/login', '/auth/signup'];

/**
 * Attaches the bearer token to every API call and treats a 401 as "the session
 * is gone": it clears the stored token and routes to /login carrying the
 * current URL, so the user lands back where they were after signing in.
 *
 * A 403 is deliberately NOT handled here — that is a live session lacking the
 * manager role, and the screen shows it as an error rather than a sign-out.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const token = readToken();

  const authorised =
    token && !CREDENTIAL_ENDPOINTS.some((path) => request.url.includes(path))
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(authorised).pipe(
    catchError((error: unknown) => {
      const isCredentialCall = CREDENTIAL_ENDPOINTS.some((path) => request.url.includes(path));
      if (error instanceof HttpErrorResponse && error.status === 401 && !isCredentialCall) {
        clearSession();
        const returnUrl = router.url;
        void router.navigate(['/login'], {
          queryParams: returnUrl && !returnUrl.startsWith('/login') ? { returnUrl } : {},
        });
      }
      return throwError(() => error);
    }),
  );
};
