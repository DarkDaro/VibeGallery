import Database from 'better-sqlite3';

import { foldKey } from '../case-fold';
import type { TagRow } from '../../../shared/types';

export interface TagsRepo {
  list(): TagRow[];
  get(id: number): TagRow | undefined;
  /** Creates the tag or returns the existing one by name (NOCASE). */
  upsert(name: string, color?: string): TagRow;
  rename(id: number, name: string): void;
  setColor(id: number, color: string): void;
  remove(id: number): void;
  attachToVideo(videoId: number, tagId: number): void;
  detachFromVideo(videoId: number, tagId: number): void;
  tagsOfVideo(videoId: number): TagRow[];
}

export function createTagsRepo(db: Database.Database): TagsRepo {
  const statements = {
    list: db.prepare('SELECT id, name, color FROM tags ORDER BY name COLLATE NOCASE'),
    get: db.prepare('SELECT id, name, color FROM tags WHERE id = ?'),
    byKey: db.prepare('SELECT id, name, color FROM tags WHERE name_key = ?'),
    insert: db.prepare('INSERT INTO tags(name, name_key, color) VALUES (?, ?, ?)'),
    rename: db.prepare('UPDATE tags SET name = ?, name_key = ? WHERE id = ?'),
    setColor: db.prepare('UPDATE tags SET color = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM tags WHERE id = ?'),
    attach: db.prepare('INSERT OR IGNORE INTO video_tags(video_id, tag_id) VALUES (?, ?)'),
    detach: db.prepare('DELETE FROM video_tags WHERE video_id = ? AND tag_id = ?'),
    tagsOfVideo: db.prepare(`
      SELECT t.id, t.name, t.color FROM tags t
      JOIN video_tags vt ON vt.tag_id = t.id
      WHERE vt.video_id = ?
      ORDER BY t.name COLLATE NOCASE
    `),
  };

  return {
    list: () => statements.list.all() as TagRow[],
    get: (id) => statements.get.get(id) as TagRow | undefined,
    upsert(name, color) {
      const existing = statements.byKey.get(foldKey(name)) as TagRow | undefined;
      if (existing) return existing;
      const info = statements.insert.run(name, foldKey(name), color ?? '#7f7f7f');
      return { id: Number(info.lastInsertRowid), name, color: color ?? '#7f7f7f' };
    },
    rename: (id, name) => statements.rename.run(name, foldKey(name), id),
    setColor: (id, color) => statements.setColor.run(color, id),
    remove: (id) => statements.remove.run(id),
    attachToVideo: (videoId, tagId) => statements.attach.run(videoId, tagId),
    detachFromVideo: (videoId, tagId) => statements.detach.run(videoId, tagId),
    tagsOfVideo: (videoId) => statements.tagsOfVideo.all(videoId) as TagRow[],
  };
}
