import Database from 'better-sqlite3';

import type { ScanErrorRow } from '../../../shared/types';

export interface ScanErrorsRepo {
  /** Replaces the set of errors for the root (a fresh scan passes from scratch). */
  replaceForRoot(rootId: number, errors: Array<Omit<ScanErrorRow, 'id' | 'source_root_id'>>): void;
  /** Incremental entry from a live monitor. */
  append(rootId: number, path: string, errorCode: string, message: string): void;
  forRoot(rootId: number): ScanErrorRow[];
  forAllRoots(): ScanErrorRow[];
  clearForRoot(rootId: number): void;
}

export function createScanErrorsRepo(db: Database.Database): ScanErrorsRepo {
  const insert = db.prepare(`
    INSERT INTO scan_errors(source_root_id, path, error_code, message, occurred_at)
    VALUES (@rootId, @path, @errorCode, @message, @occurredAt)
  `);
  const deleteEntry = db.prepare('DELETE FROM scan_errors WHERE source_root_id = ? AND path = ? AND error_code = ?');
  const clear = db.prepare('DELETE FROM scan_errors WHERE source_root_id = ?');
  const select = db.prepare(`
    SELECT id, source_root_id, path, error_code, message, occurred_at
    FROM scan_errors WHERE source_root_id = ?
    ORDER BY path COLLATE NOCASE
  `);
  const selectAll = db.prepare(`
    SELECT id, source_root_id, path, error_code, message, occurred_at
    FROM scan_errors ORDER BY occurred_at DESC
  `);

  return {
    append(rootId, path, errorCode, message) {
      // Ошибка того же рода на том же пути переписывается, а не плодит дубликаты.
      deleteEntry.run(rootId, path, errorCode);
      insert.run({ rootId, path, errorCode, message, occurredAt: Date.now() });
    },
    replaceForRoot(rootId, errors) {
      const tx = db.transaction(() => {
        clear.run(rootId);
        if (errors.length === 0) return;
        for (const e of errors) {
          insert.run({ rootId, path: e.path, errorCode: e.error_code, message: e.message, occurredAt: e.occurred_at });
        }
      });
      tx();
    },
    forRoot: (rootId) => select.all(rootId) as ScanErrorRow[],
    forAllRoots: () => selectAll.all() as ScanErrorRow[],
    clearForRoot: (rootId) => clear.run(rootId),
  };
}
