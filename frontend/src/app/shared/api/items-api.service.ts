import { Injectable, inject } from '@angular/core';
import { Item, Movement, StockLevel } from '../../core/models';
import { ApiClient, Paginated } from './api-client.service';

/** GET /api/items/:id — the item plus its per-location breakdown. */
export interface ItemDetail extends Item {
  stockLevels: StockLevel[];
}

export interface ItemInput {
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorderAt: number;
}

export interface ItemQuery {
  q?: string;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
}

/** The catalogue is bounded, so screens that show "N of M" load it in one page. */
const FULL_PAGE = 200;

@Injectable({ providedIn: 'root' })
export class ItemsApi {
  private readonly api = inject(ApiClient);

  list(query: ItemQuery = {}): Promise<Paginated<Item>> {
    return this.api.get<Paginated<Item>>('/items', { ...query });
  }

  /** Every item in one request — the screens that filter client-side use this. */
  async listAll(): Promise<Item[]> {
    const page = await this.list({ pageSize: FULL_PAGE });
    return page.data;
  }

  get(id: string): Promise<ItemDetail> {
    return this.api.get<ItemDetail>(`/items/${encodeURIComponent(id)}`);
  }

  /** Readable by clerks too — it backs the item-detail movements tab. */
  async movements(id: string, pageSize = 100): Promise<Movement[]> {
    const page = await this.api.get<Paginated<Movement>>(
      `/items/${encodeURIComponent(id)}/movements`,
      { pageSize },
    );
    return page.data;
  }

  create(input: ItemInput): Promise<Item> {
    return this.api.post<Item>('/items', input);
  }

  update(id: string, input: Partial<ItemInput>): Promise<Item> {
    return this.api.patch<Item>(`/items/${encodeURIComponent(id)}`, input);
  }

  remove(id: string): Promise<{ id: string; deleted: true }> {
    return this.api.delete<{ id: string; deleted: true }>(`/items/${encodeURIComponent(id)}`);
  }
}
