import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { StockLevel } from '../../core/models';

@Component({
  selector: 'app-item-locations-tab',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './item-locations-tab.component.html',
  styleUrl: './item-locations-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemLocationsTabComponent {
  private readonly route = inject(ActivatedRoute);

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

  /** The :id param lives on the parent route, so read it from there. */
  private readonly itemId = toSignal(
    this.route.parent!.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: this.route.parent?.snapshot.paramMap.get('id') ?? '' },
  );

  readonly rows = computed(() => this.stockLevels().filter((level) => level.itemId === this.itemId()));

  /** Footer total must visibly equal the item's totalOnHand. */
  readonly total = computed(() => this.rows().reduce((sum, row) => sum + row.qty, 0));
}
