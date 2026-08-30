import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { Item } from '../../core/models';

@Component({
  selector: 'app-item-detail',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './item-detail.component.html',
  styleUrl: './item-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetailComponent {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

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

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  readonly itemId = computed(() => this.params().get('id') ?? '');

  /** Falls back to the first item so a deep link with an unknown id still renders. */
  readonly item = computed<Item | null>(() => {
    const list = this.items();
    if (list.length === 0) return null;
    return list.find((entry) => entry.id === this.itemId()) ?? list[0];
  });

  readonly isLow = computed(() => {
    const current = this.item();
    return !!current && current.totalOnHand <= current.reorderAt;
  });
}
