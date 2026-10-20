import path from 'node:path';

/**
 * Bundled ffprobe/ffmpeg resolution: in dev under resources/bin/<platform>,
 * in the packaged build process.resourcesPath/bin/<platform>.
 * Under ELECTRON_RUN_AS_NODE (unit tests) app is unavailable; the fallback is the
 * project cwd/resources/bin, which is also the dev-исполнению layout.
 */
export function binaries(): { ffprobe: string; ffmpeg: string } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let electronApp: { isPackaged?: boolean; getAppPath?: () => string } | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    electronApp = require('electron').app;
  } catch {
    electronApp = undefined;
  }

  const base =
    electronApp !== undefined && electronApp.isPackaged === true
      ? path.join(process.resourcesPath, 'bin')
      : path.join(process.cwd(), 'resources', 'bin');

  const exe = process.platform === 'win32' ? '.exe' : '';
  return {
    ffprobe: path.join(base, process.platform, `ffprobe${exe}`),
    ffmpeg: path.join(base, process.platform, `ffmpeg${exe}`),
  };
}
