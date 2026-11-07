// Pixel art of the "Quirófano menta" world, authored here as character grids (own work, no
// third-party art). Each character maps to a colour token in styles.css; `.` is transparent.
// <PixelSprite> draws them as crisp SVG rects. test/unit/sprites.test.ts checks every grid.

/** Character → `--color-<token>`. */
export const PIXEL_PALETTE = {
  k: 'ink',
  w: 'bg',
  m: 'band',
  M: 'primary',
  D: 'primary-strong',
  g: 'gown',
  G: 'gown-trim',
  s: 'px-skin',
  S: 'px-skin-shade',
  h: 'px-hair',
  c: 'px-cheek',
  q: 'mask',
  Q: 'mask-shade',
  l: 'glove',
  L: 'glove-shade',
  y: 'xp',
  b: 'seal',
  B: 'px-bronze',
  o: 'streak',
  t: 'tile',
  f: 'border',
  d: 'surface',
  u: 'muted',
  p: 'info',
  r: 'danger',
} as const;

export type PixelChar = keyof typeof PIXEL_PALETTE;

export interface Sprite {
  /** Rows of equal length; every character is `.` or a key of PIXEL_PALETTE. */
  rows: readonly string[];
}

/**
 * Dra. Menta, the scrub nurse: cap, mask, gown from the 3D model, gloved hands held together in
 * front of the chest (the sterile posture the game teaches; she never shows a wrong one).
 */
export const MASCOT: Sprite = {
  rows: [
    '....kkkkkkkk....',
    '...kmmmmmmmmk...',
    '..kmmmtmmtmmmk..',
    '..kmmmmmmmmmmk..',
    '..khssssssshhk..',
    '..khskksskkshk..',
    '..kqqqqqqqqqqk..',
    '..kqQqqqqqqQqk..',
    '...kqqqqqqqqk...',
    '....kssssssk....',
    '.kgggggGGgggggk.',
    'kggggggggggggggk',
    'kgggkllllllkgggk',
    'kgggklLllLlkgggk',
    'kgggGkkkkkkGgggk',
    '.kggggggggggggk.',
    '.kggggggGgggggk.',
    '.kggggggGgggggk.',
    '.kggggggGgggggk.',
    '..kkkkkkkkkkkk..',
    '...kDDk..kDDk...',
    '...kkkk..kkkk...',
  ],
};

/** Mission icons, keyed like `iconKey` in content/questions/seed.json. */
export const MISSION_SPRITES = {
  // M-01 Fundamentos de bioseguridad: a shield with a cross.
  shield: {
    rows: [
      '................',
      '..kkkkkkkkkkkk..',
      '..kmmmmwwmmmmk..',
      '..kmmmmwwmmmmk..',
      '..kmmwwwwwwmmk..',
      '..kmmwwwwwwmmk..',
      '..kmmmmwwmmmmk..',
      '..kmmmmwwmmmmk..',
      '..kmmmmmmmmmmk..',
      '...kmmmmmmmmk...',
      '...kMmmmmmmMk...',
      '....kMmmmmMk....',
      '.....kMmmMk.....',
      '......kMMk......',
      '.......kk.......',
      '................',
    ],
  },
  // M-02 Tipos de bata: a gown with knit cuffs.
  gown: {
    rows: [
      '................',
      '....kkkkkkkk....',
      '...kgggkkgggk...',
      '..kggggGGggggk..',
      '.kggggggggggggk.',
      'kggkggggggggkggk',
      'kggkggggggggkggk',
      'kggkggggggggkggk',
      'kGGkggggggggkGGk',
      'kkkkggggggggkkkk',
      '...kggggggggk...',
      '...kggggggggk...',
      '..kggggggggggk..',
      '..kggggggggggk..',
      '..kkkkkkkkkkkk..',
      '................',
    ],
  },
  // M-03 Colocación de bata y guantes: a gloved hand over the gown's sleeve.
  gloves: {
    rows: [
      '.....k.k.k.k....',
      '....klklklklk...',
      '....klklklklk...',
      '....klklklklk...',
      '.kk.klklklklk...',
      'kllkllllllllk...',
      'kllklllllllLk...',
      '.kllllllllllk...',
      '..klllllllllk...',
      '...kllllllllk...',
      '...kLllllllLk...',
      '...kLLLLLLLLk...',
      '...kggggggggk...',
      '...kggggggggk...',
      '...kggggggggk...',
      '...kkkkkkkkkk...',
    ],
  },
  // M-04 Campo estéril: a fenestrated drape seen from above.
  field: {
    rows: [
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kMMMMMMMMMMMMk.',
      '.kMmMMMMMMMMmMk.',
      '.kMMMMMMMMMMMMk.',
      '.kMMMkkkkkkMMMk.',
      '.kMMMkssssSkMMk.',
      '.kMMMkssssSkMMk.',
      '.kMMMkSSSSSkMMk.',
      '.kMMMkkkkkkkMMk.',
      '.kMMMMMMMMMMMMk.',
      '.kMmMMMMMMMMmMk.',
      '.kMMMMMMMMMMMMk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
    ],
  },
  // M-05 Retiro de la bata y lista de verificación: a clipboard with two checks.
  checklist: {
    rows: [
      '......kyyk......',
      '..kkkkkyykkkkk..',
      '..kwwwwwwwwwwk..',
      '..kwwMwwwwwwwk..',
      '..kMMwwkkkkkwk..',
      '..kwwwwwwwwwwk..',
      '..kwwMwwwwwwwk..',
      '..kMMwwkkkkkwk..',
      '..kwwwwwwwwwwk..',
      '..kwkkkwwwwwwk..',
      '..kwkwkwkkkkwk..',
      '..kwkkkwwwwwwk..',
      '..kwwwwwwwwwwk..',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
    ],
  },
} satisfies Record<string, Sprite>;

