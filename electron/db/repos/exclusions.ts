import Database from 'better-sqlite3';

import { foldKey } from '../case-fold';
import type { ExclusionRow } from '../../../shared/types';

export interface ExclusionsRepo {
  list(): ExclusionRow[];
  add(path: string, type: ExclusionRow['type']): ExclusionRow;
  /** `true` when the value was removed, `false` when it was not found. */
  remove(id: number): boolean;
  /** Quick check for the scanner: an exact path hit (NOCASE). Prefix and pattern rules live in the scanner. */
  matchesPath(path: string): boolean;
}

export function createExclusionsRepo(db: Database.Database): ExclusionsRepo {
  const statements = {
    list: db.prepare('SELECT id, path, type FROM exclusions ORDER BY type, path COLLATE NOCASE'),
    insert: db.prepare('INSERT INTO exclusions(path, path_key, type) VALUES (?, ?, ?)'),
    remove: db.prepare('DELETE FROM exclusions WHERE id = ?'),
    exact: db.prepare('SELECT 1 FROM exclusions WHERE path_key = ? LIMIT 1'),
  };

  return {
    list: () => statements.list.all() as ExclusionRow[],
    add(path, type) {
      const info = statements.insert.run(path, foldKey(path), type);
      return { id: Number(info.lastInsertRowid), path, type };
    },
    remove: (id) => statements.remove.run(id).changes > 0,
    matchesPath: (path) => statements.exact.get(foldKey(path)) !== undefined,
  };
}
