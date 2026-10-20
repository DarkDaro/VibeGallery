import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeDatabase, closeDatabase } from '../../electron/db/client';
import { createRepositories, type Repositories } from '../../electron/db/repos';
import { createScanService } from '../../electron/scanner/service';
import { binaries } from '../../electron/scanner/binaries';

const FIXTURES = path.resolve('tests/fixtures/videos');

let repos: Repositories;
let rootDir: string;
let thumbsDir: string;
let bd: { ffprobe: string; ffmpeg: string };

function freshService() {
  return createScanService({
    repos,
    ffprobePath: bd.ffprobe,
    ffmpegPath: bd.ffmpeg,
    thumbsDir,
  });
}

describe('scan service (real fixtures)', () => {
  beforeAll(async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-scan-')), 'library.db');
    const db = await initializeDatabase({ filePath: file });
    repos = createRepositories(db);
    bd = binaries();
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-root-'));
    thumbsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-thumbs-'));

    // Структура: root/movie trip.mp4, root/series/видео №5 🤯.mov,
    // root/broken/corrupt.mp4, root/hidden/secret.mp4, root/$ignored/skip.mp4.
    fs.mkdirSync(path.join(rootDir, 'series'));
    fs.mkdirSync(path.join(rootDir, 'broken'));
    fs.mkdirSync(path.join(rootDir, 'hidden'));
    fs.mkdirSync(path.join(rootDir, '$ignored'));
    fs.copyFileSync(path.join(FIXTURES, 'small.mp4'), path.join(rootDir, 'movie trip.mp4'));
    fs.copyFileSync(path.join(FIXTURES, 'small.mp4'), path.join(rootDir, 'series', 'видео №5 🤯.mov'));
    fs.copyFileSync(path.join(FIXTURES, 'corrupt.mp4'), path.join(rootDir, 'broken', 'corrupt.mp4'));
    fs.copyFileSync(path.join(FIXTURES, 'small.mp4'), path.join(rootDir, 'hidden', 'secret.mp4'));
    fs.copyFileSync(path.join(FIXTURES, 'small.mp4'), path.join(rootDir, '$ignored', 'skip.mp4'));
  });

  afterAll(() => {
    closeDatabase();
  });

  it('first scan: statuses, probe metrics, thumbnails, scan errors', async () => {
    const root = repos.sourceRoots.upsert(rootDir);
    const summary = await freshService().scanRoot(root.id);

    expect(summary.found).toBe(4); // trip + видео №5 + corrupt + secret; $ignored пропущен волкером
    expect(summary.probed).toBe(3); // успешных проб; corrupt уходит в unreadable
    expect(summary.unreadable).toBe(1);

    const rows = repos.videos.allPaths().filter((v) => v.source_root_id === root.id);
    const byPath = new Map(rows.map((r) => [r.path.toLowerCase(), r]));
    expect(rows.length).toBe(4);

    const trip = byPath.get(path.join(rootDir, 'movie trip.mp4').toLowerCase())!;
    expect(trip.status).toBe('ok');
    expect(trip.mtime_ms).toBeGreaterThan(0);

    const emoji = byPath.get(path.join(rootDir, 'series', 'видео №5 🤯.mov').toLowerCase())!;
    expect(emoji.status).toBe('ok');

    const corrupt = byPath.get(path.join(rootDir, 'broken', 'corrupt.mp4').toLowerCase())!;
    expect(corrupt.status).toBe('unreadable');

    const secret = byPath.get(path.join(rootDir, 'hidden', 'secret.mp4').toLowerCase())!;
    expect(secret.status).toBe('ok');

    const errors = repos.scanErrors.forRoot(root.id);
    expect(errors.some((e) => e.error_code === 'PROBE' && e.message.includes('corrupt.mp4'))).toBe(true);

    const healthy = repos.videos.get(trip.id)!;
    expect(healthy.duration_ms).toBeGreaterThan(4000);
    const thumbPath = path.join(thumbsDir, `${trip.id}.jpg`);
    expect(fs.existsSync(thumbPath)).toBe(true);
    expect(healthy.thumbnail_path?.toLowerCase().replace(/\\/g, '/')).toContain(thumbsDir.toLowerCase().replace(/\\/g, '/'));
  });

  it('second scan without changes: nothing re-probed', async () => {
    const root = repos.sourceRoots.getByPath(rootDir)!;
    const summary = await freshService().scanRoot(root.id);
    expect(summary.unchanged).toBe(4);
    expect(summary.probed).toBe(0);
    expect(summary.unreadable).toBe(0);
    expect(summary.missing).toBe(0);
  });

  it('folder exclusion rule -> excluded status', async () => {
    repos.exclusions.add(path.join(rootDir, 'hidden'), 'folder');
    const root = repos.sourceRoots.getByPath(rootDir)!;
    fs.copyFileSync(path.join(FIXTURES, 'small.mp4'), path.join(rootDir, 'hidden', 'new-hidden.mp4'));
    const summary = await freshService().scanRoot(root.id);

    // secret.mp4 уже был ok; правило папки переводит обоих «скрытых» за один проход.
    expect(summary.excluded).toBe(2);

    const hiddenRows = repos.videos.allPaths().filter((v) => v.path.toLowerCase().includes('hidden'));
    expect(hiddenRows.length).toBe(2);
    expect(hiddenRows.every((v) => v.status === 'excluded')).toBe(true);
  });

  it('deleted file -> missing on full rescan', async () => {
    const root = repos.sourceRoots.getByPath(rootDir)!;
    fs.rmSync(path.join(rootDir, 'movie trip.mp4'));
    const summary = await freshService().scanRoot(root.id);
    expect(summary.missing).toBe(1);
    const rows = repos.videos.allPaths().filter((v) => v.source_root_id === root.id);
    const trip = rows.find((r) => r.path.toLowerCase().endsWith('movie trip.mp4'))!;
    expect(trip.status).toBe('missing');
  });
});
