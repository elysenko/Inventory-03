import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Item, Location, MovementType, StockLevel } from '../../core/models';
import { describeError } from '../../shared/api/api-client.service';
import { ItemsApi } from '../../shared/api/items-api.service';
import { LocationsApi } from '../../shared/api/locations-api.service';
import { MovementsApi } from '../../shared/api/movements-api.service';

@Component({
  selector: 'app-movement-form',
  imports: [FormsModule, RouterLink],
  templateUrl: './movement-form.component.html',
  styleUrl: './movement-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly itemsApi = inject(ItemsApi);
  private readonly locationsApi = inject(LocationsApi);
  private readonly movementsApi = inject(MovementsApi);

  readonly items = signal<Item[]>([]);
  readonly locations = signal<Location[]>([]);

  /** Only the selected item's balances — refreshed whenever the item changes. */
  readonly stockLevels = signal<StockLevel[]>([]);

  readonly search = signal('');
  readonly submitError = signal<string | null>(null);
  readonly saving = signal(false);

  constructor() {
    void this.loadCatalogue();
    effect(() => {
      const id = this.itemId();
      void this.loadBalances(id);
    });
  }

  private async loadCatalogue(): Promise<void> {
    try {
      const [items, locations] = await Promise.all([
        this.itemsApi.listAll(),
        this.locationsApi.list(),
      ]);
      this.items.set(items);
      this.locations.set(locations);
    } catch (error) {
      this.submitError.set(describeError(error, 'Could not load items and locations.'));
    }
  }

  private async loadBalances(id: string): Promise<void> {
    if (!id) {
      this.stockLevels.set([]);
      return;
    }
    try {
      this.stockLevels.set((await this.itemsApi.get(id)).stockLevels);
    } catch {
      // A missing breakdown only costs the balance hint; the server still
      // rejects an over-draw, so the wizard stays usable.
      this.stockLevels.set([]);
    }
  }

  /** Wizard state lives entirely in the URL, so /movements/new?step=3 restores. */
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly step = computed(() => {
    const raw = Number(this.params().get('step') ?? '1');
    return Math.min(3, Math.max(1, Number.isFinite(raw) ? raw : 1));
  });

  readonly itemId = computed(() => this.params().get('itemId') ?? this.items()[0]?.id ?? '');
  readonly type = computed<MovementType>(() => {
    const raw = this.params().get('type');
    return raw === 'IN' || raw === 'OUT' || raw === 'TRANSFER' ? raw : 'OUT';
  });

  // Defaults come from the loaded locations, never from hard-coded ids.
  readonly fromLocId = computed(() => this.params().get('from') ?? this.locations()[0]?.id ?? '');
  readonly toLocId = computed(
    () => this.params().get('to') ?? this.locations()[1]?.id ?? this.locations()[0]?.id ?? '',
  );
  readonly qty = computed(() => Math.max(1, Number(this.params().get('qty') ?? '1') || 1));
  readonly note = computed(() => this.params().get('note') ?? '');

  readonly selectedItem = computed(() => this.items().find((item) => item.id === this.itemId()) ?? null);

  readonly filteredItems = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.items();
    return this.items().filter(
      (item) => item.sku.toLowerCase().includes(term) || item.name.toLowerCase().includes(term),
    );
  });

  readonly needsFrom = computed(() => this.type() === 'OUT' || this.type() === 'TRANSFER');
  readonly needsTo = computed(() => this.type() === 'IN' || this.type() === 'TRANSFER');

  readonly sameLocation = computed(
    () => this.type() === 'TRANSFER' && this.fromLocId() === this.toLocId(),
  );

  /** Balance at the source location — shown on step 3 and used to pre-validate qty. */
  readonly sourceBalance = computed(() => {
    if (!this.needsFrom()) return null;
    const level = this.stockLevels().find(
      (entry) => entry.itemId === this.itemId() && entry.locationId === this.fromLocId(),
    );
    return level?.qty ?? 0;
  });

  readonly insufficient = computed(() => {
    const balance = this.sourceBalance();
    return balance !== null && this.qty() > balance;
  });

  readonly stepTwoValid = computed(() => {
    if (this.sameLocation()) return false;
    if (this.needsFrom() && !this.fromLocId()) return false;
    if (this.needsTo() && !this.toLocId()) return false;
    return true;
  });

  locationName(id: string | null): string {
    if (!id) return '—';
    return this.locations().find((location) => location.id === id)?.name ?? '—';
  }

  balanceAt(locationId: string): number {
    const level = this.stockLevels().find(
      (entry) => entry.itemId === this.itemId() && entry.locationId === locationId,
    );
    return level?.qty ?? 0;
  }

  typeLabel(type: MovementType): string {
    if (type === 'IN') return 'Stock in';
    if (type === 'OUT') return 'Stock out';
    return 'Transfer';
  }

  typeHint(type: MovementType): string {
    if (type === 'IN') return 'Receive goods into one location';
    if (type === 'OUT') return 'Issue goods out of one location';
    return 'Move goods between two locations';
  }

  chooseItem(id: string): void {
    this.patch({ itemId: id, step: '2' });
  }

  chooseType(type: MovementType): void {
    this.patch({ type });
  }

  setFrom(id: string): void {
    this.patch({ from: id });
  }

  setTo(id: string): void {
    this.patch({ to: id });
  }

  setQty(value: number): void {
    this.submitError.set(null);
    this.patch({ qty: String(Math.max(1, Math.floor(value) || 1)) });
  }

  setNote(value: string): void {
    this.patch({ note: value || null });
  }

  goToStep(step: number): void {
    this.patch({ step: String(step) });
  }

  /**
   * POST /api/movements. The server applies the debit inside a serializable
   * transaction with the balance check in the WHERE clause, so its 400
   * "Insufficient stock" is authoritative and means nothing was written — the
   * client-side check below is only there to catch the obvious case earlier.
   */
  async submit(): Promise<void> {
    if (this.saving()) return;
    if (this.sameLocation()) {
      this.submitError.set('A transfer must use two different locations.');
      return;
    }
    if (this.insufficient()) {
      this.submitError.set(
        `Insufficient stock — ${this.locationName(this.fromLocId())} holds only ${this.sourceBalance()} ${this.selectedItem()?.unit ?? 'units'}. The balance is left unchanged.`,
      );
      return;
    }

    this.saving.set(true);
    this.submitError.set(null);
    try {
      await this.movementsApi.create({
        type: this.type(),
        itemId: this.itemId(),
        fromLocId: this.needsFrom() ? this.fromLocId() : null,
        toLocId: this.needsTo() ? this.toLocId() : null,
        qty: this.qty(),
        note: this.note().trim() || null,
      });
      await this.router.navigate(['/items', this.itemId(), 'movements']);
    } catch (error) {
      this.submitError.set(describeError(error, 'Could not record this movement.'));
      // Re-read the balance: the failure may be because someone else moved it.
      void this.loadBalances(this.itemId());
    } finally {
      this.saving.set(false);
    }
  }

  private patch(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
