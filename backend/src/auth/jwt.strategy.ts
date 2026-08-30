import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { jwtSecret } from './jwt.constants';
import type { AuthUser, JwtPayload } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
      algorithms: ['HS256'],
    });
  }

  /**
   * Re-reads the user on every request so a deleted account or a role change
   * takes effect immediately rather than lingering until the token expires.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub) throw new UnauthorizedException('Invalid token payload');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return user;
  }
}
