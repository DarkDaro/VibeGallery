import { describe, expect, it } from 'vitest';
import path from 'node:path';

import { probeVideo } from '../../electron/services/ffprobe';
import { binaries } from '../../electron/scanner/binaries';

const FIXTURES = path.resolve('tests/fixtures/videos');

describe('probeVideo (real bundled ffprobe)', () => {
  it('reads metrics from a healthy mp4', async () => {
    const meta = await probeVideo(binaries().ffprobe, path.join(FIXTURES, 'small.mp4'));
    expect(meta.duration_ms).toBeGreaterThan(4000);
    expect(meta.duration_ms).toBeLessThan(6100);
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
    expect(meta.codec).not.toBe('');
  });

  it('rejects on a corrupt file', async () => {
    await expect(probeVideo(binaries().ffprobe, path.join(FIXTURES, 'corrupt.mp4'))).rejects.toThrow();
  });
});
