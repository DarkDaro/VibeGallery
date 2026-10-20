import path from 'node:path';
import { app } from 'electron';

function dir(...parts: string[]): string {
  return path.join(app.getPath('userData'), ...parts);
}

export function ensureDirs(): void {
  const fs = require('node:fs') as typeof import('node:fs');
  for (const p of [dir('logs'), dir('cache', 'thumbnails'), dir('backups')]) {
    fs.mkdirSync(p, { recursive: true });
  }
}

export const files = {
  dbFile: () => dir('library.db'),
};

export const dirs = {
  logs: () => dir('logs'),
  cacheThumbnails: () => dir('cache', 'thumbnails'),
  backups: () => dir('backups'),
};
