import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_COST = 10;

/** Public projection of a user — never leaks `passwordHash`. */
export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof USER_PUBLIC_SELECT }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: USER_PUBLIC_SELECT });
  }

  count(): Promise<number> {
    return this.prisma.user.count();
  }

  async create(email: string, password: string, role: Role): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    return this.prisma.user.create({
      data: { email: email.trim().toLowerCase(), passwordHash, role },
      select: USER_PUBLIC_SELECT,
    });
  }

  verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
