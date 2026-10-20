import { test, expect, _electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('main window opens, IPC ping works, empty state visible', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-e2e-'));
  const app = await _electron.launch({
    args: ['.'],
    env: { ...process.env, VIBE_USER_DATA_OVERRIDE: userData },
    timeout: 60000,
  });

  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await expect(win).toHaveTitle(/VibeGallery/);

    const pong = await win.evaluate(async () => {
      const res = await window.vibe.invoke('app:ping');
      return res;
    });
    expect(pong.pong).toBeGreaterThan(0);

    await expect(win.getByTestId('empty-state')).toBeVisible({ timeout: 15000 });
    await expect(win.getByTestId('empty-state')).toContainText(/Библиотека пуста|Library is empty/);
  } finally {
    await app.close();
  }
});
