import { Injectable, inject } from '@angular/core';
import { LowStockRow } from '../../core/models';
import { ApiClient } from './api-client.service';

/** GET /api/reports/low-stock — manager only, worst shortfall first. */
@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly api = inject(ApiClient);

  lowStock(): Promise<LowStockRow[]> {
    return this.api.get<LowStockRow[]>('/reports/low-stock');
  }
}
