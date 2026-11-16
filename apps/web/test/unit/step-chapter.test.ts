import { describe, expect, it } from 'vitest';
import { chapterForDonning } from '../../src/ar/step-chapter.ts';

describe('chapterForDonning', () => {
  it('d1…d6 son los capítulos 0…5 de la película de /bata-3d', () => {
    expect(chapterForDonning('d1')).toBe(0);
    expect(chapterForDonning('d6')).toBe(5);
  });

  it('sin paso del protocolo no hay miniatura', () => {
    expect(chapterForDonning(undefined)).toBeNull();
    expect(chapterForDonning('d7')).toBeNull();
    expect(chapterForDonning('p1')).toBeNull();
  });
});
