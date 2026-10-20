import { ipcMain } from 'electron';
import { z } from 'zod';
import { ping } from './app-ipc';
import { buildLibraryRegistry } from './library-ipc';
import { settingsGet, settingsSet } from './settings-ipc';
import { settingsSchema } from '../../shared/settings';

export interface RegistryEntry {
  /** undefined = void payload. */
  req?: z.ZodType;
  handler: (payload: any) => unknown;
}

export interface LibraryIpcBootstrap {
  /** Built in main.ts: needs repos + scan manager + dirs. Passing through. */
  deps: Parameters<typeof buildLibraryRegistry>[0];
}

const voidSchema = z.undefined();

const setSchema = z.tuple([z.string().min(1), z.unknown()]);

const keysSchema = z.enum(Object.keys(settingsSchema.shape) as [string, ...string[]]);

function baseRegistry(): Record<string, RegistryEntry> {
  return {
    'app:ping': { req: voidSchema, handler: () => ping() },
    'settings:get': { req: voidSchema, handler: () => settingsGet() },
    'settings:set': {
      req: setSchema.refine(([k]) => keysSchema.safeParse(k).success, 'unknown settings key'),
      handler: (payload: [string, unknown]) => settingsSet(payload),
    },
  };
}

export function registerIpc(library?: LibraryIpcBootstrap): void {
  const registry: Record<string, RegistryEntry> = baseRegistry();
  if (library) Object.assign(registry, buildLibraryRegistry(library.deps));

  for (const [channel, entry] of Object.entries(registry)) {
    ipcMain.handle(channel, (_event, payload: unknown) => {
      const parsed = (entry.req ?? voidSchema).safeParse(payload);
      if (!parsed.success) {
        throw new Error(`Invalid IPC payload for "${channel}": ${parsed.error.issues[0]?.message ?? 'unknown'}`);
      }
      return entry.handler(parsed.data);
    });
  }
}
