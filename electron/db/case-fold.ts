/** Cut folding used by *_key columns: JS toLowerCase covers Cyrillic (SQLite NOCASE does not). */
export function foldKey(value: string): string {
  return value.toLowerCase();
}
