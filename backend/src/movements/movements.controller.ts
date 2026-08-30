import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/auth.types';
import { Paginated } from '../lib/pagination';
import type { MovementDto, MovementResultDto } from '../lib/api-types';
import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';

@ApiTags('movements')
@ApiBearerAuth()
@Controller('movements')
export class MovementsController {
  constructor(private readonly movements: MovementsService) {}

  /** Recording stock is the clerk's core job, so this is open to both roles. */
  @Post()
  @ApiOperation({ summary: 'Record a movement and adjust balances atomically' })
  create(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MovementResultDto> {
    return this.movements.create(dto, user);
  }

  /** The full audit log is a manager surface. */
  @Get()
  @Roles(Role.manager)
  @ApiOperation({ summary: 'Movement audit log, newest first (manager only)' })
  findAll(@Query() query: QueryMovementsDto): Promise<Paginated<MovementDto>> {
    return this.movements.findAll(query);
  }
}
