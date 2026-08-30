import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Paginated, paginate, resolvePage } from '../lib/pagination';
import type { ItemDetailDto, ItemDto, StockLevelDto } from '../lib/api-types';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';

const ITEM_WITH_STOCK = {
  stockLevels: { select: { qty: true } },
} satisfies Prisma.ItemInclude;

type ItemWithStock = Prisma.ItemGetPayload<{ include: typeof ITEM_WITH_STOCK }>;

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `lowStock` compares against the summed balance across every location, so it
   * cannot be pushed into the SQL WHERE clause alongside pagination without a
   * second aggregate pass. The catalogue is small and bounded, so the filter
   * and the page slice are applied after summing — which also keeps `total`
   * honest (it counts filtered rows, not pre-filter rows).
   */
  async findAll(query: QueryItemsDto): Promise<Paginated<ItemDto>> {
    const spec = resolvePage(query);
    const where = this.buildWhere(query.q);

    const rows = await this.prisma.item.findMany({
      where,
      include: ITEM_WITH_STOCK,
      orderBy: [{ createdAt: 'asc' }, { sku: 'asc' }],
    });

    let items = rows.map((row) => this.toDto(row));
    if (query.lowStock) {
      items = items.filter((item) => item.totalOnHand <= item.reorderAt);
    }

    const page = items.slice(spec.skip, spec.skip + spec.take);
    return paginate(page, items.length, spec);
  }

  async findOne(id: string): Promise<ItemDetailDto> {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        stockLevels: {
          include: { location: { select: { id: true, name: true, zone: true } } },
          orderBy: { location: { name: 'asc' } },
        },
      },
    });
    if (!item) throw new NotFoundException(`Item ${id} was not found.`);

    const stockLevels: StockLevelDto[] = item.stockLevels.map((level) => ({
      id: level.id,
      itemId: level.itemId,
      locationId: level.locationId,
      locationName: level.location.name,
      locationZone: level.location.zone,
      qty: level.qty,
    }));

    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      unit: item.unit,
      reorderAt: item.reorderAt,
      totalOnHand: stockLevels.reduce((sum, level) => sum + level.qty, 0),
      createdAt: item.createdAt.toISOString(),
      stockLevels,
    };
  }

  async create(dto: CreateItemDto): Promise<ItemDto> {
    try {
      const created = await this.prisma.item.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          description: dto.description ?? null,
          unit: dto.unit,
          reorderAt: dto.reorderAt,
        },
        include: ITEM_WITH_STOCK,
      });
      return this.toDto(created);
    } catch (error) {
      throw this.mapUniqueViolation(error, dto.sku);
    }
  }

  async update(id: string, dto: UpdateItemDto): Promise<ItemDto> {
    await this.requireItem(id);
    try {
      const updated = await this.prisma.item.update({
        where: { id },
        data: {
          ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
          ...(dto.reorderAt !== undefined ? { reorderAt: dto.reorderAt } : {}),
        },
        include: ITEM_WITH_STOCK,
      });
      return this.toDto(updated);
    } catch (error) {
      throw this.mapUniqueViolation(error, dto.sku ?? '');
    }
  }

  /**
   * Deleting an item that still holds stock or appears in the audit log would
   * silently rewrite history, so both cases are refused with 409 rather than
   * cascading. Zero-quantity StockLevel rows carry no information and are
   * removed alongside the item.
   */
  async remove(id: string): Promise<{ id: string; deleted: true }> {
    await this.requireItem(id);

    const [stocked, movements] = await Promise.all([
      this.prisma.stockLevel.aggregate({
        where: { itemId: id, qty: { not: 0 } },
        _sum: { qty: true },
        _count: true,
      }),
      this.prisma.movement.count({ where: { itemId: id } }),
    ]);

    if (stocked._count > 0) {
      throw new ConflictException(
        `This item still has ${stocked._sum.qty ?? 0} on hand across ${stocked._count} location(s). Move the stock out before deleting it.`,
      );
    }
    if (movements > 0) {
      throw new ConflictException(
        `This item appears in ${movements} movement(s) in the audit log and cannot be deleted.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.stockLevel.deleteMany({ where: { itemId: id } }),
      this.prisma.item.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  /** Throws 404 when the item does not exist. Shared by the movement service. */
  async requireItem(id: string): Promise<{ id: string; sku: string; name: string }> {
    const item = await this.prisma.item.findUnique({
      where: { id },
      select: { id: true, sku: true, name: true },
    });
    if (!item) throw new NotFoundException(`Item ${id} was not found.`);
    return item;
  }

  private buildWhere(q?: string): Prisma.ItemWhereInput {
    if (!q) return {};
    return {
      OR: [
        { sku: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
      ],
    };
  }

  private toDto(row: ItemWithStock): ItemDto {
    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      description: row.description,
      unit: row.unit,
      reorderAt: row.reorderAt,
      totalOnHand: row.stockLevels.reduce((sum, level) => sum + level.qty, 0),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Turns Prisma's P2002 into a field-scoped 409 so the form can attach the
   * message to its `sku` control. The unique index guarantees no second row
   * was written.
   */
  private mapUniqueViolation(error: unknown, sku: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException({
        message: `SKU ${sku} is already in use by another item.`,
        field: 'sku',
      });
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
