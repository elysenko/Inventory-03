import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { LowStockRowDto } from '../lib/api-types';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Low stock is `SUM(stockLevel.qty) <= item.reorderAt` across every location.
   *
   * A LEFT JOIN (not an INNER JOIN) is essential: an item with no StockLevel
   * rows at all has zero on hand and is by definition at or below its
   * threshold, so it must appear. `<=` (not `<`) means the exact boundary —
   * totalOnHand === reorderAt — is listed too.
   *
   * The counts are cast to int so Postgres returns JS numbers rather than the
   * bigint that SUM() would otherwise yield.
   */
  async lowStock(): Promise<LowStockRowDto[]> {
    return this.prisma.$queryRaw<LowStockRowDto[]>`
      SELECT
        i."id"                                              AS "itemId",
        i."sku"                                             AS "sku",
        i."name"                                            AS "name",
        i."unit"                                            AS "unit",
        COALESCE(SUM(s."qty"), 0)::int                      AS "totalOnHand",
        i."reorderAt"                                       AS "reorderAt",
        (i."reorderAt" - COALESCE(SUM(s."qty"), 0))::int    AS "shortfall"
      FROM "Item" i
      LEFT JOIN "StockLevel" s ON s."itemId" = i."id"
      GROUP BY i."id", i."sku", i."name", i."unit", i."reorderAt"
      HAVING COALESCE(SUM(s."qty"), 0) <= i."reorderAt"
      ORDER BY "shortfall" DESC, i."sku" ASC
    `;
  }
}
