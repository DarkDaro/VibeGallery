import path from 'node:path';

import { VIDEO_EXTENSION_SET } from '../../shared/constants';
import type { Repositories } from '../db/repos';
import { probeVideo } from '../services/ffprobe';
import { generateThumbnail } from '../services/thumbnails';
import { createExclusionPolicy } from './exclusions';
import { statOrNull, walkFiles } from './walker';

export interface ScanProgress {
  rootId: number;
  phase: 'walk' | 'probe' | 'finalize';
  processed: number;
  total: number;
}

export interface ScanSummary {
  rootId: number;
  rootPath: string;
  found: number;
  probed: number;
  unchanged: number;
  excluded: number;
  unreadable: number;
  missing: number;
}

export interface ScanService {
  scanRoot(rootId: number, onProgress?: (p: ScanProgress) => void): Promise<ScanSummary>;
}

export interface ScanDeps {
  repos: Repositories;
  ffprobePath: string;
  ffmpegPath: string;
  thumbsDir: string;
}

interface PendingFile {
  absPath: string;
  videoId: number;
}

export function createScanService(deps: ScanDeps): ScanService {
  const { repos, ffprobePath, ffmpegPath, thumbsDir } = deps;

  async function scanRoot(rootId: number, onProgress?: (p: ScanProgress) => void): Promise<ScanSummary> {
    const root = repos.sourceRoots.get(rootId);
    if (!root) throw new Error(`source root ${rootId} not found`);
    if (!root.enabled) throw new Error(`source root ${rootId} is disabled`);

    const policy = createExclusionPolicy(repos.exclusions.list());
    const rootNormalized = path.resolve(root.path);

    onProgress?.({ rootId, phase: 'walk', processed: 0, total: 0 });
    const { files, issues } = await walkFiles(root.path, VIDEO_EXTENSION_SET);

    const scanErrors: Array<{ path: string; error_code: string; message: string; occurred_at: number }> = issues.map(
      (i) => ({ path: i.path, error_code: i.error_code, message: i.message, occurred_at: Date.now() }),
    );

    const pending: PendingFile[] = [];
    const walkedLower = new Set<string>();
    let unchanged = 0;
    let excluded = 0;

    for (const absPath of files) {
      walkedLower.add(absPath.toLowerCase());

      const st = statOrNull(absPath);
      if (!st.ok) {
        scanErrors.push({
          path: absPath,
          error_code: st.gone ? 'ENOENT' : 'EACCES',
          message: `stat failed (${st.gone ? 'ENOENT' : 'EACCES'})`,
          occurred_at: Date.now(),
        });
        continue;
      }

      const known = repos.videos.getByPath(absPath);
      const folder = path.relative(rootNormalized, path.dirname(absPath)) || '';
      const filename = path.basename(absPath);
      const size = st.stat.size;
      const mtime = Math.round(st.stat.mtimeMs);

      if (policy.isPathExcluded(absPath)) {
        repos.videos.upsert({
          path: absPath,
          source_root_id: rootId,
          folder,
          filename,
          ext: path.extname(absPath),
          size_bytes: size,
          mtime_ms: mtime,
          status: 'excluded',
        });
        excluded++;
        continue;
      }

      const changed =
        !known
        || known.size_bytes !== size
        || mtime !== known.mtime_ms
        || known.status === 'excluded';

      if (!changed) {
        unchanged++;
        continue;
      }

      const videoId = repos.videos.upsert({
        path: absPath,
        source_root_id: rootId,
        folder,
        filename,
        ext: path.extname(absPath),
        size_bytes: size,
        mtime_ms: mtime,
      });
      pending.push({ absPath, videoId });
    }

    onProgress?.({ rootId, phase: 'probe', processed: 0, total: pending.length });

    let unreadable = 0;
    let index = 0;
    for (const item of pending) {
      index++;
      try {
        const probed = await probeVideo(ffprobePath, item.absPath);
        repos.videos.probeUpdate(item.videoId, probed);
        repos.videos.setStatus(item.videoId, 'ok');

        // Миниатюра не обязательна: провал не меняет статус видео.
        try {
          const thumb = await generateThumbnail(ffmpegPath, thumbsDir, item.absPath, item.videoId, probed.duration_ms);
          repos.videos.setThumbnailPath(item.videoId, thumb);
        } catch (thumbError) {
          scanErrors.push({
            path: item.absPath,
            error_code: 'THUMB',
            message: (thumbError as Error).message,
            occurred_at: Date.now(),
          });
        }
      } catch (probeError) {
        repos.videos.setStatus(item.videoId, 'unreadable');
        unreadable++;
        scanErrors.push({
          path: item.absPath,
          error_code: 'PROBE',
          message: (probeError as Error).message,
          occurred_at: Date.now(),
        });
      }
      onProgress?.({ rootId, phase: 'probe', processed: index, total: pending.length });
    }

    // Полный обход: всё, что числится в БД у корня, но не найдено на диске, уходит в missing.
    let missing = 0;
    for (const row of repos.videos.allPaths()) {
      if (row.source_root_id !== rootId || row.status === 'excluded') continue;
      if (!walkedLower.has(row.path.toLowerCase())) {
        repos.videos.setStatus(row.id, 'missing');
        missing++;
      }
    }

    repos.scanErrors.replaceForRoot(rootId, scanErrors);
    onProgress?.({ rootId, phase: 'finalize', processed: scanErrors.length, total: scanErrors.length });

    return {
      rootId,
      rootPath: root.path,
      found: files.length,
      probed: pending.length - unreadable,
      unchanged,
      excluded,
      unreadable,
      missing,
    };
  }

  return { scanRoot };
}
