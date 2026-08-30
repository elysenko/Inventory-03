import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Paginated, paginate, resolvePage } from '../lib/pagination';
import type { MovementDto, MovementResultDto, StockBalanceDto } from '../lib/api-types';
import type { AuthUser } from '../auth/auth.types';
import { CreateMovementDto } from './dto/create-movement.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';

/** Everything the wire shape needs, joined in one query. */
const MOVEMENT_INCLUDE = {
  item: { select: { id: true, sku: true, name: true } },
  fromLoc: { select: { id: true, name: true } },
  toLoc: { select: { id: true, name: true } },
  user: { select: { email: true } },
} satisfies Prisma.MovementInclude;

type MovementRow = Prisma.MovementGetPayload<{ include: typeof MOVEMENT_INCLUDE }>;

/** Postgres serialization failure under the Serializable isolation level. */
const SERIALIZATION_FAILURE = 'P2034';

@Injectable()
export class MovementsService {
  private readonly logger = new Logger(MovementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a movement and adjusts the affected per-location balances in one
   * Serializable transaction, so the balance and the audit row can never
   * disagree. Two concurrent draws against the same balance either serialize
   * or fail cleanly — one is retried, never applied twice.
   */
  async create(dto: CreateMovementDto, user: AuthUser): Promise<MovementResultDto> {
    this.assertLocationsMatchType(dto);

    try {
      return await this.runWrite(dto, user);
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        this.logger.warn('Serialization failure on movement write — retrying once.');
        return this.runWrite(dto, user);
      }
      throw error;
    }
  }

  async findAll(query: QueryMovementsDto): Promise<Paginated<MovementDto>> {
    const spec = resolvePage(query);
    const where = this.buildWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.movement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: spec.skip,
        take: spec.take,
      }),
      this.prisma.movement.count({ where }),
    ]);

    return paginate(rows.map(toMovementDto), total, spec);
  }

  /** The item-detail movements tab — available to clerks as well as managers. */
  async findForItem(itemId: string, query: QueryMovementsDto): Promise<Paginated<MovementDto>> {
    return this.findAll({ ...query, itemId });
  }

  // ---------------------------------------------------------------- internals

  private async runWrite(dto: CreateMovementDto, user: AuthUser): Promise<MovementResultDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const item = await tx.item.findUnique({
          where: { id: dto.itemId },
          select: { id: true },
        });
        if (!item) throw new NotFoundException(`Item ${dto.itemId} was not found.`);

        const fromLoc = dto.fromLocId ? await this.requireLocation(tx, dto.fromLocId) : null;
        const toLoc = dto.toLocId ? await this.requireLocation(tx, dto.toLocId) : null;

        const touched: StockBalanceDto[] = [];

        // Debit first. The `qty: { gte }` predicate lives in the WHERE clause,
        // so an over-draw matches zero rows and writes nothing; the throw then
        // rolls the whole transaction back, leaving the stored balance intact.
        if (fromLoc) {
          const debited = await tx.stockLevel.updateMany({
            where: { itemId: dto.itemId, locationId: fromLoc.id, qty: { gte: dto.qty } },
            data: { qty: { decrement: dto.qty } },
          });
          if (debited.count === 0) {
            const current = await tx.stockLevel.findUnique({
              where: { itemId_locationId: { itemId: dto.itemId, locationId: fromLoc.id } },
              select: { qty: true },
            });
            throw new BadRequestException(
              `Insufficient stock: ${fromLoc.name} holds ${current?.qty ?? 0}, but ${dto.qty} was requested.`,
            );
          }
        }

        if (toLoc) {
          await tx.stockLevel.upsert({
            where: { itemId_locationId: { itemId: dto.itemId, locationId: toLoc.id } },
            create: { itemId: dto.itemId, locationId: toLoc.id, qty: dto.qty },
            update: { qty: { increment: dto.qty } },
          });
        }

        const movement = await tx.movement.create({
          data: {
            type: dto.type,
            itemId: dto.itemId,
            fromLocId: fromLoc?.id ?? null,
            toLocId: toLoc?.id ?? null,
            qty: dto.qty,
            note: dto.note ?? null,
            // Attribution comes from the verified JWT, never from the request body.
            userId: user.id,
          },
          include: MOVEMENT_INCLUDE,
        });

        for (const location of [fromLoc, toLoc]) {
          if (!location) continue;
          const level = await tx.stockLevel.findUnique({
            where: { itemId_locationId: { itemId: dto.itemId, locationId: location.id } },
            select: { qty: true },
          });
          touched.push({
            itemId: dto.itemId,
            locationId: location.id,
            locationName: location.name,
            qty: level?.qty ?? 0,
          });
        }

        return { ...toMovementDto(movement), balances: touched };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async requireLocation(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<{ id: string; name: string }> {
    const location = await tx.location.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!location) throw new NotFoundException(`Location ${id} was not found.`);
    return location;
  }

  /**
   * IN credits one location, OUT debits one, TRANSFER does both between two
   * distinct locations. Anything else is a 400 before any row is touched.
   */
  private assertLocationsMatchType(dto: CreateMovementDto): void {
    const from = dto.fromLocId ?? null;
    const to = dto.toLocId ?? null;

    switch (dto.type) {
      case MovementType.IN:
        if (!to) throw new BadRequestException('A destination location is required for a stock-in.');
        if (from) throw new BadRequestException('A stock-in must not name a source location.');
        break;
      case MovementType.OUT:
        if (!from) throw new BadRequestException('A source location is required for a stock-out.');
        if (to) throw new BadRequestException('A stock-out must not name a destination location.');
        break;
      case MovementType.TRANSFER:
        if (!from || !to) {
          throw new BadRequestException('A transfer requires both a source and a destination location.');
        }
        if (from === to) {
          throw new BadRequestException('A transfer must move stock between two different locations.');
        }
        break;
      default:
        throw new BadRequestException('Type must be one of IN, OUT or TRANSFER.');
    }
  }

  private buildWhere(query: QueryMovementsDto): Prisma.MovementWhereInput {
    const where: Prisma.MovementWhereInput = {};
    if (query.itemId) where.itemId = query.itemId;
    if (query.type) where.type = query.type;
    if (query.locationId) {
      where.OR = [{ fromLocId: query.locationId }, { toLocId: query.locationId }];
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) createdAt.lte = endOfRange(query.to);
    if (createdAt.gte !== undefined || createdAt.lte !== undefined) where.createdAt = createdAt;

    return where;
  }

  private isSerializationFailure(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === SERIALIZATION_FAILURE
    );
  }
}

/**
 * A bare `YYYY-MM-DD` upper bound is inclusive of that whole day — otherwise
 * filtering "to today" would silently drop everything recorded today.
 */
function endOfRange(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T23:59:59.999Z`);
  return new Date(value);
}

export function toMovementDto(row: MovementRow): MovementDto {
  return {
    id: row.id,
    type: row.type,
    itemId: row.itemId,
    itemSku: row.item.sku,
    itemName: row.item.name,
    fromLocId: row.fromLocId,
    fromLocName: row.fromLoc?.name ?? null,
    toLocId: row.toLocId,
    toLocName: row.toLoc?.name ?? null,
    qty: row.qty,
    note: row.note,
    userEmail: row.user.email,
    createdAt: row.createdAt.toISOString(),
  };
}
