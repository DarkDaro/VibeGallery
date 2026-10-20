import { z } from 'zod';
import type { Settings, SettingsKey } from './settings';

export const pingResultSchema = z.object({
  pong: z.number(),
  electron: z.string(),
  debug: z.boolean(),
});
export type PingResult = z.infer<typeof pingResultSchema>;

export type SettingsRecord = Partial<Record<SettingsKey | '_hetero', string | number | string>>;

export type SettingsPayload = Partial<Settings>;

export const setSettingPayloadSchema = z.tuple([z.string().min(1), z.unknown()]);

/**
 * Request/response map of IPC channels. The single source of truth for preload,
 * main and renderer. Names — 'domain:action'.
 */
export interface IpcContracts {
  'app:ping': { req: void; res: PingResult };
  'settings:get': { req: void; res: SettingsPayload };
  'settings:set': { req: [key: string, value: unknown]; res: void };
}

export type IpcChannel = keyof IpcContracts;
export type IpcPayload<C extends IpcChannel> = IpcContracts[C]['req'];
export type IpcResult<C extends IpcChannel> = IpcContracts[C]['res'];

export const IPC_CHANNELS: readonly IpcChannel[] = Object.freeze([
  'app:ping',
  'settings:get',
  'settings:set',
] as IpcChannel[]);

/** Events that the main event sends to the renderer (push, not request/response). */
export interface IpcEvents {
  'settings:changed': { key: string; value: unknown };
  'theme:systemChanged': { isDark: boolean };
}

export type IpcEventName = keyof IpcEvents;
export type IpcEventData<E extends IpcEventName> = IpcEvents[E];

export const IPC_EVENTS: readonly IpcEventName[] = Object.freeze([
  'settings:changed',
  'theme:systemChanged',
] as IpcEventName[]);

declare global {
  interface Window {
    vibe: {
      invoke<C extends IpcChannel>(channel: C, payload?: IpcPayload<C>): Promise<IpcResult<C>>;
      on<E extends IpcEventName>(event: E, listener: (data: IpcEventData<E>) => void): () => void;
    };
  }
}
