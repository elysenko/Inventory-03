import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { Location } from '../../core/models';

@Component({
  selector: 'app-location-list',
  imports: [RouterLink],
  templateUrl: './location-list.component.html',
  styleUrl: './location-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly locations = signal<Location[]>([
    { id: 'loc-a', name: 'Zone A', zone: 'Receiving', itemsStocked: 4 },
    { id: 'loc-b', name: 'Zone B', zone: 'Main floor', itemsStocked: 5 },
    { id: 'loc-c', name: 'Zone C', zone: 'Dispatch', itemsStocked: 3 },
  ]);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly query = computed(() => this.params().get('q') ?? '');

  readonly filtered = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return this.locations();
    return this.locations().filter(
      (location) =>
        location.name.toLowerCase().includes(term) || location.zone.toLowerCase().includes(term),
    );
  });

  /** Set when a delete is blocked, mirroring the API's 409 on a referenced location. */
  readonly deleteBlocked = signal<string | null>(null);

  onSearch(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: value || null },
      queryParamsHandling: 'merge',
    });
  }

  tryDelete(location: Location): void {
    if (location.itemsStocked > 0) {
      this.deleteBlocked.set(
        `${location.name} still holds stock for ${location.itemsStocked} item(s) and is referenced by the movement log, so it cannot be deleted. Move the stock out first.`,
      );
      return;
    }
    this.deleteBlocked.set(null);
  }

  dismissBlocked(): void {
    this.deleteBlocked.set(null);
  }
}
