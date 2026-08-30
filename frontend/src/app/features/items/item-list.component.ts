import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { Item } from '../../core/models';
import { describeError } from '../../shared/api/api-client.service';
import { ItemsApi } from '../../shared/api/items-api.service';

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
  private readonly api = inject(ItemsApi);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /**
   * The whole catalogue in one request.
   *
   * The header reads "<filtered> of <total> items", and the low-stock counter
   * covers every item — both need the unfiltered set, so filtering and paging
   * stay on the client over a single bounded fetch rather than issuing a second
   * round trip per keystroke.
   */
  readonly items = signal<Item[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.items.set(await this.api.listAll());
      this.error.set(null);
    } catch (error) {
      this.items.set([]);
      this.error.set(describeError(error, 'Could not load items.'));
    } finally {
      this.loading.set(false);
    }
  }

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
