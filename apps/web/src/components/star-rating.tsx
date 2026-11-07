import { STAR } from '../art/sprites.ts';
import { PixelSprite } from './pixel-sprite.tsx';

const MAX_STARS = 3;

/**
 * The three stars of a mission: earned ones in gold, the rest dimmed. It always carries a text
 * label, so the score never depends on colour alone.
 */
export function StarRating({
  stars,
  className = '',
  size = 'size-5',
}: {
  stars: number;
  className?: string;
  size?: string;
}) {
  const earned = Math.max(0, Math.min(MAX_STARS, Math.round(stars)));
  return (
    <span
      role="img"
      aria-label={`${earned} de ${MAX_STARS} estrellas`}
      className={`inline-flex items-center gap-0.5 ${className}`}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <PixelSprite
          // biome-ignore lint/suspicious/noArrayIndexKey: three fixed, order-stable stars
          key={i}
          sprite={STAR}
          className={`${size} ${i < earned ? '' : 'opacity-20'}`}
        />
      ))}
    </span>
  );
}
