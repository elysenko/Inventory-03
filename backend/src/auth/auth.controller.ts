import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, AuthResponse } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import type { AuthUser } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for a bearer token' })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Create an account (first account on an empty DB is a manager)' })
  signup(@Body() dto: SignupDto): Promise<AuthResponse> {
    return this.auth.signup(dto);
  }

  /** Used by the SPA to rehydrate its session on boot. Logout is a client-side token discard. */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current signed-in user' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
