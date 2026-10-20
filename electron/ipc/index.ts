import { ipcMain } from 'electron';
import { z } from 'zod';
import { ping } from './app-ipc';
import { settingsGet, settingsSet } from './settings-ipc';
import { settingsSchema } from '../../shared/settings';

interface RegistryEntry {
  req: z.ZodType;
  handler: (payload: any) => unknown;
}

const voidSchema = z.undefined();

const setSchema = z.tuple([z.string().min(1), z.unknown()]);

const keysSchema = z.enum(Object.keys(settingsSchema.shape) as [string, ...string[]]);

const registry: Record<string, RegistryEntry> = {
  'app:ping': { req: voidSchema, handler: () => ping() },
  'settings:get': { req: voidSchema, handler: () => settingsGet() },
  'settings:set': {
    req: setSchema.refine(([k]) => keysSchema.safeParse(k).success, 'unknown settings key'),
    handler: (payload: [string, unknown]) => settingsSet(payload),
  },
};

export function registerIpc(): void {
  for (const [channel, entry] of Object.entries(registry)) {
    ipcMain.handle(channel, (_event, payload: unknown) => {
      const parsed = entry.req.safeParse(payload);
      if (!parsed.success) {
        throw new Error(`Invalid IPC payload for "${channel}": ${parsed.error.issues[0]?.message ?? 'unknown'}`);
      }
      return entry.handler(parsed.data);
    });
  }
}
