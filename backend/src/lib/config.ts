import { HttpException, HttpStatus } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Sentinel written by the platform when a credential slot exists but has not
 * been filled in. Treated exactly like "absent".
 */
export const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

/**
 * Some platform-provisioned services expose their credentials under a
 * different env var name than the canonical settings key. Each canonical key
 * may therefore fall back to one or more aliases before the DB is consulted.
 */
export const ENV_ALIASES: Readonly<Record<string, readonly string[]>> = {
  MINIO_ACCESS_KEY: ['MINIO_ROOT_USER'],
  MINIO_SECRET_KEY: ['MINIO_ROOT_PASSWORD'],
  DATABASE_URL: ['POSTGRES_URL'],
};

/** A value is usable only when it is a non-empty, non-placeholder string. */
export function isUsable(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value !== PLACEHOLDER;
}

/** Reads the canonical env var, then any alias, returning the first usable hit. */
export function resolveEnv(key: string): string | null {
  const direct = process.env[key];
  if (isUsable(direct)) return direct;
  for (const alias of ENV_ALIASES[key] ?? []) {
    const aliased = process.env[alias];
    if (isUsable(aliased)) return aliased;
  }
  return null;
}

/**
 * Resolves a configuration value with this priority:
 *   1. environment variable (or a known alias) set at deploy time
 *   2. the `SystemSetting` row written from the admin settings screen
 *   3. `null` — the feature is unconfigured
 *
 * Callers must degrade gracefully on `null` (throw `ServiceUnconfiguredError`,
 * which maps to HTTP 503). A missing third-party credential must never crash
 * the process at boot.
 */
export async function resolveConfig(
  key: string,
  prisma?: PrismaService,
): Promise<string | null> {
  const fromEnv = resolveEnv(key);
  if (fromEnv !== null) return fromEnv;
  if (!prisma) return null;
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    return isUsable(row?.value) ? row!.value : null;
  } catch {
    // The settings table is an optional convenience — never let it break a request.
    return null;
  }
}

/** Thrown when a feature is invoked before its credentials exist. Maps to 503. */
export class ServiceUnconfiguredError extends HttpException {
  constructor(key: string, service?: string) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unconfigured',
        message: service
          ? `${service} is not configured. Set ${key} in Admin → Settings to enable this feature.`
          : `${key} is not configured. Set it in Admin → Settings to enable this feature.`,
        key,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
