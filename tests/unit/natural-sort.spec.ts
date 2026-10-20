import { describe, expect, it } from 'vitest';
import { naturalCompare } from '../../shared/natural-sort';

describe('naturalCompare', () => {
  it('sorts digits by value, not per-character', () => {
    const input = ['Файл 10', 'Файл 2', 'Файл 1', 'Файл 01'];
    const sorted = [...input].sort(naturalCompare);
    expect(sorted).toEqual(['Файл 1', 'Файл 01', 'Файл 2', 'Файл 10']);
  });

  it('is case-insensitive and handles mixed letter/digit boundaries', () => {
    const input = ['sample2.mp4', 'Sample10.mp4', 'sample a.mp4', 'SampleB.mp4'];
    const sorted = [...input].sort(naturalCompare);
    expect(sorted).toEqual(['sample a.mp4', 'sample2.mp4', 'Sample10.mp4', 'SampleB.mp4']);
  });
});
