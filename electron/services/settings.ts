import Database from 'better-sqlite3';
import { BrowserWindow } from 'electron';
import {
  settingsSchema,
  windowBoundsSchema,
  SETTINGS_DEFAULTS,
  INTERNAL_SETTINGS_KEYS,
  type Settings,
  type SettingsKey,
} from '../../shared/settings';

type Upsert = Database.Statement;

let dbRef: Database.Database | null = null;
let cache: Partial<Settings> = {};

let insertStmt: Upsert | null = null;
let readStmt: Upsert | null = null;

function statements(): { insert: Upsert; read: Upsert } {
  if (!dbRef) throw new Error('Settings: database is not initialized');
  if (!insertStmt) {
    insertStmt = dbRef.prepare(
      `INSERT INTO settings(key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    );
    readStmt = dbRef.prepare('SELECT value FROM settings WHERE key = ?');
  }
  return { insert: insertStmt, read: readStmt! };
}

function broadcast(event: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(event, data);
  }
}

export function initSettingsService(db: Database.Database): void {
  dbRef = db;
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  cache = {};
  for (const { key, value } of rows) {
    if ((INTERNAL_SETTINGS_KEYS as readonly string[]).includes(key)) continue;
    try {
      cache[key as SettingsKey] = JSON.parse(value);
    } catch {
      // повреждённые значения трактуются как дефолт
    }
  }
}

export function getSettings(): Settings {
  return { ...SETTINGS_DEFAULTS, ...cache } as Settings;
}

export function getSettingsPayload(): Partial<Settings> {
  return { ...getSettings() };
}

export function setSetting(key: SettingsKey, value: unknown): void {
  if ((INTERNAL_SETTINGS_KEYS as readonly string[]).includes(key)) {
    throw new Error(`Key ${key} is internal and cannot be changed via settings`);
  }
  const parsed = (settingsSchema.shape as Record<string, { parse: (v: unknown) => unknown }>)[key]!.parse(value);
  const { insert } = statements();
  insert.run(key, JSON.stringify(parsed));
  (cache as Record<string, unknown>)[key] = parsed;
  broadcast('settings:changed', { key, value: parsed });
}

export function setInternal(key: string, value: unknown): void {
  if (!(INTERNAL_SETTINGS_KEYS as readonly string[]).includes(key)) {
    throw new Error(`Key ${key} is not allowed as internal`);
  }
  const { insert } = statements();
  insert.run(key, JSON.stringify(value));
  broadcast('settings:changed', { key, value });
}

export function getInternal(key: string): unknown {
  if (key === 'windowBounds') return getRaw('windowBounds');
  return undefined;
}

function getRaw(key: string): unknown {
  if (!dbRef) return undefined;
  const row = dbRef.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return undefined;
  }
}

export function getWindowBoundsRaw(): { width: number; height: number; x: number; y: number; maximized?: boolean } | undefined {
  const raw = getRaw('windowBounds');
  try {
    return windowBoundsSchema.parse(raw);
  } catch {
    return undefined;
  }
}
