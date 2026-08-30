import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingEntry } from '../../core/models';

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
  readonly saved = signal<string | null>(null);

  readonly settings = signal<SettingEntry[]>([
    { key: 'DATABASE_URL', service: 'postgresql', label: 'Connection URL', value: 'postgresql://stockroom:••••••••@db:5432/stockroom', configured: true, secret: true },
    { key: 'JWT_SECRET', service: 'postgresql', label: 'JWT signing secret', value: '••••••••••••••••', configured: true, secret: true },
    { key: 'MINIO_ENDPOINT', service: 'minio', label: 'Endpoint', value: '', configured: false, secret: false },
    { key: 'MINIO_ACCESS_KEY', service: 'minio', label: 'Access key', value: '', configured: false, secret: true },
    { key: 'MINIO_SECRET_KEY', service: 'minio', label: 'Secret key', value: '', configured: false, secret: true },
  ]);

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

  save(group: ServiceGroup): void {
    this.saved.set(`${group.label} credentials saved.`);
  }
}
