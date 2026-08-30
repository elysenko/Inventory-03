/**
 * Authentication and role-based access control.
 *
 * The distinction that matters throughout: no token is 401 (JwtAuthGuard), a
 * valid token with the wrong role is 403 (RolesGuard). Conflating the two would
 * let the SPA's 401 interceptor bounce a signed-in clerk back to /login.
 */
import * as request from 'supertest';
import { Harness, bearer, bootstrapHarness, cleanupByPrefix, CLERK_EMAIL, DEMO_PASSWORD, MANAGER_EMAIL } from './harness';

const PREFIX = 'E2EAUTH-';

describe('Auth & RBAC (e2e)', () => {
  let h: Harness;
  const http = () => request(h.app.getHttpServer());

  beforeAll(async () => {
    h = await bootstrapHarness();
  });

  afterAll(async () => {
    await cleanupByPrefix(h.prisma, PREFIX);
    await h.prisma.user.deleteMany({ where: { email: { startsWith: PREFIX.toLowerCase() } } });
    await h.close();
  });

  describe('login', () => {
    it('issues a bearer token carrying the seeded manager role', async () => {
      const res = await http()
        .post('/api/auth/login')
        .send({ email: MANAGER_EMAIL, password: DEMO_PASSWORD })
        .expect(200);

      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user).toMatchObject({ email: MANAGER_EMAIL, role: 'manager' });
      // The hash must never leave the server.
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('issues a clerk token for the seeded clerk', async () => {
      const res = await http()
        .post('/api/auth/login')
        .send({ email: CLERK_EMAIL, password: DEMO_PASSWORD })
        .expect(200);

      expect(res.body.user).toMatchObject({ email: CLERK_EMAIL, role: 'clerk' });
    });

    it('rejects a wrong password with 401', async () => {
      await http()
        .post('/api/auth/login')
        .send({ email: MANAGER_EMAIL, password: 'not-the-password' })
        .expect(401);
    });

    it('rejects an unknown account with 401', async () => {
      await http()
        .post('/api/auth/login')
        .send({ email: 'nobody@nowhere.invalid', password: DEMO_PASSWORD })
        .expect(401);
    });

    it('rejects a malformed body with 400', async () => {
      await http().post('/api/auth/login').send({ email: 'not-an-email' }).expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the caller identity for the SPA to rehydrate', async () => {
      const res = await http()
        .get('/api/auth/me')
        .set('Authorization', bearer(h.managerToken))
        .expect(200);

      expect(res.body).toMatchObject({ email: MANAGER_EMAIL, role: 'manager' });
    });

    it('rejects a garbage token with 401', async () => {
      await http().get('/api/auth/me').set('Authorization', 'Bearer not.a.jwt').expect(401);
    });
  });

  describe('401 — protected by default, no token', () => {
    // JwtAuthGuard is registered as an APP_GUARD, so any endpoint added later
    // is protected unless it explicitly opts out with @Public().
    it.each([
      ['/api/items'],
      ['/api/locations'],
      ['/api/movements'],
      ['/api/reports/low-stock'],
      ['/api/auth/me'],
    ])('GET %s without a token is 401', async (path) => {
      await http().get(path).expect(401);
    });
  });

  describe('403 — authenticated clerk, manager-only action', () => {
    it('clerk cannot create an item', async () => {
      await http()
        .post('/api/items')
        .set('Authorization', bearer(h.clerkToken))
        .send({ sku: `${PREFIX}FORBIDDEN`, name: 'nope', unit: 'each', reorderAt: 1 })
        .expect(403);
    });

    it('clerk cannot read the audit log', async () => {
      await http().get('/api/movements').set('Authorization', bearer(h.clerkToken)).expect(403);
    });

    it('clerk cannot read the low-stock report', async () => {
      await http()
        .get('/api/reports/low-stock')
        .set('Authorization', bearer(h.clerkToken))
        .expect(403);
    });

    it('clerk cannot create a location', async () => {
      await http()
        .post('/api/locations')
        .set('Authorization', bearer(h.clerkToken))
        .send({ name: `${PREFIX}Nope`, zone: 'Nope' })
        .expect(403);
    });
  });

  describe('200 — clerk keeps the access the job needs', () => {
    it('clerk can browse the catalogue', async () => {
      const res = await http()
        .get('/api/items')
        .set('Authorization', bearer(h.clerkToken))
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('clerk can list locations to populate the movement form', async () => {
      await http().get('/api/locations').set('Authorization', bearer(h.clerkToken)).expect(200);
    });
  });

  describe('public endpoints', () => {
    it('health is reachable unauthenticated', async () => {
      await http().get('/api/health').expect(200);
    });

    it('deep health proves the database round-trips', async () => {
      const res = await http().get('/api/health/deep').expect(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('signup', () => {
    it('creates a clerk on a seeded deploy and rejects a duplicate email', async () => {
      const email = `${PREFIX.toLowerCase()}${Date.now()}@example.test`;

      const created = await http()
        .post('/api/auth/signup')
        .send({ email, password: DEMO_PASSWORD })
        .expect(201);

      // Seeded users already exist, so this is never the first account.
      expect(created.body.user).toMatchObject({ email, role: 'clerk' });

      await http()
        .post('/api/auth/signup')
        .send({ email, password: DEMO_PASSWORD })
        .expect(409);

      await h.prisma.user.deleteMany({ where: { email } });
    });
  });
});
