import Database from 'better-sqlite3';

import type { VideoRow, VideoStatus } from '../../../shared/types';

/**
 * Scan-facing insert/update plus flag helpers. Complex read queries
 * (paged gallery, filters, FTS join) come with their phases.
 */
export interface VideosRepo {
  upsert(input: VideoInput): number;
  get(id: number): VideoRow | undefined;
  getByPath(path: string): VideoRow | undefined;
  probeUpdate(id: number, meta: ProbeMeta): void;
  setStatus(id: number, status: VideoStatus): void;
  setFlags(id: number, flags: Partial<Pick<VideoRow, 'favorite' | 'rating' | 'watched' | 'notes'>>): void;
  playbackState(id: number, positionMs: number): void;
  allPaths(): Array<{ id: number; path: string; size_bytes: number; mtime_ms: number; status: VideoStatus }>;
}

export interface VideoInput {
  path: string;
  source_root_id: number | null;
  folder: string;
  filename: string;
  ext: string;
  size_bytes: number;
  mtime_ms: number;
  status?: VideoStatus;
}

export interface ProbeMeta {
  duration_ms?: number;
  width?: number;
  height?: number;
  bitrate_kbps?: number;
  codec?: string;
}

export function createVideosRepo(db: Database.Database): VideosRepo {
  const statements = {
    getByPath: db.prepare('SELECT * FROM videos WHERE path = ? COLLATE NOCASE'),
    upsert: db.prepare(`
      INSERT INTO videos(
        path, source_root_id, folder, filename, ext,
        size_bytes, mtime_ms, added_at, modified_at, status
      ) VALUES (
        @path, @source_root_id, @folder, @filename, @ext,
        @size_bytes, @mtime_ms, @now, @now, @status
      )
      ON CONFLICT(path) DO UPDATE SET
        source_root_id = excluded.source_root_id,
        folder = excluded.folder,
        filename = excluded.filename,
        ext = excluded.ext,
        size_bytes = excluded.size_bytes,
        mtime_ms = excluded.mtime_ms,
        modified_at = excluded.modified_at,
        status = excluded.status
    `),
    probeUpdate: db.prepare(`
      UPDATE videos SET
        duration_ms = COALESCE(@duration_ms, duration_ms),
        width = COALESCE(@width, width),
        height = COALESCE(@height, height),
        bitrate_kbps = COALESCE(@bitrate_kbps, bitrate_kbps),
        codec = COALESCE(@codec, codec)
      WHERE id = @id
    `),
    setStatus: db.prepare('UPDATE videos SET status = ? WHERE id = ?'),
    setFlags: db.prepare(`
      UPDATE videos SET
        favorite = COALESCE(@favorite, favorite),
        rating = COALESCE(@rating, rating),
        watched = COALESCE(@watched, watched),
        notes = COALESCE(@notes, notes)
      WHERE id = @id
    `),
    playback: db.prepare(`
      UPDATE videos SET
        last_position_ms = @position,
        last_played_at = @now,
        play_count = play_count + 1
      WHERE id = @id
    `),
    allPaths: db.prepare('SELECT id, path, size_bytes, mtime_ms, status FROM videos'),
  };

  return {
    upsert(input) {
      const info = statements.upsert.run({
        ...input,
        status: input.status ?? 'ok',
        now: Date.now(),
      });
      const existing = statements.getByPath.get(input.path) as VideoRow | undefined;
      if (existing) return existing.id;
      return Number(info.lastInsertRowid);
    },
    get: (id) => db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as VideoRow | undefined,
    getByPath: (p) => statements.getByPath.get(p) as VideoRow | undefined,
    probeUpdate: (id, meta) =>
      statements.probeUpdate.run({ id, duration_ms: meta.duration_ms ?? null, width: meta.width ?? null, height: meta.height ?? null, bitrate_kbps: meta.bitrate_kbps ?? null, codec: meta.codec ?? null }),
    setStatus: (id, status) => statements.setStatus.run(status, id),
    setFlags: (id, flags) =>
      statements.setFlags.run({
        id,
        favorite: flags.favorite ?? null,
        rating: flags.rating ?? null,
        watched: flags.watched ?? null,
        notes: flags.notes ?? null,
      }),
    playbackState: (id, positionMs) => statements.playback.run({ id, position: positionMs, now: Date.now() }),
    allPaths: () => statements.allPaths.all() as Array<{ id: number; path: string; size_bytes: number; mtime_ms: number; status: VideoStatus }>,
  };
}
