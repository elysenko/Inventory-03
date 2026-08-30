import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '../../core/models';

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

  readonly locations = signal<Location[]>([
    { id: 'loc-a', name: 'Zone A', zone: 'Receiving', itemsStocked: 4 },
    { id: 'loc-b', name: 'Zone B', zone: 'Main floor', itemsStocked: 5 },
    { id: 'loc-c', name: 'Zone C', zone: 'Dispatch', itemsStocked: 3 },
  ]);

  // Fixed vocabulary, not API data — kept out of the signal<T[]> data contract.
  readonly zones: readonly string[] = ['Receiving', 'Main floor', 'Dispatch', 'Cold store', 'Overflow'];

  readonly isEdit = this.route.snapshot.data['mode'] === 'edit';
  private readonly editId = this.route.snapshot.paramMap.get('id') ?? '';

  private readonly existing = computed(
    () => this.locations().find((location) => location.id === this.editId) ?? null,
  );

  readonly name = signal('');
  readonly zone = signal('Receiving');
  readonly nameError = signal<string | null>(null);
  readonly deleteBlocked = signal<string | null>(null);

  constructor() {
    const current = this.existing();
    if (this.isEdit && current) {
      this.name.set(current.name);
      this.zone.set(current.zone);
    }
  }

  readonly itemsStocked = computed(() => this.existing()?.itemsStocked ?? 0);

  submit(): void {
    this.nameError.set(null);
    const name = this.name().trim();
    if (!name) {
      this.nameError.set('A location name is required.');
      return;
    }
    // Mirrors the API's 409 on a duplicate location name.
    const clash = this.locations().some(
      (location) => location.name.toLowerCase() === name.toLowerCase() && location.id !== this.editId,
    );
    if (clash) {
      this.nameError.set(`A location named “${name}” already exists.`);
      return;
    }
    void this.router.navigate(['/locations']);
  }

  tryDelete(): void {
    if (this.itemsStocked() > 0) {
      this.deleteBlocked.set(
        `This location still holds stock for ${this.itemsStocked()} item(s) and appears in the movement log. Deleting it would break the audit trail, so it is blocked until the stock is moved out.`,
      );
      return;
    }
    void this.router.navigate(['/locations']);
  }

  cancel(): void {
    void this.router.navigate(['/locations']);
  }
}
