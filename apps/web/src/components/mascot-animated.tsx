import { memo } from 'react';
import { MASCOT } from '../art/sprites.ts';
import { spriteRuns } from './pixel-sprite.tsx';

const runs = spriteRuns(MASCOT);
const talk = spriteRuns({ rows: ['..kqqqqqqqqqqk..', '..kqQqqqqqqQqk..'] });

export const MascotAnimated = memo(function MascotAnimated({
  speaking,
  className = '',
  label,
}: {
  speaking: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 22"
      className={`pixelated shrink-0 ${className}`}
      data-speaking={speaking}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <g className="menta-head">
        {runs
          .filter((r) => r.y < 9)
          .map((r) => (
            <rect
              key={`${r.x}-${r.y}`}
              x={r.x}
              y={r.y}
              width={r.width}
              height={1}
              fill={`var(--color-${r.token})`}
            />
          ))}
        <g className="menta-blink">
          <path d="M5 5h2v1H5zM9 5h2v1H9z" fill="var(--color-px-skin)" />
          <path d="M5 6h2v1H5zM9 6h2v1H9z" fill="var(--color-ink)" />
        </g>
        <g className="menta-talk">
          {talk.map((r) => (
            <rect
              key={`${r.x}-${r.y}`}
              x={r.x}
              y={r.y + 7}
              width={r.width}
              height={1}
              fill={`var(--color-${r.token})`}
            />
          ))}
        </g>
      </g>
      {runs
        .filter((r) => r.y >= 9)
        .map((r) => (
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
});
