import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { getWindowBoundsRaw, setInternal } from '../services/settings';
import { isDebug } from '../services/logger';

let win: BrowserWindow | null = null;
let saveTimer: NodeJS.Timeout | null = null;

export function getMainWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null;
}

function currentBounds() {
  return {
    width: win!.getBounds().width,
    height: win!.getBounds().height,
    x: win!.getBounds().x,
    y: win!.getBounds().y,
    maximized: win!.isMaximized(),
  };
}

/** Geometry must lie on one of the connected monitors; otherwise we are default. */
function boundsOnScreen(b: { x: number; y: number; width: number; height: number }): boolean {
  return screen.getAllDisplays().some((d) => {
    const { x, y, width, height } = d.workArea;
    return b.x >= x - 10 && b.y >= y - 10 && b.x + b.width <= x + width + 10 && b.y + b.height <= y + height + 10;
  });
}

function applyStoredBounds(win_: BrowserWindow): void {
  const stored = getWindowBoundsRaw();
  if (!stored) return;
  if (stored.maximized) {
    win_.maximize();
  } else if (boundsOnScreen(stored)) {
    win_.setBounds({ width: stored.width, height: stored.height, x: stored.x, y: stored.y });
  }
}

function scheduleSaveBounds(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (getMainWindow()) {
      try {
        setInternal('windowBounds', currentBounds());
      } catch {
        // дб may be closing on quit — молча пропущу
      }
    }
  }, 500);
}

export function createMainWindow(devUrl?: string): BrowserWindow {
  if (win && !win.isDestroyed()) return win;

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    title: 'VibeGallery',
    show: false,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  applyStoredBounds(win);

  win.once('ready-to-show', () => win!.show());

  win.on('close', () => {
    try {
      setInternal('windowBounds', currentBounds());
    } catch {
      // на выходе БД может быть уже закрыта — ок
    }
  });

  win.on('resize', scheduleSaveBounds);
  win.on('move', scheduleSaveBounds);
  win.on('closed', () => {
    win = null;
  });

  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'src', 'index.html'));
  }

  if (isDebug()) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  return win;
}
