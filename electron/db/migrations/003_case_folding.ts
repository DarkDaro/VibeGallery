/**
 * SQLite NOCASE folds ASCII only, so Cyrillic names need precomputed
 * lowercase key columns. Version 3.
 */
import type Database from 'better-sqlite3';

import { foldKey } from '../case-fold';
import type { Migration } from './index';

export const caseFoldingKeys: Migration = {
  version: 3,
  name: 'case-fold keys for tags / root paths / exclusions',
  up(db: Database.Database): void {
    db.exec(`
      ALTER TABLE tags ADD COLUMN name_key TEXT;
      ALTER TABLE source_roots ADD COLUMN path_key TEXT;
      ALTER TABLE exclusions ADD COLUMN path_key TEXT;
    `);

    const backfill = (table: string, valueColumn: string, keyColumn: string): void => {
      const rows = db.prepare(`SELECT id, ${valueColumn} FROM ${table}`).all() as Array<{ id: number } & Record<string, string>>;
      const update = db.prepare(`UPDATE ${table} SET ${keyColumn} = ? WHERE id = ?`);
      const tx = db.transaction(() => {
        for (const row of rows) update.run(foldKey(row[valueColumn]!), row.id);
      });
      tx();
    };
    backfill('tags', 'name', 'name_key');
    backfill('source_roots', 'path', 'path_key');
    backfill('exclusions', 'path', 'path_key');

    db.exec(`
      CREATE UNIQUE INDEX idx_tags_name_key ON tags(name_key);
      CREATE UNIQUE INDEX idx_source_roots_path_key ON source_roots(path_key);
      CREATE INDEX idx_exclusions_path_key ON exclusions(path_key);
    `);
  },
};