/** The pixel icon for a mission's `iconKey`, falling back to the shield. */
export function missionSprite(iconKey: string): Sprite {
  return (MISSION_SPRITES as Record<string, Sprite>)[iconKey] ?? MISSION_SPRITES.shield;
}

/** The streak flame: orange outside, gold core. */
export const FLAME: Sprite = {
  rows: [
    '....kk....',
    '...kok....',
    '...kook...',
    '..kooook..',
    '.kooyoook.',
    '.kooyyook.',
    'kooyyyyook',
    'kooyyyyook',
    'kooyyyyook',
    '.kooyyook.',
    '..kooook..',
    '...kkkk...',
  ],
};

/** The XP gem. */
export const XP_GEM: Sprite = {
  rows: [
    '....kk....',
    '...kyyk...',
    '..kywyyk..',
    '.kywyyyyk.',
    'kyyyyyyyyk',
    'kbyyyyyybk',
    '.kbyyyybk.',
    '..kbyybk..',
    '...kbbk...',
    '....kk....',
  ],
};

/** The mastered medal: bronze disc with a dark-bronze cross on a mint-and-green ribbon. */
export const MEDAL: Sprite = {
  rows: [
    '...kkk....kkk...',
    '...kMmk..kmMk...',
    '....kMmkkmMk....',
    '.....kMmmMk.....',
    '.....kkkkkk.....',
    '....kBBBBBBk....',
    '...kBBwBBBBBk...',
    '..kBwBBBbBBBBk..',
    '..kBBBBbbbBBbk..',
    '..kBBBbbbbbBbk..',
    '..kBBBBbbbBBbk..',
    '..kBBBBBbBBbbk..',
    '...kbBBBBBbbk...',
    '....kbbbbbbk....',
    '.....kkkkkk.....',
    '................',
  ],
};

/** A gold star: the score of a mission (0 to 3 of them). */
export const STAR: Sprite = {
  rows: [
    '....k....',
    '...kyk...',
    '...kyk...',
    'kkkkykkkk',
    'kyyyyyyyk',
    '.kyyyyyk.',
    '..kyyyk..',
    '.kyk.kyk.',
    '.kkk.kkk.',
  ],
};

/** A four-point sparkle for celebrations. */
export const SPARKLE: Sprite = {
  rows: ['...y...', '...y...', '..ywy..', 'yywwwyy', '..ywy..', '...y...', '...y...'],
};
