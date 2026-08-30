import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { Location } from '../../core/models';
import { ApiError, describeError } from '../../shared/api/api-client.service';
import { LocationsApi } from '../../shared/api/locations-api.service';

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
  private readonly api = inject(LocationsApi);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly locations = signal<Location[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.locations.set(await this.api.list());
      this.error.set(null);
    } catch (error) {
      this.locations.set([]);
      this.error.set(describeError(error, 'Could not load locations.'));
    } finally {
      this.loading.set(false);
    }
  }

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

  /** Set from the API's 409 when a location is still referenced. */
  readonly deleteBlocked = signal<string | null>(null);

  onSearch(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: value || null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * The server is authoritative about whether a delete is allowed — it refuses
   * with 409 while any stock or movement references the location — so the
   * request is always attempted and its message is what the banner shows.
   */
  async tryDelete(location: Location): Promise<void> {
    this.deleteBlocked.set(null);
    try {
      await this.api.remove(location.id);
      await this.load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) this.deleteBlocked.set(error.message);
      else this.error.set(describeError(error, 'Could not delete this location.'));
    }
  }

  dismissBlocked(): void {
    this.deleteBlocked.set(null);
  }
}
