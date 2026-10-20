import Database from 'better-sqlite3';

import type { CollectionRow, VideoRow } from '../../../shared/types';

export interface CollectionsRepo {
  list(): CollectionRow[];
  get(id: number): CollectionRow | undefined;
  children(parentId: number | null): CollectionRow[];
  create(name: string, parentId?: number | null): CollectionRow;
  rename(id: number, name: string): void;
  /** Moves a node; the cycle is rejected (the target cannot be a node itself or its descendant). */
  move(id: number, newParentId: number | null): void;
  /** Deleting cascades to subcollections and bindings (collections_videos ON DELETE CASCADE). */
  remove(id: number): void;
  attachVideo(collectionId: number, videoId: number): void;
  detachVideo(collectionId: number, videoId: number): void;
  videosOf(collectionId: number): VideoRow[];
  collectionIdsOfVideo(videoId: number): number[];
}

export class CollectionCycleError extends Error {
  constructor() {
    super('Cannot move a collection inside itself or its descendant');
    this.name = 'CollectionCycleError';
  }
}

export function createCollectionsRepo(db: Database.Database): CollectionsRepo {
  const statements = {
    list: db.prepare('SELECT id, name, parent_id FROM collections ORDER BY name COLLATE NOCASE'),
    get: db.prepare('SELECT id, name, parent_id FROM collections WHERE id = ?'),
    children: db.prepare('SELECT id, name, parent_id FROM collections WHERE parent_id IS ? ORDER BY name COLLATE NOCASE'),
    insert: db.prepare('INSERT INTO collections(name, parent_id) VALUES (?, ?)'),
    rename: db.prepare('UPDATE collections SET name = ? WHERE id = ?'),
    move: db.prepare('UPDATE collections SET parent_id = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM collections WHERE id = ?'),
    attach: db.prepare('INSERT OR IGNORE INTO collection_videos(collection_id, video_id) VALUES (?, ?)'),
    detach: db.prepare('DELETE FROM collection_videos WHERE collection_id = ? AND video_id = ?'),
    videosOf: db.prepare(`
      SELECT v.* FROM videos v
      JOIN collection_videos cv ON cv.video_id = v.id
      WHERE cv.collection_id = ?
      ORDER BY v.filename COLLATE NOCASE
    `),
    idsOfVideo: db.prepare('SELECT collection_id FROM collection_videos WHERE video_id = ?'),
  };

  function isDescendant(candidateId: number, ancestorId: number): boolean {
    let cursor: number | null = candidateId;
    while (cursor !== null) {
      if (cursor === ancestorId) return true;
      const row = statements.get.get(cursor) as CollectionRow | undefined;
      cursor = row?.parent_id ?? null;
    }
    return false;
  }

  return {
    list: () => statements.list.all() as CollectionRow[],
    get: (id) => statements.get.get(id) as CollectionRow | undefined,
    children: (parentId) => statements.children.all(parentId === null ? null : parentId) as CollectionRow[],
    create(name, parentId = null) {
      const info = statements.insert.run(name, parentId);
      const id = Number(info.lastInsertRowid);
      return { id, name, parent_id: parentId };
    },
    rename: (id, name) => statements.rename.run(name, id),
    move(id, newParentId) {
      if (newParentId !== null && (newParentId === id || isDescendant(newParentId, id))) {
        throw new CollectionCycleError();
      }
      statements.move.run(newParentId, id);
    },
    remove: (id) => statements.remove.run(id),
    attachVideo: (collectionId, videoId) => statements.attach.run(collectionId, videoId),
    detachVideo: (collectionId, videoId) => statements.detach.run(collectionId, videoId),
    videosOf: (collectionId) => statements.videosOf.all(collectionId) as VideoRow[],
    collectionIdsOfVideo: (videoId) =>
      (statements.idsOfVideo.all(videoId) as Array<{ collection_id: number }>).map((r) => r.collection_id),
  };
}
