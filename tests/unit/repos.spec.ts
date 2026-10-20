import { afterAll, beforeAll, afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { initializeDatabase, closeDatabase } from '../../electron/db/client';
import { createRepositories, type Repositories } from '../../electron/db/repos';
import { CollectionCycleError } from '../../electron/db/repos/collections';
import { naturalCompare } from '../../shared/natural-sort';

let repos: Repositories;
let db: Database.Database;

function videoIdsMatching(term: string): number[] {
  return (db.prepare('SELECT video_id FROM videos_fts WHERE videos_fts MATCH ?').all(term) as Array<{ video_id: number }>).map(
    (r) => r.video_id,
  );
}

describe('repositories', () => {
  beforeAll(async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-repos-')), 'library.db');
    db = await initializeDatabase({ filePath: file });
    repos = createRepositories(db);
  });

  afterEach(() => {
    db.exec(`
      DELETE FROM videos;
      DELETE FROM tags;
      DELETE FROM collections;
      DELETE FROM playlists;
      DELETE FROM smart_filters;
      DELETE FROM exclusions;
      DELETE FROM source_roots;
      DELETE FROM scan_errors;
    `);
  });

  afterAll(() => {
    closeDatabase();
  });

  it('videos: upsert, update by path (NOCASE), probe, FTS by filename', () => {
    const id = repos.videos.upsert({
      path: path.join('M', 'Movies', 'trip 2019.mp4'),
      source_root_id: null,
      folder: 'Movies',
      filename: 'trip 2019.mp4',
      ext: '.mp4',
      size_bytes: 100500,
      mtime_ms: 1000,
    });
    const again = repos.videos.upsert({
      path: path.join('M', 'MOVIES', 'TRIP 2019.MP4'),
      source_root_id: null,
      folder: 'Movies',
      filename: 'trip 2019.mp4',
      ext: '.mp4',
      size_bytes: 100501,
      mtime_ms: 2000,
    });
    expect(again).toBe(id);

    const row = repos.videos.get(id)!;
    expect(row.size_bytes).toBe(100501);
    expect(row.status).toBe('ok');

    repos.videos.probeUpdate(id, { duration_ms: 61000, width: 1920, height: 1080, codec: 'h264' });
    const probed = repos.videos.get(id)!;
    expect(probed.duration_ms).toBe(61000);
    expect(probed.codec).toBe('h264');
    expect(probed.bitrate_kbps).toBe(0);

    expect(videoIdsMatching('trip')).toContain(id);
  });

  it('tags: fold dedup covers Cyrillic, FTS search by tag reflects attach/detach', () => {
    const t1 = repos.tags.upsert('Природа');
    const t2 = repos.tags.upsert('ПРИРОДА');
    expect(t2.id).toBe(t1.id);

    const videoId = createTestVideo('forest walk.mkv');
    repos.tags.attachToVideo(videoId, t1.id);
    expect(videoIdsMatching(t1.name)).toContain(videoId);

    repos.tags.detachFromVideo(videoId, t1.id);
    expect(videoIdsMatching(t1.name)).not.toContain(videoId);
  });

  it('collections: tree, cycle rejected, FTS by collection name', () => {
    const root = repos.collections.create('Фильмы');
    const child = repos.collections.create('Походы', root.id);

    expect(repos.collections.children(root.id).map((c) => c.id)).toEqual([child.id]);

    expect(() => repos.collections.move(root.id, child.id)).toThrow(CollectionCycleError);
    repos.collections.move(child.id, null);
    expect(repos.collections.get(child.id)!.parent_id).toBeNull();

    const videoId = createTestVideo('mountains.mp4');
    repos.collections.attachVideo(root.id, videoId);    expect(videoIdsMatching('фильмы')).toContain(videoId);
    expect(repos.collections.collectionIdsOfVideo(videoId)).toEqual([root.id]);
  });

  it('collections: delete cleans bindings and FTS row', () => {
    const c = repos.collections.create('Временное');
    const videoId = createTestVideo('todelete.mp4');
    repos.collections.attachVideo(c.id, videoId);
    repos.collections.remove(c.id);
    expect(repos.collections.get(c.id)).toBeUndefined();
    expect(videoIdsMatching('временное')).not.toContain(videoId);
  });

  it('playlists: order and reorder survive', () => {
    const pl = repos.playlists.create('Вечер');
    const v1 = createTestVideo('a.mp4');
    const v2 = createTestVideo('b.mp4');
    const v3 = createTestVideo('c.mp4');
    repos.playlists.addVideo(pl.id, v1);
    repos.playlists.addVideo(pl.id, v2);
    repos.playlists.addVideo(pl.id, v3);

    expect(repos.playlists.videosOf(pl.id).map((v) => v.id)).toEqual([v1, v2, v3]);

    repos.playlists.reorder(pl.id, [v3, v1, v2]);
    expect(repos.playlists.videosOf(pl.id).map((v) => v.id)).toEqual([v3, v1, v2]);

    repos.playlists.removeVideo(pl.id, v1);
    expect(repos.playlists.videosOf(pl.id).map((v) => v.id)).toEqual([v3, v2]);
  });

  it('playlists: integrity check via foreign_key_check', () => {
    const pl = repos.playlists.create('X');
    repos.playlists.remove(pl.id);
    const integrity = db.prepare('PRAGMA foreign_key_check').all();
    expect(integrity).toEqual([]);
  });

  it('smart_filters, exclusions, source_roots: CRUD and dedup', () => {
    const sf = repos.smartFilters.create('4K', 'height >= 2160');
    repos.smartFilters.update(sf.id, { query: 'height >= 2000' });
    expect(repos.smartFilters.list()[0]!.query).toBe('height >= 2000');

    const ex = repos.exclusions.add(String.raw`C:\частное`, 'folder');
    expect(repos.exclusions.matchesPath('c:\\ЧАСТНОЕ')).toBe(true);
    expect(repos.exclusions.matchesPath('c:\\другое')).toBe(false);
    expect(repos.exclusions.remove(ex.id)).toBe(true);
    expect(repos.exclusions.remove(ex.id)).toBe(false);

    const root1 = repos.sourceRoots.upsert('C:\\Кино');
    const root2 = repos.sourceRoots.upsert('c:\\кино');
    expect(root2.id).toBe(root1.id);
    repos.sourceRoots.setEnabled(root1.id, false);
    expect(repos.sourceRoots.get(root1.id)!.enabled).toBe(0);
  });

  it('planner picks the indexes for status filter and added_at sort', () => {
    const planStatus = db
      .prepare("EXPLAIN QUERY PLAN SELECT id FROM videos WHERE status = 'ok'")
      .all() as Array<{ detail: string }>;
    expect(planStatus.some((p) => p.detail.includes('idx_videos_status'))).toBe(true);

    const planAdded = db
      .prepare('EXPLAIN QUERY PLAN SELECT id FROM videos ORDER BY added_at')
      .all() as Array<{ detail: string }>;
    expect(planAdded.some((p) => p.detail.includes('idx_videos_added_at'))).toBe(true);
  });

  it('unicode names survive round-trip: Cyrillic, emoji and odd symbols', () => {
    // Windows allows emoji and any of these symbols in file names.
    const filename = 'видео №5 «Каникулы» [remaster] 🤯🔥.mov';
    const dir = 'Test';
    const id = repos.videos.upsert({
      path: path.join('M', 'Test', filename),
      source_root_id: null,
      folder: dir,
      filename,
      ext: '.mov',
      size_bytes: 4096,
      mtime_ms: 1,
    });

    const row = repos.videos.get(id)!;
    expect(row.filename).toBe(filename);
    expect(row.path.endsWith(filename)).toBe(true);

    // FTS indexes letter tokens; symbols and emoji are not searchable but must be stored.
    expect(videoIdsMatching('видео')).toContain(id);
    expect(videoIdsMatching('Каникулы')).toContain(id); // unicode61 keeps case, JS-side query is case-folded in searches

    // Tag with emoji dedups by the same name and is stored verbatim.
    const t1 = repos.tags.upsert('Скоро 🤯');
    const t2 = repos.tags.upsert('Скоро 🤯');
    expect(t2.id).toBe(t1.id);
    expect(t1.name).toBe('Скоро 🤯');
  });

  it('natural sort does not break on emoji and mixed scripts', () => {
    const input = ['🤯 part 1', '🤯 part 10', '🤯 part 2', 'видео.mov'];
    const sorted = [...input].sort(naturalCompare);
    // Code point order: Cyrillic letters come before emoji characters.
    expect(sorted).toEqual(['видео.mov', '🤯 part 1', '🤯 part 2', '🤯 part 10']);
  });
});

/** Inserts a test video and returns its row id. */
function createTestVideo(filename: string): number {
  return repos.videos.upsert({
    path: path.join('M', 'Test', filename.toLowerCase().replace(/\s+/g, '-')),
    source_root_id: null,
    folder: 'Test',
    filename,
    ext: path.extname(filename),
    size_bytes: 4096,
    mtime_ms: 1,
  });
}
