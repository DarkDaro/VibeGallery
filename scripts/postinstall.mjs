import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require_ = createRequire(import.meta.url);

function electronPath() {
  try {
    const bin = require_('electron');
    if (typeof bin === 'string' && fs.existsSync(bin)) return bin;
  } catch {}
  const guessWin = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  if (process.platform === 'win32' && fs.existsSync(guessWin)) return guessWin;
  const guessNix = path.join(root, 'node_modules', 'electron', 'dist', 'electron');
  if (fs.existsSync(guessNix)) return guessNix;
  return null;
}

function electronVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'electron', 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return null;
  }
}

function sqliteLoadsInElectron() {
  const exe = electronPath();
  if (!exe) return false;
  const script = 'const D=require("better-sqlite3");const d=new D(":memory:");d.exec("create table t(a)");d.close();console.log("SQLITE_OK")';
  const r = spawnSync(exe, ['-e', script], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  return r.status === 0 && (r.stdout || '').includes('SQLITE_OK');
}

function tryCmd(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: opts.timeout ?? 10 * 60 * 1000,
    shell: process.platform === 'win32',
    ...opts,
  });
}

if (!fs.existsSync(path.join(root, 'node_modules', 'better-sqlite3'))) {
  console.log('[postinstall] better-sqlite3 not present, skipping native check');
  process.exit(0);
}

console.log('[postinstall] checking better-sqlite3 loadability under Electron runtime...');

if (sqliteLoadsInElectron()) {
  console.log('[postinstall] OK: better-sqlite3 already matched to Electron ABI');
  process.exit(0);
}

console.log('[postinstall] ABI mismatch, rebuilding better-sqlite3 for Electron...');

let r = tryCmd('npx', ['@electron/rebuild', '-f', '-w', 'better-sqlite3']);
if (r.status !== 0) {
  console.log('[postinstall] @electron/rebuild failed (likely no C++ Build Tools). Falling back to prebuilt binary download...');
  const ver = electronVersion();
  if (ver) {
    r = tryCmd('npx', ['prebuild-install', '-r', 'electron', '-t', ver, '--verbose'], {
      cwd: path.join(root, 'node_modules', 'better-sqlite3'),
    });
  }
}

if (sqliteLoadsInElectron()) {
  console.log('[postinstall] OK: better-sqlite3 rebuilt for Electron ABI');
  process.exit(0);
}

console.log(
  [
    '[postinstall] WARNING: better-sqlite3 could not be matched to Electron ABI.',
    '[postinstall] npm install stays green, but the app may fail to start until fixed:',
    '[postinstall]   1) install Visual Studio Build Tools (Desktop development with C++), then: npx @electron/rebuild -f -w better-sqlite3',
    '[postinstall]   2) or pin Electron to a version that has a better-sqlite3 prebuilt for its ABI',
    '[postinstall]   3) or switch electron/db/client.ts to the sql.js fallback (already planned)',
  ].join('\n'),
);
process.exit(0);
