import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import type { SettingEntryDto } from '../lib/api-types';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.manager)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Credential slots with masked values (manager only)' })
  list(): Promise<SettingEntryDto[]> {
    return this.settings.list();
  }

  @Patch()
  @ApiOperation({ summary: 'Set or clear credential overrides (manager only)' })
  update(@Body() dto: UpdateSettingsDto): Promise<SettingEntryDto[]> {
    return this.settings.update(dto.entries);
  }
}
