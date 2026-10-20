import type { ExclusionRow } from '../../shared/types';

/** Predicates for scanning by the exclusions table (path / folder / pattern). */
export interface ExclusionPolicy {
  isPathExcluded(absPath: string): boolean;
}

/**
 * pattern: wildcards * (any, including dir separators) and ? (single char).
 * folder: anything nested inside the folder path (prefix compare, NOCASE).
 * path: an exact match of a file or folder (NOCASE).
 * All comparisons are deterministic and case-insensitive on the side of
 * the predicates themselves (can rely on both cells of the table and
 * independent folding of the input string).
 */
export function createExclusionPolicy(exclusions: ExclusionRow[]): ExclusionPolicy {
  const paths = new Set(exclusions.filter((e) => e.type === 'path').map((e) => e.path.toLowerCase()));
  const folders = exclusions.filter((e) => e.type === 'folder').map((e) => e.path.toLowerCase());
  const patterns = exclusions
    .filter((e) => e.type === 'pattern')
    .map((e) => wildcardToRegExp(e.path));

  return {
    isPathExcluded(absPath) {
      const lowered = absPath.toLowerCase();
      if (paths.has(lowered) || paths.has(loweredWithSlash(lowered))) return true;
      for (const folder of folders) {
        if (lowered === folder || lowered.startsWith(loweredWithSlash(folder))) return true;
      }
      for (const re of patterns) {
        if (re.test(absPath)) return true;
      }
      return false;
    },
  };
}

function loweredWithSlash(s: string): string {
  return s.endsWith('\\') || s.endsWith('/') ? s : `${s}\\`;
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}
