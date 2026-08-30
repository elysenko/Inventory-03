import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';
import { LocationsModule } from './locations/locations.module';
import { MovementsModule } from './movements/movements.module';
import { ReportsModule } from './reports/reports.module';
import { AdminSettingsModule } from './admin/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // AuthModule registers the global JwtAuthGuard/RolesGuard, so it must be
    // present for every other module's endpoints to be protected.
    AuthModule,
    UsersModule,
    ItemsModule,
    LocationsModule,
    MovementsModule,
    ReportsModule,
    AdminSettingsModule,
    HealthModule,
  ],
})
export class AppModule {}
