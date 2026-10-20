import { spawn } from 'node:child_process';

export interface ProbeResult {
  duration_ms: number;
  width: number;
  height: number;
  bitrate_kbps: number;
  codec: string;
}

/** Errors that map to scan statuses. */
export class ProbeUnavailableError extends Error {
  code: 'ENOENT_BINARY' | 'TIMEOUT' | 'SPAWN';

  constructor(code: 'ENOENT_BINARY' | 'TIMEOUT' | 'SPAWN', message: string) {
    super(message);
    this.code = code;
    this.name = 'ProbeUnavailableError';
  }
}

const PROBE_TIMEOUT_MS = 10_000;

/**
 * Runs ffprobe on a file (ffprobe version resolution is passed by the caller,
 * so the service works in both dev and packaged mode).
 */
export function probeVideo(ffprobePath: string, filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffprobePath, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ], { windowsHide: true });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const fail = (code: 'ENOENT_BINARY' | 'TIMEOUT' | 'SPAWN', message: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ProbeUnavailableError(code, `${ffprobePath}: ${message}`));
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      fail('TIMEOUT', `probe timeout after ${PROBE_TIMEOUT_MS}ms`);
    }, PROBE_TIMEOUT_MS);

    child.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') fail('ENOENT_BINARY', 'ffprobe binary not found');
      else fail('SPAWN', e.message);
    });

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new ProbeUnavailableError('SPAWN', `exit code ${code}: ${stderr.trim().slice(0, 500)}`));
        return;
      }
      try {
        resolve(parseFfprobeJson(stdout));
      } catch {
        reject(new ProbeUnavailableError('SPAWN', `unparsable ffprobe output: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

function parseFfprobeJson(raw: string): ProbeResult {
  const data = JSON.parse(raw) as {
    format?: { duration?: string; bit_rate?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string }>;
  };

  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');

  const durationSec = Number(data.format?.duration ?? video?.duration ?? 0);
  const bitRate = Number(data.format?.bit_rate ?? 0);

  return {
    duration_ms: Number.isFinite(durationSec) ? Math.round(durationSec * 1000) : 0,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    bitrate_kbps: Number.isFinite(bitRate) ? Math.round(bitRate / 1000) : 0,
    codec: video?.codec_name ?? '',
  };
}
