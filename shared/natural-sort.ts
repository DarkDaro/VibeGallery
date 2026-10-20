/**
 * Natural sort: «Файл 2» before «Файл 10», digit sequences compared by value,
 * case-insensitive (lowercase fold), non-digit characters compared by code point.
 * Leading zeros matter only as a tiebreak for equal numeric values
 * («Файл 1» then «Файл 01», so stable renumbering keeps order).
 */
export function naturalCompare(a: string, b: string): number {
  const ax = a.toLowerCase();
  const bx = b.toLowerCase();

  let i = 0;
  let j = 0;

  while (i < ax.length && j < bx.length) {
    const da = isDigit(ax[i]!);
    const db = isDigit(bx[j]!);

    if (da && db) {
      const ra = digitRun(ax, i);
      const rb = digitRun(bx, j);
      const cmp = compareNumericRuns(ra, rb);
      if (cmp !== 0) return cmp;
      i += ra.length;
      j += rb.length;
      continue;
    }

    const ca = ax[i]!;
    const cb = bx[j]!;
    if (ca !== cb) return ca < cb ? -1 : 1;
    i++;
    j++;
  }

  // Shorter string first when one is a prefix of the other.
  if (i < ax.length) return 1;
  if (j < bx.length) return -1;
  return 0;
}

interface DigitRun {
  value: string;
  zeros: number;
  length: number;
}

function digitRun(s: string, start: number): DigitRun {
  let end = start;
  while (end < s.length && isDigit(s[end]!)) end++;
  const raw = s.slice(start, end);
  let zeros = 0;
  while (zeros < raw.length && raw[zeros] === '0') zeros++;
  return { value: raw.slice(zeros), zeros, length: raw.length };
}

function compareNumericRuns(ra: DigitRun, rb: DigitRun): number {
  if (ra.value.length !== rb.value.length) return ra.value.length < rb.value.length ? -1 : 1;
  if (ra.value !== rb.value) return ra.value < rb.value ? -1 : 1;
  if (ra.zeros !== rb.zeros) return ra.zeros < rb.zeros ? -1 : 1;
  return 0;
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}
