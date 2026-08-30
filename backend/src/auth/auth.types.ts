import type { Role } from '@prisma/client';

/** Shape hydrated onto `req.user` by JwtStrategy and read by @CurrentUser(). */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

/** Signed JWT payload. `sub` is the user id, per RFC 7519. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
