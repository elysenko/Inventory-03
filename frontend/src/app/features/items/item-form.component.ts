import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError, describeError } from '../../shared/api/api-client.service';
import { ItemsApi } from '../../shared/api/items-api.service';

// Fixed vocabulary, not API data — kept out of the signal<T[]> data contract.
const UNITS: readonly string[] = ['each', 'roll', 'box', 'pair', 'kg', 'litre', 'metre', 'pallet'];

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
  private readonly api = inject(ItemsApi);

  readonly isEdit = this.route.snapshot.data['mode'] === 'edit';
  private readonly editId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly sku = signal('');
  readonly name = signal('');
  readonly description = signal('');
  readonly unit = signal('each');
  readonly reorderAt = signal(10);

  readonly skuError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly saving = signal(false);

  /** The stored unit may predate the vocabulary, so keep it selectable. */
  readonly units = computed<readonly string[]>(() => {
    const current = this.unit();
    return UNITS.includes(current) ? UNITS : [current, ...UNITS];
  });

  constructor() {
    if (this.isEdit && this.editId) void this.loadExisting(this.editId);
  }

  private async loadExisting(id: string): Promise<void> {
    try {
      const item = await this.api.get(id);
      this.sku.set(item.sku);
      this.name.set(item.name);
      this.description.set(item.description ?? '');
      this.unit.set(item.unit);
      this.reorderAt.set(item.reorderAt);
    } catch (error) {
      this.formError.set(describeError(error, 'Could not load this item.'));
    }
  }

  /**
   * POST/PATCH /api/items. The server owns SKU uniqueness: its 409 carries
   * `field: 'sku'`, which is attached to that control instead of the page-level
   * banner so the duplicate reads as a field error.
   */
  async submit(): Promise<void> {
    if (this.saving()) return;
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

    const payload = {
      sku,
      name: this.name().trim(),
      description: this.description().trim() || null,
      unit: this.unit(),
      reorderAt: Math.trunc(this.reorderAt()),
    };

    this.saving.set(true);
    try {
      const saved = this.isEdit
        ? await this.api.update(this.editId, payload)
        : await this.api.create(payload);
      await this.router.navigate(['/items', saved.id]);
    } catch (error) {
      if (error instanceof ApiError && error.field === 'sku') this.skuError.set(error.message);
      else this.formError.set(describeError(error, 'Could not save this item.'));
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(this.isEdit && this.editId ? ['/items', this.editId] : ['/items']);
  }
}
