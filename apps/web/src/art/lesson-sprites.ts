// Pixel illustrations for the "Errores frecuentes" pairs in /aprende (content/lecciones →
// wrongArt / rightArt). Own work, authored as character grids like src/art/sprites.ts. Wrong
// postures are drawn on a generic trainee (dark cap), never on Dra. Menta, who only models the
// correct technique.
import { MASCOT, MISSION_SPRITES, type Sprite } from './sprites.ts';

type Pixel = [x: number, y: number, c: string];

/** Copy of a sprite with some pixels replaced. */
function paint(base: Sprite, pixels: Pixel[]): Sprite {
  const rows = base.rows.map((r) => [...r]);
  for (const [x, y, c] of pixels) {
    const row = rows[y];
    if (row && x >= 0 && x < row.length) row[x] = c;
  }
  return { rows: rows.map((r) => r.join('')) };
}

/** Copy of a sprite with rows `from..` replaced by `rows`. */
function withRows(base: Sprite, from: number, rows: string[]): Sprite {
  const out = [...base.rows];
  rows.forEach((r, i) => {
    out[from + i] = r;
  });
  return { rows: out };
}

/** The generic trainee: Dra. Menta's outline with a dark cap. */
const TRAINEE: Sprite = {
  rows: MASCOT.rows.map((r, y) => (y < 4 ? r.replaceAll('m', 'G').replaceAll('t', 'g') : r)),
};

const POSTURE_LOW = withRows(TRAINEE, 10, [
  '.kgggggGGgggggk.',
  'kggggggggggggggk',
  'kggkggggggggkggk',
  'kggkggggggggkggk',
  '.kgkggggggggkgk.',
  '.kgkggggGgggkgk.',
  '.kGkggggGgggkGk.',
  '.klkggggGgggklk.',
  '.kllkggGgggkllk.',
  '..kkkkkkkkkkkk..',
]);

const POSTURE_ARMPITS = withRows(TRAINEE, 10, [
  '.kgggggGGgggggk.',
  'kllggggggggggllk',
  'kgkkkkkkkkkkkkgk',
  'kgkgggggggggGkgk',
  'kgkkkkkkkkkkkkgk',
  '.kggggggggggggk.',
]);

const POSTURE_MASK = withRows(TRAINEE, 6, [
  '..kqqqqqqqqllk..',
  '..kqQqqqqqqllk..',
  '...kqqqqqqkgk...',
  '....ksssssskgk..',
  '.kgggggGGggggggk',
  'kggggggggggggggk',
  'kgggkllkgggggggk',
  'kgggklLkgggggggk',
  'kgggGkkGgggggggk',
]);

const INSTRUMENT: Pixel[] = [
  [4, 3, 'w'],
  [11, 3, 'w'],
  [5, 4, 'w'],
  [10, 4, 'w'],
  [6, 5, 'w'],
  [9, 5, 'w'],
  [7, 6, 'w'],
  [8, 6, 'w'],
  [7, 7, 'w'],
  [8, 7, 'w'],
  [6, 8, 'w'],
  [9, 8, 'w'],
  [5, 9, 'w'],
  [10, 9, 'w'],
  [4, 10, 'w'],
  [6, 10, 'w'],
  [9, 10, 'w'],
  [11, 10, 'w'],
  [5, 11, 'w'],
  [10, 11, 'w'],
];

