import { lazy, Suspense } from 'react';
import { chapterForDonning } from '../ar/step-chapter.ts';
import { ArHoverButton } from './ar-hover-button.tsx';

// three.js + R3F only load when a player actually needs the 3D thumbnail (15 s without advancing).
const ArStepPreview = lazy(() =>
  import('./ar-step-preview.tsx').then((m) => ({ default: m.ArStepPreview })),
);

export type AssistLevel = 0 | 1 | 2 | 3;

/**
 * Progressive help for a stuck step: 8 s → which joint to fix, 15 s → the step in 3D,
 * 25 s → a touch-free "Saltar paso" (hold a hand over it for 1 s; the step earns no XP).
 */
export function ArAssist({
  level,
  hint,
  step,
  reducedMotion,
  onSkip,
}: {
  level: AssistLevel;
  hint: string | null;
  step: { id: string; title: string; donningIds?: readonly string[] } | null;
  reducedMotion: boolean;
  /** Receives the id of the step the button was shown for. */
  onSkip: (stepId: string) => void;
}) {
  if (level === 0 || !step) return null;
  const chapter = chapterForDonning(step.donningIds?.[0]);
  return (
    <div
      data-testid="ar-assist"
      className="pointer-events-none flex flex-col items-end gap-2"
      aria-live="polite"
    >
      {hint ? (
        <p
          data-testid="ar-assist-hint"
          className="max-w-56 rounded-card bg-xp-soft px-3 py-2 text-sm font-bold text-ink shadow-float"
        >
          {hint}
        </p>
      ) : null}
      {level >= 2 && chapter !== null ? (
        <Suspense fallback={null}>
          <ArStepPreview chapter={chapter} title={step.title} reducedMotion={reducedMotion} />
        </Suspense>
      ) : null}
      {level >= 3 ? (
        <div className="pointer-events-auto">
          <ArHoverButton
            id="saltar"
            size="sm"
            tone="quiet"
            label="Saltar paso"
            onActivate={() => onSkip(step.id)}
          />
        </div>
      ) : null}
    </div>
  );
}
