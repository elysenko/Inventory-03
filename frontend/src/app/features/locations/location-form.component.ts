import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError, describeError } from '../../shared/api/api-client.service';
import { LocationsApi } from '../../shared/api/locations-api.service';

// Fixed vocabulary, not API data — kept out of the signal<T[]> data contract.
const ZONES: readonly string[] = ['Receiving', 'Main floor', 'Dispatch', 'Cold store', 'Overflow'];

@Component({
  selector: 'app-location-form',
  imports: [FormsModule, RouterLink],
  templateUrl: './location-form.component.html',
  styleUrl: './location-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(LocationsApi);

  readonly isEdit = this.route.snapshot.data['mode'] === 'edit';
  private readonly editId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly name = signal('');
  readonly zone = signal('Receiving');
  readonly nameError = signal<string | null>(null);
  readonly deleteBlocked = signal<string | null>(null);
  readonly saving = signal(false);

  /** Live count from the API, used by the danger-zone copy. */
  readonly itemsStocked = signal(0);

  /** A stored zone outside the vocabulary must still be selectable. */
  readonly zones = computed<readonly string[]>(() => {
    const current = this.zone();
    return ZONES.includes(current) ? ZONES : [current, ...ZONES];
  });

  constructor() {
    if (this.isEdit && this.editId) void this.loadExisting(this.editId);
  }

  private async loadExisting(id: string): Promise<void> {
    try {
      const location = await this.api.get(id);
      this.name.set(location.name);
      this.zone.set(location.zone);
      this.itemsStocked.set(location.itemsStocked);
    } catch (error) {
      this.nameError.set(describeError(error, 'Could not load this location.'));
    }
  }

  /** The API's 409 on a duplicate name arrives with `field: 'name'`. */
  async submit(): Promise<void> {
    if (this.saving()) return;
    this.nameError.set(null);
    const name = this.name().trim();
    if (!name) {
      this.nameError.set('A location name is required.');
      return;
    }

    this.saving.set(true);
    try {
      const payload = { name, zone: this.zone() };
      if (this.isEdit) await this.api.update(this.editId, payload);
      else await this.api.create(payload);
      await this.router.navigate(['/locations']);
    } catch (error) {
      this.nameError.set(describeError(error, 'Could not save this location.'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Blocked server-side with 409 while any stock or movement references it. */
  async tryDelete(): Promise<void> {
    this.deleteBlocked.set(null);
    try {
      await this.api.remove(this.editId);
      await this.router.navigate(['/locations']);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) this.deleteBlocked.set(error.message);
      else this.deleteBlocked.set(describeError(error, 'Could not delete this location.'));
    }
  }

  cancel(): void {
    void this.router.navigate(['/locations']);
  }
}
