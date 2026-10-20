import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PLATFORM_DIRS = { win32: 'win32', darwin: 'darwin', linux: 'linux' };
const platform = process.platform;
const destDir = path.join('resources', 'bin', PLATFORM_DIRS[platform] ?? platform);

const URLS = {
  win32: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
  darwin: 'https://evermeet.cx/ffmpeg/getrelease/zip',
};

const binaryNames = platform === 'win32' ? ['ffmpeg.exe', 'ffprobe.exe'] : ['ffmpeg', 'ffprobe'];

function haveBinaries() {
  return binaryNames.every((n) => fs.existsSync(path.join(destDir, n)));
}

async function download(url, zipPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const totalBytes = Number(res.headers.get('content-length') ?? 0);
  if (!res.body) throw new Error('Empty response body');
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  let lastPct = -1;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (totalBytes) {
      const pct = Math.floor((received / totalBytes) * 100);
      if (pct !== lastPct && pct % 10 === 0) {
        console.log(`downloading... ${pct}% (${Math.round(received / 1e6)} MB)`);
        lastPct = pct;
      }
    }
  }
  fs.writeFileSync(zipPath, Buffer.concat(chunks));
}

function extract(zipPath, extractDir) {
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  const r = spawnSync('tar', ['-xf', zipPath, '-C', extractDir], { stdio: 'pipe' });
  if (r.status !== 0) {
    console.log('tar failed, falling back to PowerShell Expand-Archive...');
    const ps = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`],
      { stdio: 'pipe' },
    );
    if (ps.status !== 0) {
      throw new Error(`Extraction failed:\n${String(ps.stderr)}\n${String(r.stderr)}`);
    }
  }
}

function findBinary(rootDir, name) {
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const p = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'doc' && entry.name !== 'presets' && stack.length < 50) stack.push(p);
      } else if (entry.name === name) {
        return p;
      }
    }
  }
  return null;
}

if (process.argv.includes('--force')) {
  fs.rmSync(destDir, { recursive: true, force: true });
}

if (haveBinaries()) {
  console.log(`ffmpeg binaries already present in ${destDir}`);
  process.exit(0);
}

if (platform !== 'win32' && platform !== 'darwin') {
  console.error('Auto-fetch is configured for win32/darwin. For Linux install ffmpeg manually into resources/bin/linux.');
  process.exit(1);
}

const url = URLS[platform];
if (!url) {
  console.error(`No download URL for platform ${platform}`);
  process.exit(1);
}

const tempDir = path.join(os.tmpdir(), 'vibe-gallery-ffmpeg');
fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });

const zipPath = path.join(tempDir, 'ffmpeg.zip');
console.log(`Fetching ${url}`);
await download(url, zipPath);
console.log('Archive saved, extracting...');
extract(zipPath, path.join(tempDir, 'x'));

fs.mkdirSync(destDir, { recursive: true });
for (const name of binaryNames) {
  const found = findBinary(path.join(tempDir, 'x'), name);
  if (!found) throw new Error(`${name} not found inside archive`);
  fs.copyFileSync(found, path.join(destDir, name));
  if (platform !== 'win32') fs.chmodSync(path.join(destDir, name), 0o755);
  console.log(`installed ${name} -> ${path.join(destDir, name)}`);
}

fs.rmSync(tempDir, { recursive: true, force: true });
console.log('done');
