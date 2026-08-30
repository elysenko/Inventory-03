import { Injectable, inject } from '@angular/core';
import { SettingEntry } from '../../core/models';
import { ApiClient } from './api-client.service';

export interface SettingValue {
  key: string;
  value: string;
}

/**
 * Credential slots for the provisioned backing services (PostgreSQL, MinIO).
 * Secrets come back masked — the real value never leaves the server — so
 * re-submitting the mask is a no-op on the API side.
 */
@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly api = inject(ApiClient);

  list(): Promise<SettingEntry[]> {
    return this.api.get<SettingEntry[]>('/admin/settings');
  }

  update(entries: SettingValue[]): Promise<SettingEntry[]> {
    return this.api.patch<SettingEntry[]>('/admin/settings', { entries });
  }
}
