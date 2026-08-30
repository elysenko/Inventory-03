import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'newuser@demo' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({ require_tld: false }, { message: 'Enter a valid email address.' })
  email!: string;

  @ApiProperty({ example: 'Demo1234!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password!: string;
}
