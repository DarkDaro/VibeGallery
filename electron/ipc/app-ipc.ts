import { isDebug } from '../services/logger';
import type { PingResult } from '../../shared/ipc';

export function ping(): PingResult {
  return {
    pong: Date.now(),
    electron: process.versions.electron ?? 'unknown',
    debug: isDebug(),
  };
}
