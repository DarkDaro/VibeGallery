import Database from 'better-sqlite3';

import { foldKey } from '../case-fold';
import type { SourceRootRow } from '../../../shared/types';

export interface SourceRootsRepo {
  list(): SourceRootRow[];
  get(id: number): SourceRootRow | undefined;
  getByPath(path: string): SourceRootRow | undefined;
  /** Adds the root; if the path is already registered, returns the existing one. */
  upsert(path: string): SourceRootRow;
  setEnabled(id: number, enabled: boolean): void;
  /** Root deletion cascades into scan_errors and detaches from videos (ON DELETE SET NULL). */
  remove(id: number): void;
}

export function createSourceRootsRepo(db: Database.Database): SourceRootsRepo {
  const statements = {
    list: db.prepare('SELECT id, path, enabled, created_at FROM source_roots ORDER BY path COLLATE NOCASE'),
    get: db.prepare('SELECT id, path, enabled, created_at FROM source_roots WHERE id = ?'),
    byPath: db.prepare('SELECT id, path, enabled, created_at FROM source_roots WHERE path_key = ?'),
    insert: db.prepare('INSERT INTO source_roots(path, path_key, created_at) VALUES (?, ?, ?)'),
    setEnabled: db.prepare('UPDATE source_roots SET enabled = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM source_roots WHERE id = ?'),
  };

  return {
    list: () => statements.list.all() as SourceRootRow[],
    get: (id) => statements.get.get(id) as SourceRootRow | undefined,
    getByPath: (p) => statements.byPath.get(p) as SourceRootRow | undefined,
    upsert(path) {
      const existing = statements.byPath.get(foldKey(path)) as SourceRootRow | undefined;
      if (existing) return existing;
      const info = statements.insert.run(path, foldKey(path), Date.now());
      return statements.get.get(Number(info.lastInsertRowid)) as SourceRootRow;
    },
    setEnabled: (id, enabled) => statements.setEnabled.run(enabled ? 1 : 0, id),
    remove: (id) => statements.remove.run(id),
  };
}
