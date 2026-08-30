import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { MovementType } from '@prisma/client';
import { PaginationQueryDto } from '../../lib/pagination';

export class QueryMovementsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiPropertyOptional({ description: 'Inclusive lower bound on createdAt (ISO 8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'From must be a valid date.' })
  from?: string;

  @ApiPropertyOptional({ description: 'Inclusive upper bound on createdAt (ISO 8601)' })
  @IsOptional()
  @IsDateString({}, { message: 'To must be a valid date.' })
  to?: string;

  @ApiPropertyOptional({ description: 'Matches movements out of OR into this location' })
  @IsOptional()
  @IsString()
  locationId?: string;
}
