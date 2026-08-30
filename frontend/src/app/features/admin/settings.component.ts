import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingEntry } from '../../core/models';
import { describeError } from '../../shared/api/api-client.service';
import { SettingsApi } from '../../shared/api/settings-api.service';

interface ServiceGroup {
  service: string;
  label: string;
  blurb: string;
  entries: SettingEntry[];
  configured: boolean;
}

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly api = inject(SettingsApi);

  readonly saved = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  /**
   * GET /api/admin/settings reports each slot's *effective* state — the env var
   * first, a DB override second — so this screen shows what the running app
   * will actually use. Secret values arrive masked and are never echoed back.
   */
  readonly settings = signal<SettingEntry[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.settings.set(await this.api.list());
      this.error.set(null);
    } catch (error) {
      this.settings.set([]);
      this.error.set(describeError(error, 'Could not load the service credentials.'));
    } finally {
      this.loading.set(false);
    }
  }

  // Presentation copy, not API data.
  private readonly serviceMeta: readonly { service: string; label: string; blurb: string }[] = [
    { service: 'postgresql', label: 'PostgreSQL', blurb: 'Primary datastore for items, locations, stock levels and the movement audit log.' },
    { service: 'minio', label: 'MinIO', blurb: 'Object storage, provisioned but not yet used by any StockRoom feature.' },
  ];

  readonly groups = computed<ServiceGroup[]>(() =>
    this.serviceMeta.map((meta) => {
      const entries = this.settings().filter((entry) => entry.service === meta.service);
      return {
        ...meta,
        entries,
        configured: entries.length > 0 && entries.every((entry) => entry.configured),
      };
    }),
  );

  readonly unconfigured = computed(() => this.groups().filter((group) => !group.configured));

  updateValue(key: string, value: string): void {
    this.saved.set(null);
    this.settings.update((entries) =>
      entries.map((entry) =>
        entry.key === key ? { ...entry, value, configured: value.trim().length > 0 } : entry,
      ),
    );
  }

  /**
   * PATCH /api/admin/settings with just this group's slots. Re-sending an
   * untouched secret sends the mask back, which the server treats as "leave it
   * alone" rather than overwriting the credential with bullet characters.
   */
  async save(group: ServiceGroup): Promise<void> {
    this.error.set(null);
    try {
      this.settings.set(
        await this.api.update(group.entries.map((entry) => ({ key: entry.key, value: entry.value }))),
      );
      this.saved.set(`${group.label} credentials saved.`);
    } catch (error) {
      this.saved.set(null);
      this.error.set(describeError(error, 'Could not save these credentials.'));
    }
  }
}
