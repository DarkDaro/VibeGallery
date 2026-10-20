import type Database from 'better-sqlite3';

import { createCollectionsRepo, type CollectionsRepo } from './collections';
import { createExclusionsRepo, type ExclusionsRepo } from './exclusions';
import { createPlaylistsRepo, type PlaylistsRepo } from './playlists';
import { createSmartFiltersRepo, type SmartFiltersRepo } from './smart-filters';
import { createSourceRootsRepo, type SourceRootsRepo } from './source-roots';
import { createTagsRepo, type TagsRepo } from './tags';
import { createVideosRepo, type VideosRepo } from './videos';

export interface Repositories {
  videos: VideosRepo;
  tags: TagsRepo;
  collections: CollectionsRepo;
  playlists: PlaylistsRepo;
  smartFilters: SmartFiltersRepo;
  exclusions: ExclusionsRepo;
  sourceRoots: SourceRootsRepo;
}

/** Builds all repositories on one connection. Call after migration. */
export function createRepositories(db: Database.Database): Repositories {
  return {
    videos: createVideosRepo(db),
    tags: createTagsRepo(db),
    collections: createCollectionsRepo(db),
    playlists: createPlaylistsRepo(db),
    smartFilters: createSmartFiltersRepo(db),
    exclusions: createExclusionsRepo(db),
    sourceRoots: createSourceRootsRepo(db),
  };
}

export type { CollectionCycleError } from './collections';
