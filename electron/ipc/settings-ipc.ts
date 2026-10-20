import { getSettingsPayload, setSetting } from '../services/settings';
import { settingsSchema, type Settings } from '../../shared/settings';

const allKeys = Object.keys(settingsSchema.shape) as (keyof Settings)[];

export function settingsGet(): Partial<Settings> | Partial<Record<string, unknown>> {
  return getSettingsPayload();
}

export function settingsSet(raw: [string, unknown]): void {
  const [key, value] = raw;
  if (!(allKeys as string[]).includes(key)) {
    throw new Error(`Unknown settings key: ${key}`);
  }
  setSetting(key as keyof Settings, value);
}
