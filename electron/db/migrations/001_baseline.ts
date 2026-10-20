import type Database from 'better-sqlite3';

export const baseline = {
  version: 1,
  name: 'baseline — settings keystore',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  },
};
