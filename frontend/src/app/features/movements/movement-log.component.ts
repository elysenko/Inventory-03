import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Item, Movement } from '../../core/models';
import { describeError } from '../../shared/api/api-client.service';
import { ItemsApi } from '../../shared/api/items-api.service';
import { MovementsApi, MovementQuery } from '../../shared/api/movements-api.service';

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
  private readonly api = inject(MovementsApi);
  private readonly itemsApi = inject(ItemsApi);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Populates the item filter select. */
  readonly items = signal<Item[]>([]);

  /**
   * The audit log is unbounded, so filtering AND paging happen server-side:
   * `visible` is one page of rows, `filteredTotal` the count matching the
   * current filters, and `totalCount` the size of the whole log.
   */
  readonly visible = signal<Movement[]>([]);
  readonly filteredTotal = signal(0);
  readonly totalCount = signal(0);
  readonly totalPages = signal(1);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly itemFilter = computed(() => this.params().get('itemId') ?? '');
  readonly typeFilter = computed(() => this.params().get('type') ?? '');
  readonly fromDate = computed(() => this.params().get('from') ?? '');
  readonly toDate = computed(() => this.params().get('to') ?? '');
  readonly page = computed(() => Math.max(1, Number(this.params().get('page') ?? '1') || 1));

  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  readonly hasFilters = computed(
    () => !!(this.itemFilter() || this.typeFilter() || this.fromDate() || this.toDate()),
  );

  constructor() {
    void this.loadItems();
    // Re-runs whenever a filter or the page number changes in the URL.
    effect(() => {
      const query: MovementQuery = {
        itemId: this.itemFilter() || undefined,
        type: this.typeFilter() || undefined,
        from: this.fromDate() || undefined,
        to: this.toDate() || undefined,
        page: this.page(),
        pageSize: PAGE_SIZE,
      };
      void this.load(query);
    });
  }

  private async loadItems(): Promise<void> {
    try {
      this.items.set(await this.itemsApi.listAll());
    } catch {
      // The filter select degrades to "All items"; the log itself still loads.
      this.items.set([]);
    }
  }

  private async load(query: MovementQuery): Promise<void> {
    this.loading.set(true);
    try {
      const page = await this.api.list(query);
      this.visible.set(page.data);
      this.filteredTotal.set(page.total);
      this.totalPages.set(page.totalPages);
      // A separate 1-row request yields the unfiltered size for the header.
      if (!this.hasFilters()) this.totalCount.set(page.total);
      else this.totalCount.set((await this.api.list({ page: 1, pageSize: 1 })).total);
      this.error.set(null);
    } catch (error) {
      this.visible.set([]);
      this.filteredTotal.set(0);
      this.totalPages.set(1);
      this.error.set(describeError(error, 'Could not load the movement log.'));
    } finally {
      this.loading.set(false);
    }
  }

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

  /** Filters live in the URL so a filtered log is bookmarkable. */
  private patch(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
