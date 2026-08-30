import { Logger } from '@nestjs/common';
import type { SignOptions } from 'jsonwebtoken';

const FALLBACK_SECRET = 'stockroom-dev-secret-change-me';

/**
 * The platform always provisions JWT_SECRET. A dev fallback is used when it is
 * absent so local runs and e2e tests boot instead of crash-looping; production
 * absence is loud but still non-fatal.
 */
export function jwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.trim().length > 0) return configured;
  new Logger('Auth').warn(
    'JWT_SECRET is not set — falling back to an insecure development secret.',
  );
  return FALLBACK_SECRET;
}

/**
 * Token lifetime. Defaults to the spec's 12h when unset.
 *
 * Typed as jsonwebtoken's `StringValue` template literal union, which a plain
 * `string` from the environment cannot satisfy — the cast is the documented
 * escape hatch for runtime-sourced durations.
 */
export type ExpiresIn = SignOptions['expiresIn'];

export function jwtExpiresIn(): ExpiresIn {
  const configured =
    process.env.JWT_EXPIRES_IN ?? process.env.JWT_EXPIRATION ?? process.env.JWT_EXP ?? '12h';
  return configured as ExpiresIn;
}
