import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import { UsersService, PublicUser } from '../users/users.service';
import type { JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * A wrong email and a wrong password produce the identical 401 so the
   * endpoint cannot be used to enumerate accounts.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password.');

    const ok = await this.users.verifyPassword(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password.');

    return this.issue({ id: user.id, email: user.email, role: user.role });
  }

  /**
   * The very first account on an empty database becomes the manager so a fresh,
   * unseeded deployment is administrable. Every later signup is a clerk.
   */
  async signup(dto: SignupDto): Promise<AuthResponse> {
    const role: Role = (await this.users.count()) === 0 ? Role.manager : Role.clerk;
    try {
      const user = await this.users.create(dto.email, dto.password, role);
      return this.issue(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'An account with that email already exists.',
          field: 'email',
        });
      }
      throw error;
    }
  }

  private issue(user: PublicUser): AuthResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { accessToken: this.jwt.sign(payload), user };
  }
}
