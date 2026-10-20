import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { SKIPPED_DIR_NAMES } from '../../shared/constants';

export interface DirIssue {
  path: string;
  error_code: 'EACCES' | 'ENOENT' | 'OTHER';
  message: string;
}

export interface WalkResult {
  files: string[];
  issues: DirIssue[];
}

const SKIP_DIRS = new Set([...SKIPPED_DIR_NAMES].map((s) => s.toLowerCase()).concat(['.vibegallery']));
const RECURSION_LIMIT = 24;

/**
 * Recursively collects files with the given extensions.
 * Limit of recursion depth, skipping service directories and readable
 * writeErrors without stopping the entire directory tree.
 */
export async function walkFiles(rootPath: string, exts: Set<string>): Promise<WalkResult> {
  const files: string[] = [];
  const issues: DirIssue[] = [];

  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > RECURSION_LIMIT) return;

    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        issues.push({
          path: dir,
          error_code: err.code === 'EACCES' ? 'EACCES' : 'OTHER',
          message: err.message,
        });
      }
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const lowered = entry.name.toLowerCase();
        if (lowered.startsWith('.') || lowered.startsWith('$') || SKIP_DIRS.has(lowered)) continue;
        await visit(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const dot = entry.name.lastIndexOf('.');
      if (dot < 0) continue;
      const ext = entry.name.slice(dot + 1).toLowerCase();
      if (!exts.has(ext)) continue;
      files.push(full);
    }
  }

  await visit(path.resolve(rootPath), 0);
  return { files, issues };
}

/** Reading stat with leaving EACCES/ENOENT on the outside (for incremental diffing). */
export function statOrNull(file: string): { ok: true; stat: fs.Stats } | { ok: false; gone: boolean } {
  try {
    return { ok: true, stat: fs.statSync(file) };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    return { ok: false, gone: err.code !== undefined && err.code !== 'EACCES' };
  }
}
