import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Item, Location, MovementType, StockLevel } from '../../core/models';

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

  readonly locations = signal<Location[]>([
    { id: 'loc-a', name: 'Zone A', zone: 'Receiving', itemsStocked: 4 },
    { id: 'loc-b', name: 'Zone B', zone: 'Main floor', itemsStocked: 5 },
    { id: 'loc-c', name: 'Zone C', zone: 'Dispatch', itemsStocked: 3 },
  ]);

  readonly stockLevels = signal<StockLevel[]>([
    { id: 'sl-1', itemId: 'itm-1', locationId: 'loc-a', locationName: 'Zone A', locationZone: 'Receiving', qty: 60 },
    { id: 'sl-2', itemId: 'itm-1', locationId: 'loc-b', locationName: 'Zone B', locationZone: 'Main floor', qty: 88 },
    { id: 'sl-3', itemId: 'itm-2', locationId: 'loc-a', locationName: 'Zone A', locationZone: 'Receiving', qty: 120 },
    { id: 'sl-4', itemId: 'itm-2', locationId: 'loc-b', locationName: 'Zone B', locationZone: 'Main floor', qty: 200 },
    { id: 'sl-5', itemId: 'itm-3', locationId: 'loc-b', locationName: 'Zone B', locationZone: 'Main floor', qty: 40 },
    { id: 'sl-6', itemId: 'itm-4', locationId: 'loc-a', locationName: 'Zone A', locationZone: 'Receiving', qty: 200 },
    { id: 'sl-7', itemId: 'itm-4', locationId: 'loc-b', locationName: 'Zone B', locationZone: 'Main floor', qty: 312 },
    { id: 'sl-8', itemId: 'itm-4', locationId: 'loc-c', locationName: 'Zone C', locationZone: 'Dispatch', qty: 100 },
    { id: 'sl-9', itemId: 'itm-5', locationId: 'loc-c', locationName: 'Zone C', locationZone: 'Dispatch', qty: 12 },
    { id: 'sl-10', itemId: 'itm-6', locationId: 'loc-a', locationName: 'Zone A', locationZone: 'Receiving', qty: 90 },
    { id: 'sl-11', itemId: 'itm-6', locationId: 'loc-b', locationName: 'Zone B', locationZone: 'Main floor', qty: 120 },
    { id: 'sl-12', itemId: 'itm-8', locationId: 'loc-c', locationName: 'Zone C', locationZone: 'Dispatch', qty: 9 },
  ]);

  readonly search = signal('');
  readonly submitError = signal<string | null>(null);

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
  readonly fromLocId = computed(() => this.params().get('from') ?? 'loc-a');
  readonly toLocId = computed(() => this.params().get('to') ?? 'loc-b');
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

  submit(): void {
    if (this.insufficient()) {
      // The server's 400 is authoritative; the client check mirrors its wording.
      this.submitError.set(
        `Insufficient stock — ${this.locationName(this.fromLocId())} holds only ${this.sourceBalance()} ${this.selectedItem()?.unit ?? 'units'}. The balance is left unchanged.`,
      );
      return;
    }
    if (this.sameLocation()) {
      this.submitError.set('A transfer must use two different locations.');
      return;
    }
    this.submitError.set(null);
    void this.router.navigate(['/items', this.itemId(), 'movements']);
  }

  private patch(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
