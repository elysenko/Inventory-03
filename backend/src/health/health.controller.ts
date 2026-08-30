import { Controller, Get, HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness. Deliberately touches nothing external — a database blip must not
   * make the orchestrator kill an otherwise healthy pod.
   */
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  check(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness. Proves the database round-trips before traffic is accepted. */
  @Get('deep')
  @ApiOperation({ summary: 'Readiness probe (round-trips the database)' })
  async deep(): Promise<{ status: string; database: string; timestamp: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', timestamp: new Date().toISOString() };
    } catch (error) {
      this.logger.error('Deep health check failed', error as Error);
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        status: 'error',
        database: 'down',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
