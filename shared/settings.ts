import { z } from 'zod';
import { DEFAULT_CACHE_LIMIT_BYTES } from './constants';

export const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  language: z.enum(['ru', 'en']),
  /** Scanner branches (chains of traversal) — setting phase 2. */
  scanConcurrency: z.number().int().min(1).max(8),
  /** Number of simultaneously running ffmpeg/ffprobe processes. */
  ffmpegParallelism: z.number().int().min(1).max(4),
  cacheLimitBytes: z.number().int().min(134217728).max(34359738368),
  /** Tile size / conversion of the preview, px. */
  thumbnailResolution: z.number().int().min(96).max(512),
  deletionConfirmation: z.enum(['ask', 'batch', 'never']),
  externalPlayerPath: z.string(),
});

export type Settings = z.infer<typeof settingsSchema>;

export type SettingsKey = Exclude<keyof Settings, symbol>;

export const SETTINGS_DEFAULTS: Settings = settingsSchema.parse({
  theme: 'system',
  language: 'ru',
  scanConcurrency: 2,
  ffmpegParallelism: 2,
  cacheLimitBytes: DEFAULT_CACHE_LIMIT_BYTES,
  thumbnailResolution: 256,
  deletionConfirmation: 'ask',
  externalPlayerPath: '',
});

/** Technical keys not intended for the UI (window geometry, etc.). */
export const INTERNAL_SETTINGS_KEYS = ['windowBounds'] as const;

export const windowBoundsSchema = z.object({
  width: z.number().int().min(200).max(20000),
  height: z.number().int().min(200).max(20000),
  x: z.number().int().min(-100000).max(100000),
  y: z.number().int().min(-100000).max(100000),
  maximized: z.boolean().optional(),
});
