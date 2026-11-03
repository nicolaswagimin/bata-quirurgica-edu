import { PIXEL_PALETTE, type PixelChar, type Sprite } from '../art/sprites.ts';

interface Run {
  x: number;
  y: number;
  width: number;
  token: string;
}

const isPixelChar = (c: string): c is PixelChar => c in PIXEL_PALETTE;

/** Horizontal runs of one colour, so a 16×16 sprite is a few dozen rects instead of 256. */
export function spriteRuns(sprite: Sprite): Run[] {
  const runs: Run[] = [];
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x] ?? '.';
      let end = x + 1;
      while (end < row.length && row[end] === c) end += 1;
      if (isPixelChar(c)) runs.push({ x, y, width: end - x, token: PIXEL_PALETTE[c] });
      x = end;
    }
  });
  return runs;
}

/**
 * A pixel-art sprite as crisp SVG. Decorative by default; pass `label` when the art carries meaning
 * a screen reader needs. Size it with a class (`size-12`, `h-24 w-auto`): it scales without blur.
 */
export function PixelSprite({
  sprite,
  className = '',
  label,
}: {
  sprite: Sprite;
  className?: string;
  label?: string;
}) {
  const width = sprite.rows[0]?.length ?? 0;
  const height = sprite.rows.length;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`pixelated shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {spriteRuns(sprite).map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          x={r.x}
          y={r.y}
          width={r.width}
          height={1}
          fill={`var(--color-${r.token})`}
        />
      ))}
    </svg>
  );
}
