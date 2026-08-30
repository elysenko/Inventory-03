import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { Paginated } from '../lib/pagination';
import type { ItemDetailDto, ItemDto, MovementDto } from '../lib/api-types';
import { MovementsService } from '../movements/movements.service';
import { QueryMovementsDto } from '../movements/dto/query-movements.dto';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';

@ApiTags('items')
@ApiBearerAuth()
@Controller('items')
export class ItemsController {
  constructor(
    private readonly items: ItemsService,
    private readonly movements: MovementsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List items with computed totalOnHand' })
  findAll(@Query() query: QueryItemsDto): Promise<Paginated<ItemDto>> {
    return this.items.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One item including its per-location breakdown' })
  findOne(@Param('id') id: string): Promise<ItemDetailDto> {
    return this.items.findOne(id);
  }

  /** Readable by clerks — it backs the item-detail movements tab. */
  @Get(':id/movements')
  @ApiOperation({ summary: "This item's movement history" })
  async findMovements(
    @Param('id') id: string,
    @Query() query: QueryMovementsDto,
  ): Promise<Paginated<MovementDto>> {
    await this.items.requireItem(id);
    return this.movements.findForItem(id, query);
  }

  @Post()
  @Roles(Role.manager)
  @ApiOperation({ summary: 'Create an item (manager only)' })
  create(@Body() dto: CreateItemDto): Promise<ItemDto> {
    return this.items.create(dto);
  }

  @Patch(':id')
  @Roles(Role.manager)
  @ApiOperation({ summary: 'Update an item (manager only)' })
  update(@Param('id') id: string, @Body() dto: UpdateItemDto): Promise<ItemDto> {
    return this.items.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.manager)
  @ApiOperation({ summary: 'Delete an item (manager only; 409 when referenced)' })
  remove(@Param('id') id: string): Promise<{ id: string; deleted: true }> {
    return this.items.remove(id);
  }
}
