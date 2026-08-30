import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LowStockRow } from '../../core/models';

@Component({
  selector: 'app-low-stock',
  imports: [RouterLink],
  templateUrl: './low-stock.component.html',
  styleUrl: './low-stock.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowStockComponent {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * Predicate is `totalOnHand <= reorderAt`, so the boundary case
   * (SKU-003, 40 on hand against a reorder point of 40) IS listed, and items
   * with no stock rows at all (SKU-007) are listed too.
   */
  readonly rows = signal<LowStockRow[]>([
    { itemId: 'itm-2', sku: 'SKU-002', name: 'Hex bolt M8 x 40', unit: 'each', totalOnHand: 320, reorderAt: 500, shortfall: 180 },
    { itemId: 'itm-5', sku: 'SKU-005', name: 'Pallet wrap', unit: 'roll', totalOnHand: 12, reorderAt: 30, shortfall: 18 },
    { itemId: 'itm-7', sku: 'SKU-007', name: 'Thermal labels 4x6', unit: 'box', totalOnHand: 0, reorderAt: 15, shortfall: 15 },
    { itemId: 'itm-3', sku: 'SKU-003', name: 'Packing tape 48mm', unit: 'roll', totalOnHand: 40, reorderAt: 40, shortfall: 0 },
  ]);

  readonly totalShortfall = computed(() => this.rows().reduce((sum, row) => sum + row.shortfall, 0));
  readonly outOfStockCount = computed(() => this.rows().filter((row) => row.totalOnHand === 0).length);
}
