import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../lib/pagination';

export class QueryItemsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on sku or name' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Only items where totalOnHand <= reorderAt' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  lowStock?: boolean;
}
