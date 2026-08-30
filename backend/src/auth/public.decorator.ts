import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts an endpoint out of the globally registered JwtAuthGuard.
 * Everything without this decorator requires a valid bearer token.
 */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
