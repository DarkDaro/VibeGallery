import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES_DIR = path.join('tests', 'fixtures', 'videos');
const platformBin = process.platform === 'win32' ? 'win32' : process.platform;
const binDir = path.join('resources', 'bin', platformBin);
const ffmpegPath = path.join(binDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');

function ffmpeg(...args) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-y', ...args], { stdio: 'pipe' });
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed: ${args.join(' ')}\n${String(r.stderr)}`);
  }
}

const DURATION = '5';
const inputs = [
  '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:d=' + DURATION + ':r=25',
  '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
  '-fflags', '+bitexact', '-flags', '+bitexact', '-map_metadata', '-1', '-shortest',
];

fs.mkdirSync(FIXTURES_DIR, { recursive: true });

ffmpeg(...inputs, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-c:a', 'aac', path.join(FIXTURES_DIR, 'small.mp4'));
ffmpeg(...inputs, '-c:v', 'libx265', '-pix_fmt', 'yuv420p', '-crf', '32', '-c:a', 'aac', path.join(FIXTURES_DIR, 'mkv_h265.mkv'));
ffmpeg(...inputs, '-c:v', 'mpeg4', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(FIXTURES_DIR, 'movie.avi'));

fs.copyFileSync(path.join(FIXTURES_DIR, 'small.mp4'), path.join(FIXTURES_DIR, 'dupe.mp4'));

const full = fs.readFileSync(path.join(FIXTURES_DIR, 'small.mp4'));
fs.writeFileSync(path.join(FIXTURES_DIR, 'corrupt.mp4'), full.subarray(0, 2048));

console.log('fixtures generated in', FIXTURES_DIR);
