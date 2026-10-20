import { test, expect, _electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('media:// serves a local mp4 through the renderer (CSP-safe)', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-e2e-'));
  const app = await _electron.launch({
    args: ['.'],
    env: { ...process.env, VIBE_USER_DATA_OVERRIDE: userData },
    timeout: 60000,
  });

  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');

    const fixturePath = path.resolve('tests/fixtures/videos/small.mp4');
    const src = `media:///${encodeURIComponent(fixturePath)}`;

    const loaded = await win.evaluate((src) => {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => resolve({ ok: true, duration: video.duration });
        video.onerror = () => reject(new Error(`video load failed: code=${video.error?.code ?? -1}`));
        video.src = src;
      });
    }, src);

    expect(loaded.ok).toBe(true);
    expect(loaded.duration).toBeGreaterThan(0);
    expect(loaded.duration).toBeCloseTo(5, 1);
  } finally {
    await app.close();
  }
});
