import { Injectable, inject } from '@angular/core';
import { Movement, MovementType } from '../../core/models';
import { ApiClient, Paginated } from './api-client.service';

/** A balance the write touched, echoed back so the UI can refresh in place. */
export interface StockBalance {
  itemId: string;
  locationId: string;
  locationName: string;
  qty: number;
}

export interface MovementResult extends Movement {
  balances: StockBalance[];
}

export interface MovementInput {
  type: MovementType;
  itemId: string;
  fromLocId?: string | null;
  toLocId?: string | null;
  qty: number;
  note?: string | null;
}

export interface MovementQuery {
  itemId?: string;
  type?: string;
  from?: string;
  to?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class MovementsApi {
  private readonly api = inject(ApiClient);

  /**
   * Recording stock is open to both roles. The server applies the debit inside
   * a serializable transaction, so a 400 "Insufficient stock" here means
   * nothing was written and the stored balance is unchanged.
   */
  create(input: MovementInput): Promise<MovementResult> {
    return this.api.post<MovementResult>('/movements', input);
  }

  /**
   * The audit log, newest first. Manager-only on the server: a clerk who
   * deep-links here gets a 403, which the caller surfaces as an error state.
   *
   * Date filters are widened to whole days because the control is a date input
   * but `createdAt` is a timestamp — without the end-of-day upper bound a
   * same-day `to` would exclude every movement recorded after midnight.
   */
  list(query: MovementQuery = {}): Promise<Paginated<Movement>> {
    const { from, to, ...rest } = query;
    return this.api.get<Paginated<Movement>>('/movements', {
      ...rest,
      from: from ? `${from}T00:00:00.000Z` : undefined,
      to: to ? `${to}T23:59:59.999Z` : undefined,
    });
  }
}
