import type { ReactNode } from 'react';
import { MASCOT, SPARKLE } from '../art/sprites.ts';
import { PixelSprite } from './pixel-sprite.tsx';

export const MASCOT_NAME = 'Dra. Menta';

/**
 * Dra. Menta, the pixel scrub nurse. `cheer` adds sparkles for celebrations; she keeps the sterile
 * posture in every mood.
 */
export function Mascot({
  mood = 'idle',
  className = 'h-22 w-auto',
}: {
  mood?: 'idle' | 'cheer';
  className?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <PixelSprite sprite={MASCOT} className={className} />
      {mood === 'cheer' ? (
        <>
          <PixelSprite sprite={SPARKLE} className="absolute -top-2 -left-3 size-4" />
          <PixelSprite sprite={SPARKLE} className="absolute top-3 -right-4 size-3" />
        </>
      ) : null}
    </span>
  );
}

const BUBBLE = {
  // On the mint band: a white bubble lifted off the colour.
  band: 'bg-bg shadow-sheet before:bg-bg',
  // On a white panel: a flat mint wash, so it never becomes a card inside a card.
  panel: 'bg-primary-soft before:bg-primary-soft',
} as const;

/** A short line of encouragement signed by the mascot, in a speech bubble beside her. */
export function MascotNote({
  children,
  mood = 'idle',
  on = 'band',
  className = '',
}: {
  children: ReactNode;
  mood?: 'idle' | 'cheer';
  on?: keyof typeof BUBBLE;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <Mascot mood={mood} className="h-16 w-auto" />
      <figure
        className={`relative mb-2 max-w-[40ch] rounded-card px-3 py-2 text-sm text-ink before:absolute before:bottom-3 before:-left-1.5 before:size-3 before:rotate-45 ${BUBBLE[on]}`}
      >
        <blockquote className="relative">
          <p>{children}</p>
        </blockquote>
        <figcaption className="relative mt-1 font-pixel text-xs text-primary">
          — {MASCOT_NAME}
        </figcaption>
      </figure>
    </div>
  );
}
