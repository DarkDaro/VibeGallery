import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { THUMB_TIMEOUT_MS } from '../../shared/constants';

export class ThumbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThumbError';
  }
}

/**
 * Takes a frame at ~10% of the duration, scales it down to 320 px wide
 * and puts it in cache/thumbnails/<videoId>.jpg.
 */
export function generateThumbnail(
  ffmpegPath: string,
  cacheDir: string,
  videoPath: string,
  videoId: number,
  durationMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const outPath = path.join(cacheDir, `${videoId}.jpg`);
    fs.rmSync(outPath, { force: true });

    const seekSec = durationMs > 0 ? Math.max(0, (durationMs * 0.1) / 1000) : 1;

    const child = spawn(ffmpegPath, [
      '-v', 'error',
      '-ss', seekSec.toFixed(3),
      '-i', videoPath,
      '-frames:v', '1',
      '-vf', 'scale=320:-2',
      '-y',
      outPath,
    ], { windowsHide: true });

    let stderr = '';
    let settled = false;
    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ThumbError(`${videoPath}: ${message}`));
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      fail(`thumbnail timeout after ${THUMB_TIMEOUT_MS}ms`);
    }, THUMB_TIMEOUT_MS);

    child.on('error', (e) => fail(e.message));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0 || !fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
        fail(`exit code ${code}: ${stderr.trim().slice(0, 300)}`);
        return;
      }
      resolve(outPath);
    });
  });
}

/** Deletes a thumbnail file of a given video (balance of cache on delete). */
export function removeThumbnail(cacheDir: string, videoId: number): void {
  fs.rmSync(path.join(cacheDir, `${videoId}.jpg`), { force: true });
}
