import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateItemDto {
  @ApiProperty({ example: 'SKU-009' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'SKU is required.' })
  @MaxLength(64)
  sku!: string;

  @ApiProperty({ example: 'Steel bracket 40mm' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Name is required.' })
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Zinc-plated L bracket' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiProperty({ example: 'each' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Unit is required.' })
  @MaxLength(32)
  unit!: string;

  @ApiProperty({ example: 25, minimum: 0 })
  @Type(() => Number)
  @IsInt({ message: 'Reorder threshold must be a whole number.' })
  @Min(0, { message: 'Reorder threshold cannot be negative.' })
  reorderAt!: number;
}
