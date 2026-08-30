/**
 * The credential slots surfaced on /admin/settings, grouped by the backing
 * service the platform provisions. Keys outside this list are rejected — the
 * settings endpoint is not a general-purpose key/value store.
 */
export interface SettingDefinition {
  key: string;
  service: string;
  label: string;
  secret: boolean;
}

export const SETTINGS_CATALOG: readonly SettingDefinition[] = [
  { key: 'DATABASE_URL', service: 'postgresql', label: 'Connection URL', secret: true },
  { key: 'JWT_SECRET', service: 'postgresql', label: 'JWT signing secret', secret: true },
  { key: 'MINIO_ENDPOINT', service: 'minio', label: 'Endpoint', secret: false },
  { key: 'MINIO_ACCESS_KEY', service: 'minio', label: 'Access key', secret: true },
  { key: 'MINIO_SECRET_KEY', service: 'minio', label: 'Secret key', secret: true },
];

export const SETTINGS_KEYS: readonly string[] = SETTINGS_CATALOG.map((entry) => entry.key);

/** What a configured secret renders as. The real value never leaves the server. */
export const MASK = '••••••••';
