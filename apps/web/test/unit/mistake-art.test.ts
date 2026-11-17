import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MISTAKE_ART } from '../../src/art/mistake-art.ts';
import { PIXEL_PALETTE } from '../../src/art/sprites.ts';

const lessons = JSON.parse(
  readFileSync(new URL('../../../../content/lecciones/lecciones.json', import.meta.url), 'utf8'),
) as { lessons: { mistakes: { id: string }[] }[] };
const objects = new Set([
  'm1-caida',
  'm1-guantes',
  'm2-paquete-roto',
  'm2-indicador',
  'm5-solo-cirujano',
]);

describe('mistake approval art', () => {
  it('covers every lesson mistake exactly once', () => {
    const expected = lessons.lessons.flatMap((lesson) => lesson.mistakes.map(({ id }) => id));
    expect(MISTAKE_ART.map(({ id }) => id).sort()).toEqual(expected.sort());
    expect(MISTAKE_ART).toHaveLength(11);
  });

  for (const pair of MISTAKE_ART) {
    for (const side of ['wrong', 'right'] as const) {
      it(`${pair.id}/${side}: dimensions, palette, outline, highlight and caption`, () => {
        const { sprite, highlight, caption } = pair[side];
        const rows = sprite.rows;
        expect(rows).toHaveLength(objects.has(pair.id) ? 32 : 44);
        rows.forEach((row, y) => {
          expect(row).toHaveLength(32);
          [...row].forEach((cell, x) => {
            expect(cell === '.' || cell in PIXEL_PALETTE).toBe(true);
            if (cell !== '.' && cell !== 'k') {
              // Every exposed silhouette edge must have a one-cell ink outline.
              for (const [dx, dy] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ] as const) {
                expect(rows[y + dy]?.[x + dx], `unoutlined cell ${x},${y}`).toBeDefined();
                expect(rows[y + dy]?.[x + dx], `unoutlined cell ${x},${y}`).not.toBe('.');
              }
            }
          });
        });
        expect(rows.join('')).toContain('k');
        const { x, y, w, h } = highlight;
        for (const value of [x, y, w, h]) expect(Number.isInteger(value)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
        expect(x + w).toBeLessThanOrEqual(32);
        expect(y + h).toBeLessThanOrEqual(rows.length);
        expect(caption.trim().length).toBeGreaterThan(0);
        expect([...caption].length).toBeLessThanOrEqual(70);
      });
    }
  }
});
