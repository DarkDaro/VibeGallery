import { app, nativeTheme, session } from 'electron';
import path from 'node:path';
import log from 'electron-log/main';
import { applyDebugFlag, initLogger, isDebug } from './services/logger';
import { ensureDirs } from './paths';
import { initializeDatabase, closeDatabase } from './db/client';
import { initSettingsService } from './services/settings';
import { registerIpc } from './ipc';
import { registerMediaPrivileges, registerMediaHandler } from './protocol/media';
import { createMainWindow, getMainWindow } from './windows/main-window';

const devUrl = process.env.VITE_DEV_SERVER_URL;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  boot();
}

function boot(): void {
  app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  const userDataOverride = process.env.VIBE_USER_DATA_OVERRIDE;
  if (userDataOverride) {
    // e2e/диагностика: изолированный профиль вместо реального пользователя
    app.setPath('userData', path.resolve(userDataOverride));
  }

  applyDebugFlag(process.argv);
  initLogger();

  // должно быть вызвано ДО app ready
  registerMediaPrivileges();

  app.whenReady()
    .then(async () => {
      ensureDirs();
      registerMediaHandler(session.defaultSession);

    try {
      const db = await initializeDatabase({
        filePath: path.join(app.getPath('userData'), 'library.db'),
        onLog: (msg) => log.info(`[db] ${msg}`),
      });
      initSettingsService(db);
    } catch (err) {
      log.error('[db] fatal:', err instanceof Error ? err.stack : String(err));
      app.exit(1);
      return;
    }

    registerIpc();

    nativeTheme.on('updated', () => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('theme:systemChanged', { isDark: nativeTheme.shouldUseDarkColors });
      }
    });

    const win = createMainWindow(devUrl);
    win.webContents.on('did-finish-load', () => {
      if (!win.isDestroyed()) {
        win.webContents.send('theme:systemChanged', { isDark: nativeTheme.shouldUseDarkColors });
      }
    });

    log.info(
      `VibeGallery started: electron=${process.versions.electron ?? '?'} debug=${String(isDebug())} mode=${devUrl ? 'dev' : 'prod'}`,
    );
  })
    .catch((err) => {
      log.error('[fatal]', err instanceof Error ? err.stack : String(err));
      app.exit(1);
    });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    closeDatabase();
  });
}
