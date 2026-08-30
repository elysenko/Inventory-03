import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthUser } from './auth.types';

/**
 * Runs after JwtAuthGuard. A caller with a valid token but the wrong role gets
 * 403; a caller with no token has already been rejected with 401 upstream, so
 * the two failure modes are never conflated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) return false;
    if (required.includes(user.role)) return true;

    throw new ForbiddenException(
      `This action requires the ${required.join(' or ')} role.`,
    );
  }
}
