/**
 * Shared e2e harness.
 *
 * Boots the real AppModule against the real database named by DATABASE_URL, so
 * the guards, the ValidationPipe and the Serializable transaction in
 * MovementsService are all exercised exactly as they run in production.
 *
 * Every suite creates its own fixtures under a unique SKU/name prefix and
 * removes them in afterAll, so runs never collide with the seeded demo data
 * (8 items / 3 locations) or with each other.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export const DEMO_PASSWORD = 'Demo1234!';
export const MANAGER_EMAIL = 'manager@demo';
export const CLERK_EMAIL = 'clerk@demo';

export interface Harness {
  app: INestApplication;
  prisma: PrismaService;
  managerToken: string;
  clerkToken: string;
  close: () => Promise<void>;
}

/** Mirrors main.ts: same prefix and same pipe, so status codes match production. */
export async function bootstrapHarness(): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    managerToken: await login(app, MANAGER_EMAIL),
    clerkToken: await login(app, CLERK_EMAIL),
    close: () => app.close(),
  };
}

/**
 * The seeded accounts are the only managers on a seeded deploy, so the suites
 * depend on the seed having run. Fail loudly rather than skipping silently.
 */
export async function login(app: INestApplication, email: string): Promise<string> {
  const request = require('supertest') as typeof import('supertest');
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: DEMO_PASSWORD });

  if (response.status !== 200 || !response.body?.accessToken) {
    throw new Error(
      `Could not sign in as ${email} (status ${response.status}). ` +
        'Run `node prisma/seed/seed.js` against DATABASE_URL before the e2e suite.',
    );
  }
  return response.body.accessToken as string;
}

export const bearer = (token: string): string => `Bearer ${token}`;

/** Removes every fixture created under `prefix`, audit rows first. */
export async function cleanupByPrefix(prisma: PrismaService, prefix: string): Promise<void> {
  const items = await prisma.item.findMany({
    where: { sku: { startsWith: prefix } },
    select: { id: true },
  });
  const itemIds = items.map((i) => i.id);

  const locations = await prisma.location.findMany({
    where: { name: { startsWith: prefix } },
    select: { id: true },
  });
  const locationIds = locations.map((l) => l.id);

  if (itemIds.length) {
    await prisma.movement.deleteMany({ where: { itemId: { in: itemIds } } });
    await prisma.stockLevel.deleteMany({ where: { itemId: { in: itemIds } } });
  }
  if (locationIds.length) {
    await prisma.movement.deleteMany({
      where: { OR: [{ fromLocId: { in: locationIds } }, { toLocId: { in: locationIds } }] },
    });
    await prisma.stockLevel.deleteMany({ where: { locationId: { in: locationIds } } });
  }
  if (itemIds.length) await prisma.item.deleteMany({ where: { id: { in: itemIds } } });
  if (locationIds.length) await prisma.location.deleteMany({ where: { id: { in: locationIds } } });
}

/** Per-location balance for an item, or 0 when no StockLevel row exists yet. */
export async function balanceAt(
  prisma: PrismaService,
  itemId: string,
  locationId: string,
): Promise<number> {
  const level = await prisma.stockLevel.findUnique({
    where: { itemId_locationId: { itemId, locationId } },
    select: { qty: true },
  });
  return level?.qty ?? 0;
}
