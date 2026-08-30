import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import type { LowStockRowDto } from '../lib/api-types';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('low-stock')
  @Roles(Role.manager)
  @ApiOperation({ summary: 'Items at or below their reorder threshold (manager only)' })
  lowStock(): Promise<LowStockRowDto[]> {
    return this.reports.lowStock();
  }
}
