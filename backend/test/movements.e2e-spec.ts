/**
 * Stock movement invariants — the core correctness surface of the app.
 *
 * The assertions that carry the weight are the negative ones: a rejected
 * movement must leave the stored balance byte-for-byte unchanged, and two
 * concurrent draws must never both land. Asserting only the status code would
 * pass even if the transaction leaked a partial write.
 */
import * as request from 'supertest';
import {
  Harness,
  balanceAt,
  bearer,
  bootstrapHarness,
  cleanupByPrefix,
} from './harness';

const PREFIX = 'E2EMOVE-';

describe('Movements (e2e)', () => {
  let h: Harness;
  let itemId: string;
  let locA: string;
  let locB: string;

  const http = () => request(h.app.getHttpServer());
  const asClerk = () => bearer(h.clerkToken);
  const asManager = () => bearer(h.managerToken);

  beforeAll(async () => {
    h = await bootstrapHarness();
    await cleanupByPrefix(h.prisma, PREFIX);

    const [a, b] = await Promise.all([
      h.prisma.location.create({ data: { name: `${PREFIX}Alpha`, zone: 'Test' } }),
      h.prisma.location.create({ data: { name: `${PREFIX}Beta`, zone: 'Test' } }),
    ]);
    locA = a.id;
    locB = b.id;
  });

  beforeEach(async () => {
    // A fresh zero-stock item per test keeps each balance assertion independent.
    const item = await h.prisma.item.create({
      data: {
        sku: `${PREFIX}${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        name: 'Movement probe',
        unit: 'each',
        reorderAt: 10,
      },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await cleanupByPrefix(h.prisma, PREFIX);
    await h.close();
  });

  const move = (body: Record<string, unknown>, token = asClerk()) =>
    http().post('/api/movements').set('Authorization', token).send(body);

  describe('balance arithmetic', () => {
    it('IN credits the destination', async () => {
      await move({ type: 'IN', itemId, toLocId: locA, qty: 50 }).expect(201);
      await expect(balanceAt(h.prisma, itemId, locA)).resolves.toBe(50);
    });

    it('OUT debits the source', async () => {
      await move({ type: 'IN', itemId, toLocId: locA, qty: 50 }).expect(201);
      await move({ type: 'OUT', itemId, fromLocId: locA, qty: 20 }).expect(201);
      await expect(balanceAt(h.prisma, itemId, locA)).resolves.toBe(30);
    });

    it('TRANSFER moves stock and conserves the total', async () => {
      await move({ type: 'IN', itemId, toLocId: locA, qty: 30 }).expect(201);
      await move({ type: 'TRANSFER', itemId, fromLocId: locA, toLocId: locB, qty: 10 }).expect(201);

      const [a, b] = await Promise.all([
        balanceAt(h.prisma, itemId, locA),
        balanceAt(h.prisma, itemId, locB),
      ]);
      expect(a).toBe(20);
      expect(b).toBe(10);
      expect(a + b).toBe(30); // conserved
    });

    it('credits a destination that has no StockLevel row yet', async () => {
      await move({ type: 'IN', itemId, toLocId: locB, qty: 7 }).expect(201);
      await expect(balanceAt(h.prisma, itemId, locB)).resolves.toBe(7);
    });
  });

  describe('over-draw is refused and rolls back', () => {
    it('rejects OUT larger than the balance and leaves it untouched', async () => {
      await move({ type: 'IN', itemId, toLocId: locA, qty: 5 }).expect(201);

      await move({ type: 'OUT', itemId, fromLocId: locA, qty: 10 }).expect(400);

      // The point of the test: the balance still reads 5, not -5 and not 0.
      await expect(balanceAt(h.prisma, itemId, locA)).resolves.toBe(5);
    });

    it('rejects OUT from a location holding nothing', async () => {
      await move({ type: 'OUT', itemId, fromLocId: locA, qty: 1 }).expect(400);
      await expect(balanceAt(h.prisma, itemId, locA)).resolves.toBe(0);
    });

    it('rolls back the credit leg when a TRANSFER cannot be debited', async () => {
      await move({ type: 'IN', itemId, toLocId: locA, qty: 5 }).expect(201);

      await move({ type: 'TRANSFER', itemId, fromLocId: locA, toLocId: locB, qty: 50 }).expect(400);

      // Neither leg may have landed.
      await expect(balanceAt(h.prisma, itemId, locA)).resolves.toBe(5);
      await expect(balanceAt(h.prisma, itemId, locB)).resolves.toBe(0);
    });

    it('writes no audit row for a refused movement', async () => {
      await move({ type: 'OUT', itemId, fromLocId: locA, qty: 99 }).expect(400);
      await expect(h.prisma.movement.count({ where: { itemId } })).resolves.toBe(0);
    });
  });

  describe('concurrency', () => {
    it('lets exactly one of two simultaneous draws win, never going negative', async () => {
      await move({ type: 'IN', itemId, toLocId: locA, qty: 50 }).expect(201);

      const results = await Promise.all([
        move({ type: 'OUT', itemId, fromLocId: locA, qty: 30 }),
        move({ type: 'OUT', itemId, fromLocId: locA, qty: 30 }),
      ]);

      const succeeded = results.filter((r) => r.status === 201).length;
      expect(succeeded).toBe(1);

      // 50 - 30 = 20. A double-apply would read -10.
      await expect(balanceAt(h.prisma, itemId, locA)).resolves.toBe(20);
      await expect(h.prisma.movement.count({ where: { itemId, type: 'OUT' } })).resolves.toBe(1);
    });
  });

  describe('type / location validation', () => {
    it.each([
      ['IN without a destination', { type: 'IN', qty: 1 }],
      ['IN naming a source', { type: 'IN', qty: 1, fromLocId: 'A', toLocId: 'B' }],
      ['OUT without a source', { type: 'OUT', qty: 1 }],
      ['OUT naming a destination', { type: 'OUT', qty: 1, fromLocId: 'A', toLocId: 'B' }],
      ['TRANSFER missing a leg', { type: 'TRANSFER', qty: 1, fromLocId: 'A' }],
    ])('rejects %s with 400', async (_label, partial) => {
      const body: Record<string, unknown> = { ...partial, itemId };
      if (body.fromLocId === 'A') body.fromLocId = locA;
      if (body.toLocId === 'B') body.toLocId = locB;
      await move(body).expect(400);
    });

    it('rejects a TRANSFER between one and the same location', async () => {
      await move({ type: 'TRANSFER', itemId, fromLocId: locA, toLocId: locA, qty: 1 }).expect(400);
    });

    it.each([[0], [-5]])('rejects a quantity of %s', async (qty) => {
      await move({ type: 'IN', itemId, toLocId: locA, qty }).expect(400);
    });

    it('404s on an unknown item', async () => {
      await move({ type: 'IN', itemId: 'no-such-item', toLocId: locA, qty: 1 }).expect(404);
    });

    it('404s on an unknown location', async () => {
      await move({ type: 'IN', itemId, toLocId: 'no-such-location', qty: 1 }).expect(404);
    });
  });

  describe('audit log', () => {
    it('attributes the movement to the caller from the JWT, not the body', async () => {
      // A forged userId in the body must be ignored (ValidationPipe whitelists it away).
      await move({
        type: 'IN',
        itemId,
        toLocId: locA,
        qty: 3,
        note: 'Opening',
        userId: 'usr-mgr',
      }).expect(201);

      const res = await http()
        .get(`/api/movements?itemId=${itemId}`)
        .set('Authorization', asManager())
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        type: 'IN',
        qty: 3,
        note: 'Opening',
        userEmail: 'clerk@demo', // the clerk recorded it, not the forged manager
      });
    });

    it('filters by type', async () => {
      await move({ type: 'IN', itemId, toLocId: locA, qty: 4 }).expect(201);
      await move({ type: 'OUT', itemId, fromLocId: locA, qty: 1 }).expect(201);

      const outOnly = await http()
        .get(`/api/movements?itemId=${itemId}&type=OUT`)
        .set('Authorization', asManager())
        .expect(200);

      expect(outOnly.body.data).toHaveLength(1);
      expect(outOnly.body.data[0].type).toBe('OUT');
    });

    it('exposes an item movement tab to clerks', async () => {
      await move({ type: 'IN', itemId, toLocId: locA, qty: 2 }).expect(201);
      const res = await http()
        .get(`/api/items/${itemId}/movements`)
        .set('Authorization', asClerk())
        .expect(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('item detail consistency', () => {
    it('per-location quantities sum to totalOnHand', async () => {
      await move({ type: 'IN', itemId, toLocId: locA, qty: 12 }).expect(201);
      await move({ type: 'IN', itemId, toLocId: locB, qty: 8 }).expect(201);

      const res = await http()
        .get(`/api/items/${itemId}`)
        .set('Authorization', asClerk())
        .expect(200);

      const sum = res.body.stockLevels.reduce((n: number, l: { qty: number }) => n + l.qty, 0);
      expect(res.body.totalOnHand).toBe(20);
      expect(sum).toBe(res.body.totalOnHand);
    });
  });

  describe('low-stock threshold', () => {
    const listed = async (): Promise<boolean> => {
      const res = await http()
        .get('/api/reports/low-stock')
        .set('Authorization', asManager())
        .expect(200);
      const rows = Array.isArray(res.body) ? res.body : res.body.data;
      return rows.some((r: { itemId: string }) => r.itemId === itemId);
    };

    it('omits an item above its reorder point', async () => {
      // reorderAt is 10 for the probe item.
      await move({ type: 'IN', itemId, toLocId: locA, qty: 12 }).expect(201);
      await expect(listed()).resolves.toBe(false);
    });

    it('lists an item once it drops to the boundary (totalOnHand === reorderAt)', async () => {
      await move({ type: 'IN', itemId, toLocId: locA, qty: 12 }).expect(201);
      await expect(listed()).resolves.toBe(false);

      await move({ type: 'OUT', itemId, fromLocId: locA, qty: 2 }).expect(201);
      // Exactly 10 on hand against a threshold of 10 — the inclusive boundary.
      await expect(listed()).resolves.toBe(true);
    });

    it('lists an item that has no stock rows at all', async () => {
      await expect(listed()).resolves.toBe(true);
    });
  });
});
