import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { StockLevel } from '../../core/models';
import { describeError } from '../../shared/api/api-client.service';
import { ItemsApi } from '../../shared/api/items-api.service';

@Component({
  selector: 'app-item-locations-tab',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './item-locations-tab.component.html',
  styleUrl: './item-locations-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemLocationsTabComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ItemsApi);

  readonly stockLevels = signal<StockLevel[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** The :id param lives on the parent route, so read it from there. */
  private readonly itemId = toSignal(
    this.route.parent!.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: this.route.parent?.snapshot.paramMap.get('id') ?? '' },
  );

  constructor() {
    effect(() => {
      const id = this.itemId();
      void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    if (!id) {
      this.stockLevels.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    try {
      const detail = await this.api.get(id);
      this.stockLevels.set(detail.stockLevels);
      this.error.set(null);
    } catch (error) {
      this.stockLevels.set([]);
      this.error.set(describeError(error, 'Could not load the per-location breakdown.'));
    } finally {
      this.loading.set(false);
    }
  }

  readonly rows = computed(() => this.stockLevels());

  /** Footer total must visibly equal the item's totalOnHand. */
  readonly total = computed(() => this.rows().reduce((sum, row) => sum + row.qty, 0));
}
