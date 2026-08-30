import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Item } from '../../core/models';

@Component({
  selector: 'app-item-form',
  imports: [FormsModule, RouterLink],
  templateUrl: './item-form.component.html',
  styleUrl: './item-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly items = signal<Item[]>([
    { id: 'itm-1', sku: 'SKU-001', name: 'Steel bracket 40mm', description: 'Zinc-plated L bracket', unit: 'each', reorderAt: 25, totalOnHand: 148, createdAt: '2026-05-02T09:12:00Z' },
    { id: 'itm-2', sku: 'SKU-002', name: 'Hex bolt M8 x 40', description: 'Grade 8.8 hex head bolt', unit: 'each', reorderAt: 500, totalOnHand: 320, createdAt: '2026-05-02T09:14:00Z' },
    { id: 'itm-3', sku: 'SKU-003', name: 'Packing tape 48mm', description: 'Clear polypropylene, 66m', unit: 'roll', reorderAt: 40, totalOnHand: 40, createdAt: '2026-05-03T11:40:00Z' },
    { id: 'itm-5', sku: 'SKU-005', name: 'Pallet wrap', description: '500mm stretch film', unit: 'roll', reorderAt: 30, totalOnHand: 12, createdAt: '2026-05-06T14:22:00Z' },
  ]);

  // Fixed vocabulary, not API data — kept out of the signal<T[]> data contract.
  readonly units: readonly string[] = ['each', 'roll', 'box', 'pair', 'kg', 'litre', 'metre', 'pallet'];

  readonly isEdit = this.route.snapshot.data['mode'] === 'edit';
  private readonly editId = this.route.snapshot.paramMap.get('id') ?? '';

  private readonly existing = computed(() => this.items().find((item) => item.id === this.editId) ?? null);

  readonly sku = signal('');
  readonly name = signal('');
  readonly description = signal('');
  readonly unit = signal('each');
  readonly reorderAt = signal(10);

  readonly skuError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly saving = signal(false);

  constructor() {
    const current = this.existing();
    if (this.isEdit && current) {
      this.sku.set(current.sku);
      this.name.set(current.name);
      this.description.set(current.description ?? '');
      this.unit.set(current.unit);
      this.reorderAt.set(current.reorderAt);
    } else if (this.isEdit) {
      this.sku.set('SKU-001');
      this.name.set('Steel bracket 40mm');
      this.description.set('Zinc-plated L bracket');
      this.reorderAt.set(25);
    }
  }

  submit(): void {
    this.skuError.set(null);
    this.formError.set(null);

    const sku = this.sku().trim();
    if (!sku) {
      this.skuError.set('A SKU is required.');
      return;
    }
    if (!this.name().trim()) {
      this.formError.set('A name is required.');
      return;
    }
    if (this.reorderAt() < 0) {
      this.formError.set('The reorder point cannot be negative.');
      return;
    }

    // Mirrors the API's 409 on a duplicate SKU, surfaced as an inline field error.
    const clash = this.items().some(
      (item) => item.sku.toLowerCase() === sku.toLowerCase() && item.id !== this.editId,
    );
    if (clash) {
      this.skuError.set(`SKU ${sku} is already used by another item.`);
      return;
    }

    this.saving.set(true);
    void this.router.navigate(['/items']);
  }

  cancel(): void {
    void this.router.navigate(this.isEdit && this.editId ? ['/items', this.editId] : ['/items']);
  }
}
