import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { MovementType } from '@prisma/client';

export class CreateMovementDto {
  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType, { message: 'Type must be one of IN, OUT or TRANSFER.' })
  type!: MovementType;

  @ApiProperty()
  @IsString()
  itemId!: string;

  @ApiPropertyOptional({ description: 'Required for OUT and TRANSFER' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @IsString()
  fromLocId?: string | null;

  @ApiPropertyOptional({ description: 'Required for IN and TRANSFER' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @IsString()
  toLocId?: string | null;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Quantity must be a whole number.' })
  @Min(1, { message: 'Quantity must be at least 1.' })
  qty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
