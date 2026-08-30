import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth.types';

/** Injects the JWT-derived user hydrated onto the request by JwtStrategy. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return request.user as AuthUser;
  },
);
