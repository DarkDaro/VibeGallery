import { net, protocol, type Session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { VIDEO_EXTENSION_SET } from '../../shared/constants';

export const MEDIA_SCHEME = 'media';

/** Regulations are registered BEFORE app ready. */
export function registerMediaPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        stream: true,
        supportFetchAPI: true,
        secure: true,
      },
    },
  ]);
}

interface MediaUrl {
  ok: true;
  filePath: string;
}

interface MediaUrlError {
  ok: false;
  status: number;
  reason: string;
}

/**
 * format: media:///<encoded absolute path>. Host version (media://C:/… on Windows)
 * is not permitted — the parser is strict, so that absolute paths don't turn into URLs with %3A.
 */
function parseMediaUrl(rawUrl: string): MediaUrl | MediaUrlError {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== `${MEDIA_SCHEME}:` || u.host !== '') {
      return { ok: false, status: 400, reason: 'Bad media URL form' };
    }
    const decoded = decodeURIComponent(u.pathname.replace(/^\//, ''));
    if (!path.isAbsolute(decoded)) {
      return { ok: false, status: 400, reason: 'Absolute path required' };
    }
    const normalized = path.normalize(decoded);
    if (!VIDEO_EXTENSION_SET.has(path.extname(normalized).toLowerCase().slice(1))) {
      return { ok: false, status: 415, reason: 'Extension not allowed' };
    }
    if (!fs.existsSync(normalized) || !fs.statSync(normalized).isFile()) {
      return { ok: false, status: 404, reason: 'File not found' };
    }
    return { ok: true, filePath: normalized };
  } catch {
    return { ok: false, status: 400, reason: 'Malformed media URL' };
  }
}

export function registerMediaHandler(s: Session): void {
  s.protocol.handle(MEDIA_SCHEME, async (request: Request) => {
    const parsed = parseMediaUrl(request.url);
    if (!parsed.ok) {
      return new Response(parsed.reason, { status: parsed.status });
    }
    // net.fetch через file:// тянет Range/CORS из коробки Chromium'а
    return net.fetch(pathToFileURL(parsed.filePath).toString());
  });
}
