import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { MIGRATIONS, type Migration } from './migrations';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database is not initialized');
  return db;
}

export function migrationBackupsDir(): string {
  return path.join(app.getPath('userData'), 'backups');
}

export interface InitializeDbOptions {
  filePath: string;
  onLog?: (msg: string) => void;
}

/**
 * Opens the DB, checks user_version against the migration registry.
 * Migration/upgrade comes with creating a library.db.bak backup (via the consistent SQLite backup API).
 */
export async function initializeDatabase(opts: InitializeDbOptions): Promise<Database.Database> {
  const log = (m: string) => opts.onLog?.(m);
  fs.mkdirSync(path.dirname(opts.filePath), { recursive: true });
  const existedBefore = fs.existsSync(opts.filePath) && fs.statSync(opts.filePath).size > 0;
  db = new Database(opts.filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  const current = db.pragma('user_version', { simple: true }) as number;
  const target = MIGRATIONS[MIGRATIONS.length - 1]!.version;

  if (current > target) {
    db.close();
    throw new Error(
      `Database schema version ${current} is newer than supported ${target}. Restore library.db.bak or update the app.`,
    );
  }

  if (current < target) {
    if (existedBefore) {
      const bakPath = `${opts.filePath}.bak`;
      log(`DB upgrade ${current} -> ${target}, saving backup ${bakPath}`);
      const backupDb = new Database(opts.filePath, { readonly: true });
      await backupDb.backup(bakPath);
      backupDb.close();
    }
    for (const migration of MIGRATIONS) {
      if (migration.version <= current) continue;
      log(`Applying migration ${migration.version}: ${migration.name}`);
      db.transaction(() => {
        migration.up(db!);
        db!.pragma(`user_version = ${migration.version}`);
      })();
    }
  }

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export type { Database, Migration };
