import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, ValidateNested } from 'class-validator';

export class SettingValueDto {
  @ApiProperty({ example: 'MINIO_ENDPOINT' })
  @IsString()
  key!: string;

  @ApiProperty({ example: 'http://minio:9000' })
  @IsString()
  value!: string;
}

export class UpdateSettingsDto {
  @ApiProperty({ type: [SettingValueDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SettingValueDto)
  entries!: SettingValueDto[];
}
