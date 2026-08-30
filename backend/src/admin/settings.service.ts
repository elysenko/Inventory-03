import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isUsable, resolveConfig, resolveEnv } from '../lib/config';
import type { SettingEntryDto } from '../lib/api-types';
import { MASK, SETTINGS_CATALOG, SETTINGS_KEYS } from './settings.catalog';
import { SettingValueDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reports each slot's *effective* state — env var first, DB override second —
   * so the screen can show what the running app will actually use. Secrets are
   * masked rather than echoed; a value set from the environment is still
   * reported as configured even though it was never stored in the DB.
   */
  async list(): Promise<SettingEntryDto[]> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: [...SETTINGS_KEYS] } },
    });
    const stored = new Map(rows.map((row) => [row.key, row.value]));

    return SETTINGS_CATALOG.map((definition) => {
      const fromEnv = resolveEnv(definition.key);
      const fromDb = stored.get(definition.key);
      const effective = fromEnv ?? (isUsable(fromDb) ? fromDb : null);
      const configured = effective !== null;

      return {
        key: definition.key,
        service: definition.service,
        label: definition.label,
        value: configured ? (definition.secret ? MASK : effective) : '',
        configured,
        secret: definition.secret,
      };
    });
  }

  /**
   * Upserts overrides for known keys only. A blank value clears the override
   * and falls the key back to whatever the environment provides.
   */
  async update(entries: SettingValueDto[]): Promise<SettingEntryDto[]> {
    const unknown = entries.filter((entry) => !SETTINGS_KEYS.includes(entry.key));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown setting key(s): ${unknown.map((entry) => entry.key).join(', ')}.`,
      );
    }

    for (const entry of entries) {
      const value = entry.value.trim();
      // The mask is what a GET returns for a configured secret; treating it as
      // a real value would overwrite the credential with bullet characters.
      if (value === MASK) continue;

      if (value.length === 0) {
        await this.prisma.systemSetting.deleteMany({ where: { key: entry.key } });
        continue;
      }
      await this.prisma.systemSetting.upsert({
        where: { key: entry.key },
        update: { value },
        create: { key: entry.key, value },
      });
    }

    return this.list();
  }

  /** Convenience wrapper so feature code can resolve a credential in one call. */
  resolve(key: string): Promise<string | null> {
    return resolveConfig(key, this.prisma);
  }
}
