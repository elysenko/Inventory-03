import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Movement } from '../../core/models';

@Component({
  selector: 'app-item-movements-tab',
  imports: [RouterLink, DatePipe],
  templateUrl: './item-movements-tab.component.html',
  styleUrl: './item-movements-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemMovementsTabComponent {
  private readonly route = inject(ActivatedRoute);

  readonly movements = signal<Movement[]>([
    { id: 'mv-101', type: 'IN', itemId: 'itm-1', itemSku: 'SKU-001', itemName: 'Steel bracket 40mm', fromLocId: null, fromLocName: null, toLocId: 'loc-a', toLocName: 'Zone A', qty: 200, note: 'Opening stock — PO 4471', userEmail: 'manager@demo', createdAt: '2026-08-12T08:30:00Z' },
    { id: 'mv-102', type: 'TRANSFER', itemId: 'itm-1', itemSku: 'SKU-001', itemName: 'Steel bracket 40mm', fromLocId: 'loc-a', fromLocName: 'Zone A', toLocId: 'loc-b', toLocName: 'Zone B', qty: 88, note: 'Move to picking face', userEmail: 'clerk@demo', createdAt: '2026-08-19T13:05:00Z' },
    { id: 'mv-103', type: 'OUT', itemId: 'itm-1', itemSku: 'SKU-001', itemName: 'Steel bracket 40mm', fromLocId: 'loc-a', fromLocName: 'Zone A', toLocId: null, toLocName: null, qty: 52, note: 'Works order WO-2213', userEmail: 'clerk@demo', createdAt: '2026-08-26T09:47:00Z' },
    { id: 'mv-104', type: 'IN', itemId: 'itm-2', itemSku: 'SKU-002', itemName: 'Hex bolt M8 x 40', fromLocId: null, fromLocName: null, toLocId: 'loc-b', toLocName: 'Zone B', qty: 500, note: 'Opening stock', userEmail: 'manager@demo', createdAt: '2026-08-12T08:34:00Z' },
    { id: 'mv-105', type: 'OUT', itemId: 'itm-2', itemSku: 'SKU-002', itemName: 'Hex bolt M8 x 40', fromLocId: 'loc-b', fromLocName: 'Zone B', toLocId: null, toLocName: null, qty: 180, note: 'Assembly line draw', userEmail: 'clerk@demo', createdAt: '2026-08-28T15:12:00Z' },
    { id: 'mv-106', type: 'IN', itemId: 'itm-5', itemSku: 'SKU-005', itemName: 'Pallet wrap', fromLocId: null, fromLocName: null, toLocId: 'loc-c', toLocName: 'Zone C', qty: 48, note: 'Opening stock', userEmail: 'manager@demo', createdAt: '2026-08-12T08:41:00Z' },
    { id: 'mv-107', type: 'OUT', itemId: 'itm-5', itemSku: 'SKU-005', itemName: 'Pallet wrap', fromLocId: 'loc-c', fromLocName: 'Zone C', toLocId: null, toLocName: null, qty: 36, note: 'Dispatch consumption', userEmail: 'clerk@demo', createdAt: '2026-08-29T11:20:00Z' },
    { id: 'mv-108', type: 'IN', itemId: 'itm-4', itemSku: 'SKU-004', itemName: 'Cardboard box, large', fromLocId: null, fromLocName: null, toLocId: 'loc-a', toLocName: 'Zone A', qty: 612, note: 'Opening stock — PO 4480', userEmail: 'manager@demo', createdAt: '2026-08-13T10:02:00Z' },
  ]);

  private readonly itemId = toSignal(
    this.route.parent!.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: this.route.parent?.snapshot.paramMap.get('id') ?? '' },
  );

  readonly rows = computed(() =>
    this.movements()
      .filter((movement) => movement.itemId === this.itemId())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  badgeClass(type: Movement['type']): string {
    if (type === 'IN') return 'badge badge-in';
    if (type === 'OUT') return 'badge badge-out';
    return 'badge badge-transfer';
  }
}
