import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { Item } from '../../core/models';
import { ApiError, describeError } from '../../shared/api/api-client.service';
import { ItemsApi } from '../../shared/api/items-api.service';

@Component({
  selector: 'app-item-detail',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './item-detail.component.html',
  styleUrl: './item-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ItemsApi);
  readonly auth = inject(AuthService);

  readonly item = signal<Item | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  readonly itemId = computed(() => this.params().get('id') ?? '');

  constructor() {
    // Re-runs when the :id segment changes, so navigating item -> item reloads.
    effect(() => {
      const id = this.itemId();
      void this.load(id);
    });
  }

  /**
   * A 404 is a real outcome here (a deep link to a deleted item), so it clears
   * the item and lets the template show its "not found" state rather than
   * surfacing a transport error.
   */
  private async load(id: string): Promise<void> {
    if (!id) {
      this.item.set(null);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    try {
      this.item.set(await this.api.get(id));
      this.error.set(null);
    } catch (error) {
      this.item.set(null);
      this.error.set(error instanceof ApiError && error.status === 404 ? null : describeError(error));
    } finally {
      this.loading.set(false);
    }
  }

  readonly isLow = computed(() => {
    const current = this.item();
    return !!current && current.totalOnHand <= current.reorderAt;
  });
}
