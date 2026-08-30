import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { Item } from '../../core/models';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-item-list',
  imports: [RouterLink],
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly items = signal<Item[]>([
    { id: 'itm-1', sku: 'SKU-001', name: 'Steel bracket 40mm', description: 'Zinc-plated L bracket', unit: 'each', reorderAt: 25, totalOnHand: 148, createdAt: '2026-05-02T09:12:00Z' },
    { id: 'itm-2', sku: 'SKU-002', name: 'Hex bolt M8 x 40', description: 'Grade 8.8 hex head bolt', unit: 'each', reorderAt: 500, totalOnHand: 320, createdAt: '2026-05-02T09:14:00Z' },
    { id: 'itm-3', sku: 'SKU-003', name: 'Packing tape 48mm', description: 'Clear polypropylene, 66m', unit: 'roll', reorderAt: 40, totalOnHand: 40, createdAt: '2026-05-03T11:40:00Z' },
    { id: 'itm-4', sku: 'SKU-004', name: 'Cardboard box, large', description: 'Double wall 600x400x400', unit: 'each', reorderAt: 100, totalOnHand: 612, createdAt: '2026-05-04T08:05:00Z' },
    { id: 'itm-5', sku: 'SKU-005', name: 'Pallet wrap', description: '500mm stretch film', unit: 'roll', reorderAt: 30, totalOnHand: 12, createdAt: '2026-05-06T14:22:00Z' },
    { id: 'itm-6', sku: 'SKU-006', name: 'Safety gloves, large', description: 'Cut-resistant level C', unit: 'pair', reorderAt: 60, totalOnHand: 210, createdAt: '2026-05-09T10:31:00Z' },
    { id: 'itm-7', sku: 'SKU-007', name: 'Thermal labels 4x6', description: 'Direct thermal, 250/roll', unit: 'box', reorderAt: 15, totalOnHand: 0, createdAt: '2026-05-12T16:47:00Z' },
    { id: 'itm-8', sku: 'SKU-008', name: 'Conveyor belt segment', description: 'PVC 800mm modular link', unit: 'each', reorderAt: 4, totalOnHand: 9, createdAt: '2026-05-15T07:58:00Z' },
  ]);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly query = computed(() => this.params().get('q') ?? '');
  readonly lowStockOnly = computed(() => this.params().get('lowStock') === 'true');
  readonly page = computed(() => Math.max(1, Number(this.params().get('page') ?? '1') || 1));

  readonly filtered = computed(() => {
    const term = this.query().trim().toLowerCase();
    return this.items().filter((item) => {
      const matchesTerm =
        !term || item.sku.toLowerCase().includes(term) || item.name.toLowerCase().includes(term);
      const matchesLow = !this.lowStockOnly() || item.totalOnHand <= item.reorderAt;
      return matchesTerm && matchesLow;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  readonly visible = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly lowStockCount = computed(
    () => this.items().filter((item) => item.totalOnHand <= item.reorderAt).length,
  );

  isLow(item: Item): boolean {
    return item.totalOnHand <= item.reorderAt;
  }

  onSearch(value: string): void {
    this.patch({ q: value || null, page: null });
  }

  toggleLowStock(): void {
    this.patch({ lowStock: this.lowStockOnly() ? null : 'true', page: null });
  }

  goToPage(page: number): void {
    this.patch({ page: page > 1 ? String(page) : null });
  }

  clearFilters(): void {
    this.patch({ q: null, lowStock: null, page: null });
  }

  /** Filters live in the URL so any filtered view is linkable and bookmarkable. */
  private patch(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
