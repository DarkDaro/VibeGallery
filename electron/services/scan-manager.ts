import type { Repositories } from '../db/repos';
import type { ScanProgress, ScanSummary } from '../scanner/service';
import { createScanService, type ScanService } from '../scanner/service';
import { createRootWatcher } from '../scanner/watcher';
import { binaries } from '../scanner/binaries';
import { dirs } from '../paths';
import type { IpcEvents } from '../../shared/ipc';
import type {
  LibraryOverview,
  ScanStateView,
} from '../../shared/ipc';

interface ScanManagerDeps {
  repos: Repositories;
  /** Push an event to all windows (ipc broadcast already exists for settings). */
  broadcast: (event: keyof IpcEvents, payload: unknown) => void;
}

const OVERVIEW_VIDEO_LIMIT = 2000;

export interface ScanManager extends ScanService {
  state(): ScanStateView;
  scanAll(): Promise<ScanSummary[]>;
  buildOverview(): LibraryOverview;
  /** Sign for watchers to restart after changing the list of roots. */
  refreshWatchers(): void;
  notifyLibraryChanged(reason: 'scan' | 'watch' | 'roots'): void;
}

export function createScanManager(deps: ScanManagerDeps): ScanManager {
  const { repos, broadcast } = deps;
  const service = createScanService({
    repos,
    ffprobePath: binaries().ffprobe,
    ffmpegPath: binaries().ffmpeg,
    thumbsDir: dirs.cacheThumbnails(),
  });

  const watcher = createRootWatcher({
    repos,
    ffprobePath: binaries().ffprobe,
    ffmpegPath: binaries().ffmpeg,
    thumbsDir: dirs.cacheThumbnails(),
    onEvent: () => notifyLibraryChanged('watch'),
  });

  let state: ScanStateView = { status: 'idle', rootId: null, phase: null, processed: 0, total: 0, lastError: null };
  let queue: Promise<unknown> = Promise.resolve();

  const setState = (next: ScanStateView): void => {
    state = next;
    broadcast('scan:state', state);
  };

  function scanRoot(rootId: number): Promise<ScanSummary> {
    const run = queue.then(async () => {
      setState({ status: 'running', rootId, phase: 'walk', processed: 0, total: 0, lastError: null });
      try {
        const summary = await service.scanRoot(rootId, (p: ScanProgress) => {
          broadcast('scan:progress', { rootId: p.rootId, phase: p.phase, processed: p.processed, total: p.total });
        });
        setState({ status: 'done', rootId, phase: null, processed: 0, total: 0, lastError: null });
        notifyLibraryChanged('scan');
        return summary;
      } catch (e) {
        setState({ status: 'failed', rootId, phase: null, processed: 0, total: 0, lastError: (e as Error).message });
        throw e;
      }
    });
    queue = run.catch(() => undefined);
    return run;
  }

  async function scanAll(): Promise<ScanSummary[]> {
    const rootIds = repos.sourceRoots.list().filter((r) => r.enabled === 1).map((r) => r.id);
    const summaries: ScanSummary[] = [];
    for (const id of rootIds) {
      summaries.push(await scanRoot(id));
    }
    return summaries;
  }

  function buildOverview(): LibraryOverview {
    const videoRows = repos.videos.listOverview(OVERVIEW_VIDEO_LIMIT);
    const counts = repos.videos.countByRoot();
    const roots = repos.sourceRoots.list().map((r) => ({ ...r, video_count: counts.get(r.id) ?? 0 }));
    const errors = repos.scanErrors.forAllRoots();
    return { videos: videoRows, roots, errors };
  }

  function refreshWatchers(): void {
    watcher.refresh();
  }

  function notifyLibraryChanged(reason: 'scan' | 'watch' | 'roots'): void {
    broadcast('library:changed', { reason });
  }

  // Watchers are started after building the list of active roots.
  refreshWatchers();

  return {
    scanRoot,
    scanAll,
    state: () => state,
    buildOverview,
    refreshWatchers,
    notifyLibraryChanged,
  };
}
