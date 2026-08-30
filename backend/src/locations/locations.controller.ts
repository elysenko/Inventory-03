import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import type { LocationDto } from '../lib/api-types';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { QueryLocationsDto } from './dto/query-locations.dto';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  /** Every authenticated role: clerks need it for the movement wizard's selects. */
  @Get()
  @ApiOperation({ summary: 'List locations with the count of items stocked' })
  findAll(@Query() query: QueryLocationsDto): Promise<LocationDto[]> {
    return this.locations.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<LocationDto> {
    return this.locations.findOne(id);
  }

  @Post()
  @Roles(Role.manager)
  @ApiOperation({ summary: 'Create a location (manager only)' })
  create(@Body() dto: CreateLocationDto): Promise<LocationDto> {
    return this.locations.create(dto);
  }

  @Patch(':id')
  @Roles(Role.manager)
  @ApiOperation({ summary: 'Update a location (manager only)' })
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto): Promise<LocationDto> {
    return this.locations.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.manager)
  @ApiOperation({ summary: 'Delete a location (manager only; 409 when referenced)' })
  remove(@Param('id') id: string): Promise<{ id: string; deleted: true }> {
    return this.locations.remove(id);
  }
}
