import { shell } from 'electron';
import fs from 'node:fs';

import type { RegistryEntry } from './index';
import {
  addSourceRootPayloadSchema,
  removeSourceRootPayloadSchema,
  removeVideoPayloadSchema,
  scanRootPayloadSchema,
  setSourceRootEnabledPayloadSchema,
} from '../../shared/ipc';
import type { ScanManager } from '../services/scan-manager';
import type { Repositories } from '../db/repos';
import { dirs } from '../paths';
import { removeThumbnail } from '../services/thumbnails';

export interface LibraryIpcDeps {
  repos: Repositories;
  scanManager: ScanManager;
}

export function buildLibraryRegistry(deps: LibraryIpcDeps): Record<string, RegistryEntry> {
  const { repos, scanManager } = deps;

  return {
    'library:overview': {
      req: undefined,
      handler: () => scanManager.buildOverview(),
    },
    'library:roots:add': {
      req: addSourceRootPayloadSchema,
      handler: (payload) => {
        const [rootPath] = payload as [string];
        if (!isDirectory(rootPath)) {
          throw new Error(`Not a directory: ${rootPath}`);
        }
        const root = repos.sourceRoots.upsert(rootPath);
        scanManager.refreshWatchers();
        scanManager.notifyLibraryChanged('roots');
        return root;
      },
    },
    'library:roots:remove': {
      req: removeSourceRootPayloadSchema,
      handler: (payload) => {
        const [rootId] = payload as [number];
        repos.sourceRoots.remove(rootId);
        scanRootsCleanup(rootId);
        scanManager.refreshWatchers();
        scanManager.notifyLibraryChanged('roots');
        return true;
      },
    },
    'library:roots:setEnabled': {
      req: setSourceRootEnabledPayloadSchema,
      handler: (payload) => {
        const [rootId, enabled] = payload as [number, boolean];
        repos.sourceRoots.setEnabled(rootId, enabled);
        scanManager.refreshWatchers();
        scanManager.notifyLibraryChanged('roots');
        return undefined;
      },
    },
    'library:scan:root': {
      req: scanRootPayloadSchema,
      handler: (payload) => {
        const [rootId] = payload as [number];
        return scanManager.scanRoot(rootId);
      },
    },
    'library:scan:all': {
      req: undefined,
      handler: () => scanManager.scanAll(),
    },
    'library:video:remove': {
      req: removeVideoPayloadSchema,
      handler: async (payload) => {
        const [videoId] = payload as [number];
        const video = repos.videos.get(videoId);
        if (!video) throw new Error(`video ${videoId} not found`);
        try {
          await shell.trashItem(video.path);
        } catch (e) {
          // Файл уже исчез с диска: строку всё равно вычищаем из библиотеки.
          const code = (e as NodeJS.ErrnoException).code ?? '';
          if (code !== 'ENOENT') throw e;
        }
        repos.videos.remove(videoId);
        removeThumbnail(dirs.cacheThumbnails(), videoId);
        return undefined;
      },
    },
  };

  function scanRootsCleanup(rootId: number): void {
    repos.scanErrors.clearForRoot(rootId);
  }

  function isDirectory(p: string): boolean {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  }
}
