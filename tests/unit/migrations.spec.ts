import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { initializeDatabase, closeDatabase } from '../../electron/db/client';

function tempDbFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-db-')), 'library.db');
}

describe('migrations', () => {
  it('creates schema on empty file (migration applies)', async () => {
    const file = tempDbFile();
    await initializeDatabase({ filePath: file });

    const db = new Database(file, { readonly: true });
    const version = db.pragma('user_version', { simple: true });
    db.close();

    expect(version).toBe(3);
    closeDatabase();
  });

  it('settings keystore is writable through schema', async () => {
    const file = tempDbFile();
    const db = await initializeDatabase({ filePath: file });
    db.prepare('INSERT INTO settings(key, value) VALUES (?, ?)').run('theme', '"dark"');
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme') as { value: string };
    expect(JSON.parse(row.value)).toBe('dark');
    closeDatabase();
  });

  it('re-run on existing db is idempotent and no backup is created', async () => {
    const file = tempDbFile();
    await initializeDatabase({ filePath: file });
    await initializeDatabase({ filePath: file });

    expect(fs.existsSync(`${file}.bak`)).toBe(false);
    const db = new Database(file, { readonly: true });
    const version = db.pragma('user_version', { simple: true });
    db.close();
    expect(version).toBe(3);
    closeDatabase();
  });
});
