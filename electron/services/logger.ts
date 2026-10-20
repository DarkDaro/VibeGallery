import log from 'electron-log/main';
import path from 'node:path';
import fs from 'node:fs';
import { dirs } from '../paths';

let debugMode = process.argv.includes('--debug');

export function isDebug(): boolean {
  return debugMode;
}

export function applyDebugFlag(argv: string[]): void {
  debugMode = argv.includes('--debug');
}

/** Rotation: app.log + up to 9 archive copies (10 files total per 5 MB). */
function rotate(oldLogFile: { path: string }): void {
  const file = oldLogFile.path;
  const parsed = path.parse(file);
  try {
    const ninth = `${parsed.dir}${path.sep}${parsed.name}.9${parsed.ext}`;
    if (fs.existsSync(ninth)) fs.rmSync(ninth, { force: true });
    for (let i = 9; i > 1; i--) {
      const from = `${parsed.dir}${path.sep}${parsed.name}.${i - 1}${parsed.ext}`;
      const to = `${parsed.dir}${path.sep}${parsed.name}.${i}${parsed.ext}`;
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    fs.renameSync(file, `${parsed.dir}${path.sep}${parsed.name}.1${parsed.ext}`);
  } catch {
    // if the rotation didn't work — the next cycle will try again
  }
}

export function initLogger(): void {
  log.initialize();
  log.transports.file.resolvePathFn = () => path.join(dirs.logs(), 'app.log');
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.file.archiveLogFn = rotate;
  log.transports.file.level = debugMode ? 'silly' : 'info';
  log.transports.console.level = debugMode ? 'silly' : 'warn';
}
