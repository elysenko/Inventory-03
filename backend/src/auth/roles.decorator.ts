import { SetMetadata, CustomDecorator } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts an endpoint to the listed roles. An authenticated caller holding a
 * different role gets 403 — never 401, which is reserved for "not signed in".
 */
export const Roles = (...roles: Role[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
