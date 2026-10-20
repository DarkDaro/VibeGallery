import Database from 'better-sqlite3';

import type { SmartFilterRow } from '../../../shared/types';

export interface SmartFiltersRepo {
  list(): SmartFilterRow[];
  create(name: string, query: string): SmartFilterRow;
  update(id: number, patch: Partial<Pick<SmartFilterRow, 'name' | 'query'>>): void;
  remove(id: number): void;
}

export function createSmartFiltersRepo(db: Database.Database): SmartFiltersRepo {
  const statements = {
    list: db.prepare('SELECT id, name, query, created_at FROM smart_filters ORDER BY name COLLATE NOCASE'),
    insert: db.prepare('INSERT INTO smart_filters(name, query, created_at) VALUES (?, ?, ?)'),
    update: db.prepare('UPDATE smart_filters SET name = COALESCE(@name, name), query = COALESCE(@query, query) WHERE id = @id'),
    remove: db.prepare('DELETE FROM smart_filters WHERE id = ?'),
  };

  return {
    list: () => statements.list.all() as SmartFilterRow[],
    create(name, query) {
      const info = statements.insert.run(name, query, Date.now());
      const id = Number(info.lastInsertRowid);
      return { id, name, query, created_at: Date.now() };
    },
    update: (id, patch) => statements.update.run({ id, name: patch.name ?? null, query: patch.query ?? null }),
    remove: (id) => statements.remove.run(id),
  };
}
