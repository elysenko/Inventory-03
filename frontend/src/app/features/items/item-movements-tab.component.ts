import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Movement } from '../../core/models';
import { describeError } from '../../shared/api/api-client.service';
import { ItemsApi } from '../../shared/api/items-api.service';

@Component({
  selector: 'app-item-movements-tab',
  imports: [RouterLink, DatePipe],
  templateUrl: './item-movements-tab.component.html',
  styleUrl: './item-movements-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemMovementsTabComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ItemsApi);

  readonly movements = signal<Movement[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

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

  /** GET /api/items/:id/movements — open to clerks, unlike the full audit log. */
  private async load(id: string): Promise<void> {
    if (!id) {
      this.movements.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    try {
      this.movements.set(await this.api.movements(id));
      this.error.set(null);
    } catch (error) {
      this.movements.set([]);
      this.error.set(describeError(error, 'Could not load the movement history.'));
    } finally {
      this.loading.set(false);
    }
  }

  /** The API already returns newest first; the sort keeps that guarantee local. */
  readonly rows = computed(() =>
    [...this.movements()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  badgeClass(type: Movement['type']): string {
    if (type === 'IN') return 'badge badge-in';
    if (type === 'OUT') return 'badge badge-out';
    return 'badge badge-transfer';
  }
}
