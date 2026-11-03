import { FLAME } from '../art/sprites.ts';
import { PixelSprite } from './pixel-sprite.tsx';

/** Decorative pixel streak flame; always rendered next to the streak number in text. */
export function FlameIcon({ className = 'h-5 w-auto' }: { className?: string }) {
  return <PixelSprite sprite={FLAME} className={className} />;
}
