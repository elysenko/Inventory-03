import type { MovementType } from '@prisma/client';

/**
 * Wire shapes returned by the REST API. These mirror
 * `frontend/src/app/core/models.ts` field-for-field — that file is the contract
 * and every response here is assignable to it.
 */

export interface ItemDto {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorderAt: number;
  /** Sum of every per-location StockLevel.qty for this item. */
  totalOnHand: number;
  createdAt: string;
}

export interface StockLevelDto {
  id: string;
  itemId: string;
  locationId: string;
  locationName: string;
  locationZone: string;
  qty: number;
}

/** GET /api/items/:id — the per-location breakdown sums exactly to totalOnHand. */
export interface ItemDetailDto extends ItemDto {
  stockLevels: StockLevelDto[];
}

export interface LocationDto {
  id: string;
  name: string;
  zone: string;
  /** Distinct items with a non-zero balance at this location. */
  itemsStocked: number;
}

export interface MovementDto {
  id: string;
  type: MovementType;
  itemId: string;
  itemSku: string;
  itemName: string;
  fromLocId: string | null;
  fromLocName: string | null;
  toLocId: string | null;
  toLocName: string | null;
  qty: number;
  note: string | null;
  userEmail: string;
  createdAt: string;
}

/** A balance touched by a movement, echoed back so the UI can refresh in place. */
export interface StockBalanceDto {
  itemId: string;
  locationId: string;
  locationName: string;
  qty: number;
}

/** POST /api/movements — a MovementDto plus the balances the write changed. */
export interface MovementResultDto extends MovementDto {
  balances: StockBalanceDto[];
}

export interface LowStockRowDto {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  totalOnHand: number;
  reorderAt: number;
  /** reorderAt - totalOnHand; always >= 0 for listed rows. */
  shortfall: number;
}

export interface SettingEntryDto {
  key: string;
  service: string;
  label: string;
  /** Masked for secrets; the real value is never returned over the wire. */
  value: string;
  configured: boolean;
  secret: boolean;
}
