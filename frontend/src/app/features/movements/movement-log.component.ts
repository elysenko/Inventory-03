import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Item, Movement } from '../../core/models';

const PAGE_SIZE = 8;

@Component({
  selector: 'app-movement-log',
  imports: [RouterLink, DatePipe],
  templateUrl: './movement-log.component.html',
  styleUrl: './movement-log.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementLogComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly items = signal<Item[]>([
    { id: 'itm-1', sku: 'SKU-001', name: 'Steel bracket 40mm', description: null, unit: 'each', reorderAt: 25, totalOnHand: 148, createdAt: '2026-05-02T09:12:00Z' },
    { id: 'itm-2', sku: 'SKU-002', name: 'Hex bolt M8 x 40', description: null, unit: 'each', reorderAt: 500, totalOnHand: 320, createdAt: '2026-05-02T09:14:00Z' },
    { id: 'itm-3', sku: 'SKU-003', name: 'Packing tape 48mm', description: null, unit: 'roll', reorderAt: 40, totalOnHand: 40, createdAt: '2026-05-03T11:40:00Z' },
    { id: 'itm-4', sku: 'SKU-004', name: 'Cardboard box, large', description: null, unit: 'each', reorderAt: 100, totalOnHand: 612, createdAt: '2026-05-04T08:05:00Z' },
    { id: 'itm-5', sku: 'SKU-005', name: 'Pallet wrap', description: null, unit: 'roll', reorderAt: 30, totalOnHand: 12, createdAt: '2026-05-06T14:22:00Z' },
    { id: 'itm-6', sku: 'SKU-006', name: 'Safety gloves, large', description: null, unit: 'pair', reorderAt: 60, totalOnHand: 210, createdAt: '2026-05-09T10:31:00Z' },
    { id: 'itm-8', sku: 'SKU-008', name: 'Conveyor belt segment', description: null, unit: 'each', reorderAt: 4, totalOnHand: 9, createdAt: '2026-05-15T07:58:00Z' },
  ]);

  readonly movements = signal<Movement[]>([
    { id: 'mv-201', type: 'OUT', itemId: 'itm-5', itemSku: 'SKU-005', itemName: 'Pallet wrap', fromLocId: 'loc-c', fromLocName: 'Zone C', toLocId: null, toLocName: null, qty: 36, note: 'Dispatch consumption', userEmail: 'clerk@demo', createdAt: '2026-08-29T11:20:00Z' },
    { id: 'mv-202', type: 'OUT', itemId: 'itm-2', itemSku: 'SKU-002', itemName: 'Hex bolt M8 x 40', fromLocId: 'loc-b', fromLocName: 'Zone B', toLocId: null, toLocName: null, qty: 180, note: 'Assembly line draw', userEmail: 'clerk@demo', createdAt: '2026-08-28T15:12:00Z' },
    { id: 'mv-203', type: 'OUT', itemId: 'itm-1', itemSku: 'SKU-001', itemName: 'Steel bracket 40mm', fromLocId: 'loc-a', fromLocName: 'Zone A', toLocId: null, toLocName: null, qty: 52, note: 'Works order WO-2213', userEmail: 'clerk@demo', createdAt: '2026-08-26T09:47:00Z' },
    { id: 'mv-204', type: 'TRANSFER', itemId: 'itm-6', itemSku: 'SKU-006', itemName: 'Safety gloves, large', fromLocId: 'loc-a', fromLocName: 'Zone A', toLocId: 'loc-b', toLocName: 'Zone B', qty: 120, note: 'Restock picking face', userEmail: 'manager@demo', createdAt: '2026-08-24T07:15:00Z' },
    { id: 'mv-205', type: 'TRANSFER', itemId: 'itm-4', itemSku: 'SKU-004', itemName: 'Cardboard box, large', fromLocId: 'loc-b', fromLocName: 'Zone B', toLocId: 'loc-c', toLocName: 'Zone C', qty: 100, note: 'Stage for dispatch', userEmail: 'clerk@demo', createdAt: '2026-08-22T16:03:00Z' },
    { id: 'mv-206', type: 'TRANSFER', itemId: 'itm-1', itemSku: 'SKU-001', itemName: 'Steel bracket 40mm', fromLocId: 'loc-a', fromLocName: 'Zone A', toLocId: 'loc-b', toLocName: 'Zone B', qty: 88, note: 'Move to picking face', userEmail: 'clerk@demo', createdAt: '2026-08-19T13:05:00Z' },
    { id: 'mv-207', type: 'IN', itemId: 'itm-8', itemSku: 'SKU-008', itemName: 'Conveyor belt segment', fromLocId: null, fromLocName: null, toLocId: 'loc-c', toLocName: 'Zone C', qty: 9, note: 'PO 4492 — partial delivery', userEmail: 'manager@demo', createdAt: '2026-08-18T09:38:00Z' },
    { id: 'mv-208', type: 'IN', itemId: 'itm-6', itemSku: 'SKU-006', itemName: 'Safety gloves, large', fromLocId: null, fromLocName: null, toLocId: 'loc-a', toLocName: 'Zone A', qty: 210, note: 'Opening stock', userEmail: 'manager@demo', createdAt: '2026-08-13T10:11:00Z' },
    { id: 'mv-209', type: 'IN', itemId: 'itm-4', itemSku: 'SKU-004', itemName: 'Cardboard box, large', fromLocId: null, fromLocName: null, toLocId: 'loc-a', toLocName: 'Zone A', qty: 612, note: 'Opening stock — PO 4480', userEmail: 'manager@demo', createdAt: '2026-08-13T10:02:00Z' },
    { id: 'mv-210', type: 'IN', itemId: 'itm-3', itemSku: 'SKU-003', itemName: 'Packing tape 48mm', fromLocId: null, fromLocName: null, toLocId: 'loc-b', toLocName: 'Zone B', qty: 40, note: 'Opening stock', userEmail: 'manager@demo', createdAt: '2026-08-12T08:52:00Z' },
    { id: 'mv-211', type: 'IN', itemId: 'itm-5', itemSku: 'SKU-005', itemName: 'Pallet wrap', fromLocId: null, fromLocName: null, toLocId: 'loc-c', toLocName: 'Zone C', qty: 48, note: 'Opening stock', userEmail: 'manager@demo', createdAt: '2026-08-12T08:41:00Z' },
    { id: 'mv-212', type: 'IN', itemId: 'itm-2', itemSku: 'SKU-002', itemName: 'Hex bolt M8 x 40', fromLocId: null, fromLocName: null, toLocId: 'loc-b', toLocName: 'Zone B', qty: 500, note: 'Opening stock', userEmail: 'manager@demo', createdAt: '2026-08-12T08:34:00Z' },
    { id: 'mv-213', type: 'IN', itemId: 'itm-1', itemSku: 'SKU-001', itemName: 'Steel bracket 40mm', fromLocId: null, fromLocName: null, toLocId: 'loc-a', toLocName: 'Zone A', qty: 200, note: 'Opening stock — PO 4471', userEmail: 'manager@demo', createdAt: '2026-08-12T08:30:00Z' },
  ]);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly itemFilter = computed(() => this.params().get('itemId') ?? '');
  readonly typeFilter = computed(() => this.params().get('type') ?? '');
  readonly fromDate = computed(() => this.params().get('from') ?? '');
  readonly toDate = computed(() => this.params().get('to') ?? '');
  readonly page = computed(() => Math.max(1, Number(this.params().get('page') ?? '1') || 1));

  readonly hasFilters = computed(
    () => !!(this.itemFilter() || this.typeFilter() || this.fromDate() || this.toDate()),
  );

  readonly filtered = computed(() =>
    this.movements().filter((movement) => {
      if (this.itemFilter() && movement.itemId !== this.itemFilter()) return false;
      if (this.typeFilter() && movement.type !== this.typeFilter()) return false;
      const day = movement.createdAt.slice(0, 10);
      if (this.fromDate() && day < this.fromDate()) return false;
      if (this.toDate() && day > this.toDate()) return false;
      return true;
    }),
  );

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  readonly visible = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  badgeClass(type: Movement['type']): string {
    if (type === 'IN') return 'badge badge-in';
    if (type === 'OUT') return 'badge badge-out';
    return 'badge badge-transfer';
  }

  setFilter(key: string, value: string): void {
    this.patch({ [key]: value || null, page: null });
  }

  goToPage(page: number): void {
    this.patch({ page: page > 1 ? String(page) : null });
  }

  clearFilters(): void {
    this.patch({ itemId: null, type: null, from: null, to: null, page: null });
  }

  private patch(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
