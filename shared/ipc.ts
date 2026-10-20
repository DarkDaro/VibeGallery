import { z } from 'zod';
import type { Settings, SettingsKey } from './settings';
import type { ScanErrorRow, SourceRootRow, VideoStatus } from './types';

export const pingResultSchema = z.object({
  pong: z.number(),
  electron: z.string(),
  debug: z.boolean(),
});
export type PingResult = z.infer<typeof pingResultSchema>;

export type SettingsRecord = Partial<Record<SettingsKey | '_hetero', string | number | string>>;

export type SettingsPayload = Partial<Settings>;

export const setSettingPayloadSchema = z.tuple([z.string().min(1), z.unknown()]);

// --- library channels payloads ---

const absolutePathSchema = z.string().min(3).max(500);

export const addSourceRootPayloadSchema = z.tuple([absolutePathSchema]);
export type AddSourceRootPayload = z.infer<typeof addSourceRootPayloadSchema>;

export const removeSourceRootPayloadSchema = z.tuple([z.number().int().positive()]);
export type RemoveSourceRootPayload = z.infer<typeof removeSourceRootPayloadSchema>;

export const setSourceRootEnabledPayloadSchema = z.tuple([z.number().int().positive(), z.boolean()]);
export type SetSourceRootEnabledPayload = z.infer<typeof setSourceRootEnabledPayloadSchema>;

export const scanRootPayloadSchema = z.tuple([z.number().int().positive()]);
export type ScanRootPayload = z.infer<typeof scanRootPayloadSchema>;

export interface SourceRootInfo extends SourceRootRow {
  video_count: number;
}

export interface ScanSummaryView {
  rootId: number;
  rootPath: string;
  found: number;
  probed: number;
  unchanged: number;
  excluded: number;
  unreadable: number;
  missing: number;
}

export type ScanStatusView = 'idle' | 'running' | 'done' | 'failed';

export interface ScanStateView {
  status: ScanStatusView;
  rootId: number | null;
  phase: 'walk' | 'probe' | 'finalize' | null;
  processed: number;
  total: number;
  lastError: string | null;
}

export const removeVideoPayloadSchema = z.tuple([z.number().int().positive()]);
export type RemoveVideoPayload = z.infer<typeof removeVideoPayloadSchema>;

export interface GalleryVideoView {
  id: number;
  path: string;
  filename: string;
  ext: string;
  folder: string;
  size_bytes: number;
  duration_ms: number;
  width: number;
  height: number;
  codec: string;
  status: VideoStatus;
  favorite: number;
  rating: number;
  watched: number;
  thumbnail_path: string | null;
  added_at: number;
}

export interface LibraryOverview {
  videos: GalleryVideoView[];
  roots: SourceRootInfo[];
  errors: ScanErrorRow[];
}

/**
 * Request/response map of IPC channels. The single source of truth for preload,
 * main and renderer. Names — 'domain:action'.
 */
export interface IpcContracts {
  'app:ping': { req: void; res: PingResult };
  'settings:get': { req: void; res: SettingsPayload };
  'settings:set': { req: [key: string, value: unknown]; res: void };
  'library:overview': { req: void; res: LibraryOverview };
  'library:roots:add': { req: AddSourceRootPayload; res: SourceRootRow };
  'library:roots:remove': { req: RemoveSourceRootPayload; res: boolean };
  'library:roots:setEnabled': { req: SetSourceRootEnabledPayload; res: void };
  'library:scan:root': { req: ScanRootPayload; res: ScanSummaryView };
  'library:scan:all': { req: void; res: ScanSummaryView[] };
  'library:video:remove': { req: RemoveVideoPayload; res: void };
}

export type IpcChannel = keyof IpcContracts;
export type IpcPayload<C extends IpcChannel> = IpcContracts[C]['req'];
export type IpcResult<C extends IpcChannel> = IpcContracts[C]['res'];

export const IPC_CHANNELS: readonly IpcChannel[] = Object.freeze([
  'app:ping',
  'settings:get',
  'settings:set',
  'library:overview',
  'library:roots:add',
  'library:roots:remove',
  'library:roots:setEnabled',
  'library:scan:root',
  'library:scan:all',
  'library:video:remove',
] as IpcChannel[]);

/** Events that the main event sends to the renderer (push, not request/response). */
export interface IpcEvents {
  'settings:changed': { key: string; value: unknown };
  'theme:systemChanged': { isDark: boolean };
  'scan:progress': ScanProgressView;
  'scan:state': ScanStateView;
  'library:changed': { reason: 'scan' | 'watch' | 'roots' };
}

export interface ScanProgressView {
  rootId: number;
  phase: 'walk' | 'probe' | 'finalize';
  processed: number;
  total: number;
}

export type IpcEventName = keyof IpcEvents;
export type IpcEventData<E extends IpcEventName> = IpcEvents[E];

export const IPC_EVENTS: readonly IpcEventName[] = Object.freeze([
  'settings:changed',
  'theme:systemChanged',
  'scan:progress',
  'scan:state',
  'library:changed',
] as IpcEventName[]);

declare global {
  interface Window {
    vibe: {
      invoke<C extends IpcChannel>(channel: C, payload?: IpcPayload<C>): Promise<IpcResult<C>>;
      on<E extends IpcEventName>(event: E, listener: (data: IpcEventData<E>) => void): () => void;
    };
  }
}
