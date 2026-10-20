/** File formats indexed by the scanner (whitelist basis). */
export const VIDEO_EXTENSIONS = [
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v',
  'mpg', 'mpeg', 'ts', 'm2ts', '3gp', 'ogv',
] as const;

export const VIDEO_EXTENSION_SET = new Set<string>(VIDEO_EXTENSIONS);

/** Default preview cache capacity: 2 GB. */
export const DEFAULT_CACHE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;

/** Timeout for a single ffprobe/ffmpeg call, ms. */
export const PROBE_TIMEOUT_MS = 10_000;
export const THUMB_TIMEOUT_MS = 10_000;

/** System directories scanned by accident. */
export const SKIPPED_DIR_NAMES = new Set([
  'node_modules', '.git', '$RECYCLE.BIN', 'System Volume Information',
]);
