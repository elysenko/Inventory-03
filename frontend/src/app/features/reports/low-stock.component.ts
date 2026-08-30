import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LowStockRow } from '../../core/models';
import { describeError } from '../../shared/api/api-client.service';
import { ReportsApi } from '../../shared/api/reports-api.service';

@Component({
  selector: 'app-low-stock',
  imports: [RouterLink],
  templateUrl: './low-stock.component.html',
  styleUrl: './low-stock.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowStockComponent {
  private readonly api = inject(ReportsApi);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /**
   * GET /api/reports/low-stock. The predicate is `totalOnHand <= reorderAt`
   * evaluated across every location, so the exact boundary is listed and items
   * with no stock rows at all are listed too.
   */
  readonly rows = signal<LowStockRow[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.rows.set(await this.api.lowStock());
      this.error.set(null);
    } catch (error) {
      this.rows.set([]);
      this.error.set(describeError(error, 'Could not build the low-stock report.'));
    } finally {
      this.loading.set(false);
    }
  }

  readonly totalShortfall = computed(() => this.rows().reduce((sum, row) => sum + row.shortfall, 0));
  readonly outOfStockCount = computed(() => this.rows().filter((row) => row.totalOnHand === 0).length);
}
