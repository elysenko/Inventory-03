import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateLocationDto {
  @ApiProperty({ example: 'Zone D' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Name is required.' })
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Receiving' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Zone is required.' })
  @MaxLength(120)
  zone!: string;
}
