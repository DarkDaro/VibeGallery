import path from 'node:path';
import fsp from 'node:fs/promises';
import chokidar, { type FSWatcher } from 'chokidar';

import { VIDEO_EXTENSION_SET, SKIPPED_DIR_NAMES } from '../../shared/constants';
import type { Repositories } from '../db/repos';
import { probeVideo } from '../services/ffprobe';
import { generateThumbnail } from '../services/thumbnails';
import { createExclusionPolicy } from './exclusions';

export interface WatcherDeps {
  repos: Repositories;
  ffprobePath: string;
  ffmpegPath: string;
  thumbsDir: string;
  onEvent?: (kind: 'add' | 'change' | 'unlink', absPath: string) => void;
}

/**
 * Runtime monitoring of active root directories. A file event goes through
 * the same policy pipeline as a full scan, but pointwise. A single-flight
 * lock sign at the level of processing an individual path.
 */
export interface RootWatcher {
  refresh(): void;
  stop(): void;
}

export function createRootWatcher(deps: WatcherDeps): RootWatcher {
  const { repos, ffprobePath, ffmpegPath, thumbsDir, onEvent } = deps;
  let watchers: FSWatcher[] = [];
  let inFlight = new Set<string>();

  const SKIP_DIRS_LC = new Set([...SKIPPED_DIR_NAMES].map((s) => s.toLowerCase()).concat(['.vibegallery']));

  function eventRootList(): Array<{ id: number; path: string }> {
    return repos.sourceRoots
      .list()
      .filter((r) => r.enabled === 1)
      .map((r) => ({ id: r.id, path: r.path }));
  }

  return {
    refresh(): void {
      for (const w of watchers) void w.close();
      watchers = [];

      const roots = eventRootList();
      if (roots.length === 0) return;

      const policy = createExclusionPolicy(repos.exclusions.list());

      for (const root of roots) {
        const watcher = chokidar.watch(root.path, {
          ignoreInitial: true,
          ignored: (watchedPath: string) => {
            const base = path.basename(watchedPath).toLowerCase();
            if (SKIP_DIRS_LC.has(base) || base.startsWith('.') || base.startsWith('$')) return true;
            const dot = base.lastIndexOf('.');
            if (dot <= 0) return false; // директория без расширения — recurse
            return !VIDEO_EXTENSION_SET.has(base.slice(dot + 1));
          },
          awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
        });

        watcher
          .on('add', (abs) => void handleUpsert(abs, root.id, policy))
          .on('change', (abs) => void handleUpsert(abs, root.id, policy))
          .on('unlink', (abs) => handleUnlink(abs, root.id))
          .on('unlinkDir', (abs) => handleUnlinkDir(abs, root.id));
        watchers.push(watcher);
      }
    },
    stop(): void {
      for (const w of watchers) void w.close();
      watchers = [];
      inFlight = new Set();
    },
  };

  function handleUpsert(abs: string, rootId: number, policy: ReturnType<typeof createExclusionPolicy>): void {
    const key = abs.toLowerCase();
    if (inFlight.has(key)) return;
    inFlight.add(key);
    void (async () => {
      try {
        const root = repos.sourceRoots.get(rootId);
        if (!root) return;
        const st = await fsp.stat(abs).catch(() => null);
        if (!st) return;

        const folder = path.relative(path.resolve(root.path), path.dirname(abs)) || '';
        const filename = path.basename(abs);
        const ext = path.extname(abs);
        const size = st.size;
        const mtime = Math.round(st.mtimeMs);

        const videoId = repos.videos.upsert({
          path: abs,
          source_root_id: rootId,
          folder,
          filename,
          ext,
          size_bytes: size,
          mtime_ms: mtime,
          status: policy.isPathExcluded(abs) ? 'excluded' : 'ok',
        });
        if (policy.isPathExcluded(abs)) return;

        try {
          const probed = await probeVideo(ffprobePath, abs);
          repos.videos.probeUpdate(videoId, probed);
          repos.videos.setStatus(videoId, 'ok');
          const thumb = await generateThumbnail(ffmpegPath, thumbsDir, abs, videoId, probed.duration_ms);
          repos.videos.setThumbnailPath(videoId, thumb);
        } catch (e) {
          repos.videos.setStatus(videoId, 'unreadable');
          repos.scanErrors.append(rootId, abs, 'PROBE', (e as Error).message);
        }
        onEvent?.('add', abs);
      } finally {
        inFlight.delete(key);
      }
    })();
  }

  function handleUnlink(abs: string, rootId: number): void {
    const known = repos.videos.getByPath(abs);
    if (known) repos.videos.setStatus(known.id, 'missing');
    onEvent?.('unlink', abs);
  }

  function handleUnlinkDir(abs: string, rootId: number): void {
    const prefix = abs.toLowerCase() + path.sep;
    for (const row of repos.videos.allPaths()) {
      if (row.source_root_id !== rootId) continue;
      if (row.path.toLowerCase().startsWith(prefix) && row.status !== 'missing') {
        repos.videos.setStatus(row.id, 'missing');
      }
    }
    onEvent?.('unlink', abs);
  }
}
