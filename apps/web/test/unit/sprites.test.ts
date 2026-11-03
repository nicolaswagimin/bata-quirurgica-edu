import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FLAME,
  MASCOT,
  MEDAL,
  MISSION_SPRITES,
  PIXEL_PALETTE,
  SPARKLE,
  type Sprite,
  XP_GEM,
} from '../../src/art/sprites.ts';
import { spriteRuns } from '../../src/components/pixel-sprite.tsx';

const css = readFileSync(join(import.meta.dirname, '../../src/styles.css'), 'utf8');
const seed = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../content/questions/seed.json'), 'utf8'),
) as { missions: { iconKey: string }[] };

const ALL: Record<string, Sprite> = {
  MASCOT,
  FLAME,
  XP_GEM,
  MEDAL,
  SPARKLE,
  ...Object.fromEntries(Object.entries(MISSION_SPRITES).map(([k, v]) => [`mission:${k}`, v])),
};

describe('pixel sprites', () => {
  it.each(Object.entries(ALL))('%s is a rectangular grid of palette characters', (_, sprite) => {
    const width = sprite.rows[0]?.length ?? 0;
    expect(width).toBeGreaterThan(0);
    for (const row of sprite.rows) {
      expect(row).toHaveLength(width);
      for (const c of row) expect(c === '.' || c in PIXEL_PALETTE).toBe(true);
    }
  });

  it('every palette token exists in styles.css', () => {
    for (const token of Object.values(PIXEL_PALETTE)) {
      expect(css).toMatch(new RegExp(`--color-${token}:\\s*#[0-9a-f]{6};`));
    }
  });

  it('every mission in the seed has a pixel icon', () => {
    for (const m of seed.missions) expect(m.iconKey in MISSION_SPRITES).toBe(true);
  });

  it('merges same-colour pixels into runs', () => {
    const runs = spriteRuns({ rows: ['kkk.ww', '..k...'] });
    expect(runs).toEqual([
      { x: 0, y: 0, width: 3, token: 'ink' },
      { x: 4, y: 0, width: 2, token: 'bg' },
      { x: 2, y: 1, width: 1, token: 'ink' },
    ]);
  });
});
