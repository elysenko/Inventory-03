import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'manager@demo' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({ require_tld: false }, { message: 'Enter a valid email address.' })
  email!: string;

  @ApiProperty({ example: 'Demo1234!' })
  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  password!: string;
}