const DRAPE: Sprite = {
  rows: [
    '................',
    '.kkkkkkkkkkkkkk.',
    ...Array.from({ length: 11 }, () => '.kMMMMMMMMMMMMk.'),
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
};

const FLOOR: Sprite = {
  rows: Array.from({ length: 16 }, (_, y) =>
    y % 5 === 0
      ? 'ffffffffffffffff'
      : [...'dddddddddddddddd'].map((c, x) => (x % 5 === 0 ? 'f' : c)).join(''),
  ),
};

const PACK: Sprite = {
  rows: [
    '................',
    '..kkkkkkkkkkkk..',
    '.kwwwwwwwwwwwwk.',
    '.kwfwwwwwwwwfwk.',
    '.kwwfwwwwwwfwwk.',
    '.kwwwfwwwwfwwwk.',
    '.kddkddkddkddkk.',
    '.kdkddkddkddkdk.',
    '.kddkddkddkddkk.',
    '.kwwwfwwwwfwwwk.',
    '.kwwfwwwwwwfwwk.',
    '.kwfwwwwwwwwfwk.',
    '.kwwwwwwwwwwwwk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
};

/** The indicator stripes still pale: the pack never went through the process, or it failed. */
const PACK_UNCHANGED: Sprite = {
  rows: PACK.rows.map((r, y) =>
    y >= 6 && y <= 8 ? `${r.slice(0, 2)}${r.slice(2, 14).replaceAll('k', 'f')}${r.slice(14)}` : r,
  ),
};

const PACK_WET = paint(PACK, [
  // torn corner
  [13, 2, '.'],
  [14, 2, '.'],
  [12, 2, 'k'],
  [13, 3, 'k'],
  [14, 3, '.'],
  // water stain and drops
  [4, 3, 'p'],
  [5, 3, 'p'],
  [4, 4, 'p'],
  [3, 10, 'p'],
  [4, 11, 'p'],
  [5, 11, 'p'],
  [6, 14, 'p'],
  [10, 14, 'p'],
  [11, 15, 'p'],
]);

const SLEEVE_ROWS = [
  '...kGGGGGGGGk...',
  '...kGkGkGkGGk...',
  '...kggggggggk...',
  '...kggggggggk...',
  '...kggggggggk...',
  '...kggggggggk...',
  '...kggggggggk...',
  '...kkkkkkkkkk...',
];

/** Bare fingers out of the cuff before the glove is on. */
const HAND_OUT: Sprite = {
  rows: [
    '................',
    '....k.k.k.k.....',
    '...kskskskskk...',
    '...kskskskskk...',
    '...ksssssssSk...',
    '...ksssssssSk...',
    '....kSSSSSSk....',
    '....kkkkkkkk....',
    ...SLEEVE_ROWS,
  ],
};

/** Hand kept inside the sleeve; the glove lies over the cuff, fingers toward the elbow. */
const CUFF_CLOSED: Sprite = {
  rows: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..kllllllllllk..',
    '..kLllllllllLk..',
    '..kllllllllllk..',
    '..kkllllllllkk..',
    '...klklklklkk...',
    ...SLEEVE_ROWS,
  ],
};

const GLOVES = MISSION_SPRITES.gloves;

/** A punctured glove: skin shows through the hole. */
const GLOVE_HOLE = paint(GLOVES, [
  [6, 5, 'k'],
  [7, 5, 'k'],
  [8, 5, 'k'],
  [9, 5, 'k'],
  [5, 6, 'k'],
  [6, 6, 's'],
  [7, 6, 's'],
  [8, 6, 's'],
  [9, 6, 'S'],
  [10, 6, 'k'],
  [5, 7, 'k'],
  [6, 7, 's'],
  [7, 7, 's'],
  [8, 7, 's'],
  [9, 7, 'S'],
  [10, 7, 'k'],
  [6, 8, 'k'],
  [7, 8, 'k'],
  [8, 8, 'k'],
  [9, 8, 'k'],
]);

/** Bare hands with antimicrobial lather and water. */
const HANDS_SCRUB = paint(
  {
    rows: GLOVES.rows.map((r) =>
      r.replaceAll('l', 's').replaceAll('L', 'S').replaceAll('g', 'p').replaceAll('G', 'p'),
    ),
  },
  [
    [5, 2, 'w'],
    [9, 3, 'w'],
    [6, 6, 'w'],
    [7, 6, 'w'],
    [10, 8, 'w'],
    [5, 9, 'w'],
    [8, 10, 'w'],
    [1, 2, 'w'],
    [14, 4, 'w'],
    [14, 9, 'p'],
  ],
);

const GOWN = MISSION_SPRITES.gown;

const GOWN_SHAKE = paint(GOWN, [
  [0, 1, 'u'],
  [1, 2, 'u'],
  [0, 3, 'u'],
  [15, 1, 'u'],
  [14, 2, 'u'],
  [15, 3, 'u'],
  [0, 11, 'u'],
  [15, 12, 'u'],
  [1, 14, 'u'],
  [14, 15, 'u'],
  [4, 0, 'u'],
  [11, 0, 'u'],
]);

/** Held by the inside of the neckline with two hands. */
const GOWN_HELD = paint(GOWN, [
  [5, 0, 'k'],
  [6, 0, 'k'],
  [5, 1, 's'],
  [6, 1, 's'],
  [9, 0, 'k'],
  [10, 0, 'k'],
  [9, 1, 's'],
  [10, 1, 's'],
]);

/** Rolled inside-out: only the clean inner face shows. */
const GOWN_ROLLED: Sprite = {
  rows: [
    '................',
    '................',
    '................',
    '....kkkkkkkk....',
    '..kkwwwwwwwwkk..',
    '.kwwwdwwwwdwwwk.',
    'kwwdwwwwwwwwdwwk',
    'kwwwwgggggwwwwwk',
    'kwdwgkkkkkgwwdwk',
    'kwwwwgggggwwwwwk',
    '.kwwwwwdwwwwwwk.',
    '..kkwwwwwwwwkk..',
    '....kkkkkkkk....',
    '................',
    '................',
    '................',
  ],
};

/** Crumpled with the contaminated outer face out. */
const GOWN_HUG: Sprite = {
  rows: GOWN_ROLLED.rows.map((r, y) =>
    r.replaceAll('w', 'g').replaceAll('d', y % 2 === 0 ? 'r' : 'G'),
  ),
};

const MINI = [
  '.kkkkk.',
  'kmmmmmk',
  'ksssssk',
  'kqqqqqk',
  '.kqqqk.',
  'kgggggk',
  'kgggggk',
  'kgggggk',
  '.kgggk.',
  '.kk.kk.',
];

const miniWithCap = (cap: string) => MINI.map((r, y) => (y === 1 ? r.replaceAll('m', cap) : r));

function side(...figures: (string[] | null)[]): Sprite {
  const height = MINI.length;
  return {
    rows: Array.from({ length: height }, (_, y) =>
      figures.map((f) => (f ? (f[y] ?? '.......') : '.......')).join('.'),
    ),
  };
}

const TEAM_ONE = side(null, miniWithCap('G'), null);
const TEAM_ALL = side(miniWithCap('G'), miniWithCap('m'), miniWithCap('M'));

/** Every `wrongArt` / `rightArt` key used in content/lecciones/lecciones.json. */
export const LESSON_ART: Record<string, Sprite> = {
  'tool-floor': paint(FLOOR, [...INSTRUMENT.map(([x, y]): Pixel => [x, y, 'u'])]),
  'tool-drape': paint(DRAPE, INSTRUMENT),
  'glove-hole': GLOVE_HOLE,
  'hands-scrub': HANDS_SCRUB,
  'pack-ok': PACK,
  'pack-unchanged': PACK_UNCHANGED,
  'pack-wet': PACK_WET,
  'hand-out': HAND_OUT,
  'cuff-closed': CUFF_CLOSED,
  'gown-shake': GOWN_SHAKE,
  'gown-held': GOWN_HELD,
  'posture-ok': TRAINEE,
  'posture-low': POSTURE_LOW,
  'posture-armpits': POSTURE_ARMPITS,
  'posture-mask': POSTURE_MASK,
  'gown-rolled': GOWN_ROLLED,
  'gown-hug': GOWN_HUG,
  'team-one': TEAM_ONE,
  'team-all': TEAM_ALL,
};
