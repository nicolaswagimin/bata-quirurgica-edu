import type { MistakeArt } from '../art/mistake-art.ts';
import { Pictogram } from './pictogram.tsx';
import { PixelSprite } from './pixel-sprite.tsx';

/** Comparison shared by lessons and the illustration sheet. */
export function MistakePair({ pair }: { pair: MistakeArt }) {
  // Trim shared empty rows, keeping both panels aligned and every highlight visible.
  const scenes = [pair.wrong, pair.right];
  const top = Math.min(
    ...scenes.map(({ sprite, highlight }) =>
      Math.min(
        sprite.rows.findIndex((row) => /[^.]/.test(row)),
        highlight.y,
      ),
    ),
  );
  const bottom = Math.max(
    ...scenes.map(({ sprite, highlight }) =>
      Math.max(sprite.rows.findLastIndex((row) => /[^.]/.test(row)) + 1, highlight.y + highlight.h),
    ),
  );
  return (
    <div className="grid grid-cols-2 gap-2" data-mistake-id={pair.id}>
      {(['wrong', 'right'] as const).map((side) => {
        const scene = pair[side];
        const correct = side === 'right';
        const label = correct ? 'Correcto' : 'Incorrecto';
        const height = bottom - top;
        const width = scene.sprite.rows[0]?.length ?? 32;
        const { x, y, w, h } = scene.highlight;
        return (
          <figure key={side} className="m-0 min-w-0">
            <div className="tile-grid rounded-card flex justify-center">
              <div
                className="relative w-32 shrink-0 md:w-48"
                style={{ aspectRatio: `${width} / ${height}` }}
              >
                <PixelSprite
                  sprite={{ rows: scene.sprite.rows.slice(top, bottom) }}
                  className="block h-full w-full"
                  label={`${label}: ${scene.caption}`}
                />
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    boxSizing: 'border-box',
                    left: `${(x / width) * 100}%`,
                    top: `${((y - top) / height) * 100}%`,
                    width: `${(w / width) * 100}%`,
                    height: `${(h / height) * 100}%`,
                    border: `2px dashed var(--color-${correct ? 'success' : 'danger'})`,
                    borderRadius: 4,
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>
            <figcaption className="mt-2 text-sm">
              <span
                className={`flex items-center gap-1 font-bold ${correct ? 'text-success' : 'text-danger'}`}
              >
                <Pictogram name={correct ? 'check' : 'close'} className="size-5" />
                {label}
              </span>
              <p className="mt-1">{scene.caption}</p>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
