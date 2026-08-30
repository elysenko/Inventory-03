'use strict';
/**
 * StockRoom production seed — runs with plain `node`, no TypeScript toolchain.
 *
 * Usage:  node prisma/seed/seed.js
 * Called by: npx prisma db seed  (via package.json "prisma.seed"), and by the
 * container start command before `node dist/main`.
 *
 * Idempotent: every row is upserted under a deterministic id, so re-running
 * never duplicates. Guarded by SEED_ON_BOOT !== 'false'.
 *
 * KEEP IN SYNC with prisma/seed.ts (same fixtures, same ids).
 * Fixtures mirror the approved mockup exactly (frontend/src/app/features/...),
 * so the seeded API reproduces the designed screens 1:1.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo1234!';

const USERS = [
  { id: 'usr-mgr', email: 'manager@demo', role: 'manager' },
  { id: 'usr-clk', email: 'clerk@demo', role: 'clerk' },
];

const LOCATIONS = [
  { id: 'loc-a', name: 'Zone A', zone: 'Receiving' },
  { id: 'loc-b', name: 'Zone B', zone: 'Main floor' },
  { id: 'loc-c', name: 'Zone C', zone: 'Dispatch' },
];

const ITEMS = [
  { id: 'itm-1', sku: 'SKU-001', name: 'Steel bracket 40mm',    description: 'Zinc-plated L bracket',      unit: 'each', reorderAt: 25,  createdAt: '2026-05-02T09:12:00Z' },
  { id: 'itm-2', sku: 'SKU-002', name: 'Hex bolt M8 x 40',      description: 'Grade 8.8 hex head bolt',    unit: 'each', reorderAt: 500, createdAt: '2026-05-02T09:14:00Z' },
  { id: 'itm-3', sku: 'SKU-003', name: 'Packing tape 48mm',     description: 'Clear polypropylene, 66m',   unit: 'roll', reorderAt: 40,  createdAt: '2026-05-03T11:40:00Z' },
  { id: 'itm-4', sku: 'SKU-004', name: 'Cardboard box, large',  description: 'Double wall 600x400x400',    unit: 'each', reorderAt: 100, createdAt: '2026-05-04T08:05:00Z' },
  { id: 'itm-5', sku: 'SKU-005', name: 'Pallet wrap',           description: '500mm stretch film',         unit: 'roll', reorderAt: 30,  createdAt: '2026-05-06T14:22:00Z' },
  { id: 'itm-6', sku: 'SKU-006', name: 'Safety gloves, large',  description: 'Cut-resistant level C',      unit: 'pair', reorderAt: 60,  createdAt: '2026-05-09T10:31:00Z' },
  { id: 'itm-7', sku: 'SKU-007', name: 'Thermal labels 4x6',    description: 'Direct thermal, 250/roll',   unit: 'box',  reorderAt: 15,  createdAt: '2026-05-12T16:47:00Z' },
  { id: 'itm-8', sku: 'SKU-008', name: 'Conveyor belt segment', description: 'PVC 800mm modular link',     unit: 'each', reorderAt: 4,   createdAt: '2026-05-15T07:58:00Z' },
];

/**
 * Opening balances. Sums per item are the mockup's totalOnHand:
 *   itm-1 148 (>25 ok) | itm-2 320 (<=500 LOW) | itm-3 40 (==40 LOW, boundary)
 *   itm-4 612 (>100 ok) | itm-5 12 (<=30 LOW)  | itm-6 210 (>60 ok)
 *   itm-7 no rows -> 0 (<=15 LOW, zero-stock case) | itm-8 9 (>4 ok)
 * Four low-stock items keeps GET /api/reports/low-stock non-empty on a fresh deploy.
 */
const STOCK = [
  { itemId: 'itm-1', locationId: 'loc-a', qty: 60,  at: '2026-05-02T10:00:00Z' },
  { itemId: 'itm-1', locationId: 'loc-b', qty: 88,  at: '2026-05-02T10:05:00Z' },
  { itemId: 'itm-2', locationId: 'loc-a', qty: 120, at: '2026-05-02T10:10:00Z' },
  { itemId: 'itm-2', locationId: 'loc-b', qty: 200, at: '2026-05-02T10:15:00Z' },
  { itemId: 'itm-3', locationId: 'loc-b', qty: 40,  at: '2026-05-03T12:00:00Z' },
  { itemId: 'itm-4', locationId: 'loc-a', qty: 200, at: '2026-05-04T09:00:00Z' },
  { itemId: 'itm-4', locationId: 'loc-b', qty: 312, at: '2026-05-04T09:05:00Z' },
  { itemId: 'itm-4', locationId: 'loc-c', qty: 100, at: '2026-05-04T09:10:00Z' },
  { itemId: 'itm-5', locationId: 'loc-c', qty: 12,  at: '2026-05-06T15:00:00Z' },
  { itemId: 'itm-6', locationId: 'loc-a', qty: 90,  at: '2026-05-09T11:00:00Z' },
  { itemId: 'itm-6', locationId: 'loc-b', qty: 120, at: '2026-05-09T11:05:00Z' },
  { itemId: 'itm-8', locationId: 'loc-c', qty: 9,   at: '2026-05-15T08:30:00Z' },
];

async function main() {
  if (process.env.SEED_ON_BOOT === 'false') {
    console.log('SEED_ON_BOOT=false — skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, passwordHash },
      create: { id: u.id, email: u.email, role: u.role, passwordHash },
    });
    console.log(`SEED_CRED ${u.role} ${u.email} ${DEMO_PASSWORD}`);
  }

  for (const l of LOCATIONS) {
    await prisma.location.upsert({
      where: { id: l.id },
      update: { name: l.name, zone: l.zone },
      create: l,
    });
  }

  for (const i of ITEMS) {
    const data = { ...i, createdAt: new Date(i.createdAt) };
    await prisma.item.upsert({ where: { id: i.id }, update: data, create: data });
  }

  // Opening IN movements + the balances they produce. Deterministic movement ids
  // keep this idempotent; fixed timestamps keep ?from/?to filter tests stable.
  const managerId = USERS[0].id;
  for (const s of STOCK) {
    await prisma.stockLevel.upsert({
      where: { itemId_locationId: { itemId: s.itemId, locationId: s.locationId } },
      update: { qty: s.qty },
      create: { itemId: s.itemId, locationId: s.locationId, qty: s.qty },
    });

    const movementId = `mv-open-${s.itemId}-${s.locationId}`;
    const movement = {
      id: movementId,
      type: 'IN',
      itemId: s.itemId,
      fromLocId: null,
      toLocId: s.locationId,
      qty: s.qty,
      note: 'Opening balance',
      userId: managerId,
      createdAt: new Date(s.at),
    };
    await prisma.movement.upsert({
      where: { id: movementId },
      update: movement,
      create: movement,
    });
  }

  const [users, items, locations, stock, movements] = await Promise.all([
    prisma.user.count(), prisma.item.count(), prisma.location.count(),
    prisma.stockLevel.count(), prisma.movement.count(),
  ]);
  console.log(`Seed complete: ${users} users, ${items} items, ${locations} locations, ${stock} stock levels, ${movements} movements.`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
