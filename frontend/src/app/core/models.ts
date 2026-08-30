export type Role = 'clerk' | 'manager';

export type MovementType = 'IN' | 'OUT' | 'TRANSFER';

export interface User {
  id: string;
  email: string;
  role: Role;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorderAt: number;
  totalOnHand: number;
  createdAt: string;
}

export interface StockLevel {
  id: string;
  itemId: string;
  locationId: string;
  locationName: string;
  locationZone: string;
  qty: number;
}

export interface Location {
  id: string;
  name: string;
  zone: string;
  itemsStocked: number;
}

export interface Movement {
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

export interface LowStockRow {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  totalOnHand: number;
  reorderAt: number;
  shortfall: number;
}

export interface SettingEntry {
  key: string;
  service: string;
  label: string;
  value: string;
  configured: boolean;
  secret: boolean;
}
