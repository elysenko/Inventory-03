import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { LocationDto } from '../lib/api-types';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { QueryLocationsDto } from './dto/query-locations.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returned as a bare array (not a page envelope): every authenticated role
   * needs the full list to populate the movement wizard's location selects.
   */
  async findAll(query: QueryLocationsDto = {}): Promise<LocationDto[]> {
    const where: Prisma.LocationWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
            { zone: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};

    const rows = await this.prisma.location.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        // Only non-zero balances count as "stocked" — an emptied shelf is not
        // an item the location currently holds.
        stockLevels: { where: { qty: { not: 0 } }, select: { id: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      zone: row.zone,
      itemsStocked: row.stockLevels.length,
    }));
  }

  async findOne(id: string): Promise<LocationDto> {
    const row = await this.prisma.location.findUnique({
      where: { id },
      include: { stockLevels: { where: { qty: { not: 0 } }, select: { id: true } } },
    });
    if (!row) throw new NotFoundException(`Location ${id} was not found.`);
    return { id: row.id, name: row.name, zone: row.zone, itemsStocked: row.stockLevels.length };
  }

  async create(dto: CreateLocationDto): Promise<LocationDto> {
    try {
      const created = await this.prisma.location.create({
        data: { name: dto.name, zone: dto.zone },
      });
      return { id: created.id, name: created.name, zone: created.zone, itemsStocked: 0 };
    } catch (error) {
      throw this.mapUniqueViolation(error, dto.name);
    }
  }

  async update(id: string, dto: UpdateLocationDto): Promise<LocationDto> {
    await this.requireLocation(id);
    try {
      await this.prisma.location.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.zone !== undefined ? { zone: dto.zone } : {}),
        },
      });
    } catch (error) {
      throw this.mapUniqueViolation(error, dto.name ?? '');
    }
    return this.findOne(id);
  }

  /** Refused with 409 while stock sits here or the audit log still points at it. */
  async remove(id: string): Promise<{ id: string; deleted: true }> {
    await this.requireLocation(id);

    const [stocked, movements] = await Promise.all([
      this.prisma.stockLevel.aggregate({
        where: { locationId: id, qty: { not: 0 } },
        _sum: { qty: true },
        _count: true,
      }),
      this.prisma.movement.count({
        where: { OR: [{ fromLocId: id }, { toLocId: id }] },
      }),
    ]);

    if (stocked._count > 0) {
      throw new ConflictException(
        `This location still holds ${stocked._sum.qty ?? 0} unit(s) across ${stocked._count} item(s). Move the stock elsewhere before deleting it.`,
      );
    }
    if (movements > 0) {
      throw new ConflictException(
        `This location appears in ${movements} movement(s) in the audit log and cannot be deleted.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.stockLevel.deleteMany({ where: { locationId: id } }),
      this.prisma.location.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  async requireLocation(id: string): Promise<{ id: string; name: string }> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!location) throw new NotFoundException(`Location ${id} was not found.`);
    return location;
  }

  private mapUniqueViolation(error: unknown, name: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException({
        message: `A location named ${name} already exists.`,
        field: 'name',
      });
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
