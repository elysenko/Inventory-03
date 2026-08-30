import { Injectable, inject } from '@angular/core';
import { Location } from '../../core/models';
import { ApiClient } from './api-client.service';

export interface LocationInput {
  name: string;
  zone: string;
}

/** Readable by every authenticated role — clerks need it for the movement wizard. */
@Injectable({ providedIn: 'root' })
export class LocationsApi {
  private readonly api = inject(ApiClient);

  list(q?: string): Promise<Location[]> {
    return this.api.get<Location[]>('/locations', { q });
  }

  get(id: string): Promise<Location> {
    return this.api.get<Location>(`/locations/${encodeURIComponent(id)}`);
  }

  create(input: LocationInput): Promise<Location> {
    return this.api.post<Location>('/locations', input);
  }

  update(id: string, input: Partial<LocationInput>): Promise<Location> {
    return this.api.patch<Location>(`/locations/${encodeURIComponent(id)}`, input);
  }

  remove(id: string): Promise<{ id: string; deleted: true }> {
    return this.api.delete<{ id: string; deleted: true }>(`/locations/${encodeURIComponent(id)}`);
  }
}
