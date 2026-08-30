import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

/** Query params shared by every list endpoint. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

/** The envelope every list endpoint returns. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PageSpec {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function resolvePage(query: PaginationQueryDto): PageSpec {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginate<T>(data: T[], total: number, spec: PageSpec): Paginated<T> {
  return {
    data,
    total,
    page: spec.page,
    pageSize: spec.pageSize,
    totalPages: Math.max(1, Math.ceil(total / spec.pageSize)),
  };
}
