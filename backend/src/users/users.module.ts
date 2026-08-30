import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * No controller: users are managed through /api/auth (signup) and the seed.
 * The service is exported for AuthService and the JWT strategy.
 */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
