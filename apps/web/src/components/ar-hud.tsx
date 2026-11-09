import type { GameView } from '../ar/game-steps.ts';
import { VIOLATION_SHORT, VIOLATION_TEXT, type Violation } from '../ar/posture.ts';
import { Pictogram } from './pictogram.tsx';

/** Big instruction at the top of the camera image, readable at ~2 m. */
export function ArInstruction({ text, sub }: { text: string; sub?: string | null }) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2 px-4 text-center landscape:items-start landscape:px-0">
      <p
        aria-live="polite"
        data-testid="ar-instruction"
        className="max-w-[24ch] rounded-card bg-ink/70 px-4 py-2.5 text-xl leading-tight font-extrabold text-balance text-bg shadow-float backdrop-blur-sm portrait:md:max-w-[34ch] portrait:md:px-5 portrait:md:py-3 portrait:md:text-[32px] landscape:max-w-none landscape:text-left landscape:text-lg landscape:lg:text-[28px]"
      >
        {text}
      </p>
      {sub ? (
        <p className="rounded-pill bg-ink/60 px-4 py-1.5 text-sm font-bold text-bg backdrop-blur-sm md:text-base">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** Six numbered stamps: done ones inked, the current one ringed, with the hold filling under it. */
/** Minimal step shape shared by the v1 game steps and the v2 practice steps. */
export type HudStep = { id: string; order: number; title: string };

export function ArStepProgress({
  steps,
  view,
  vertical = false,
}: {
  steps: readonly HudStep[];
  view: GameView;
  vertical?: boolean;
}) {
  return (
    <ol
      aria-label="Pasos de la colocación"
      className={`pointer-events-none flex items-center gap-1.5 rounded-pill bg-ink/60 backdrop-blur-sm ${vertical ? 'flex-col gap-1 px-1.5 py-2' : 'px-3 py-2'}`}
    >
      {steps.map((step, i) => {
        const done = view.completedIds.includes(step.id);
        const current = i === view.stepIndex && !view.done;
        return (
          <li
            key={step.id}
            aria-current={current ? 'step' : undefined}
            className={`relative grid size-8 place-items-center overflow-hidden rounded-pill font-mono text-sm font-bold ${vertical ? '' : 'md:size-11'} ${
              done
                ? 'bg-bg text-primary'
                : current
                  ? 'bg-primary text-bg ring-3 ring-bg'
                  : 'bg-bg/15 text-bg'
            }`}
          >
            <span className="sr-only">
              {step.title}
              {done ? ' (hecho)' : current ? ' (en curso)' : ''}
            </span>
            {done ? <Pictogram name="check" className="size-5" strokeWidth={3} /> : step.order}
            {current ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-1 origin-left bg-bg"
                style={{ transform: `scaleX(${view.hold})` }}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Live sterile-technique warnings, over the video. Assertive so each new one is announced. */
export function ArWarnings({ violations }: { violations: readonly Violation[] }) {
  return (
    <div
      aria-live="assertive"
      data-testid="ar-alerts"
      className="pointer-events-none px-4 landscape:px-0"
    >
      {violations.length > 0 ? (
        <ul className="mx-auto flex max-w-xl flex-col items-center gap-1 rounded-pill bg-danger px-6 py-3 text-center text-xl leading-snug font-extrabold text-bg shadow-float portrait:md:text-[28px] landscape:mx-0 landscape:rounded-card landscape:text-lg landscape:lg:text-2xl">
          {violations.map((v) => (
            <li key={v}>
              <span aria-hidden="true">{VIOLATION_SHORT[v]}</span>
              <span className="sr-only">{VIOLATION_TEXT[v]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sr-only">Sin avisos: tus manos están en zona estéril.</p>
      )}
    </div>
  );
}

/** Giant 3-2-1 in the middle of the image. */
export function ArCountdown({ seconds }: { seconds: number }) {
  return (
    <p
      role="timer"
      aria-live="assertive"
      className="pointer-events-none grid size-44 place-items-center rounded-pill bg-primary/85 font-mono text-[120px] leading-none font-bold text-bg shadow-float"
    >
      {seconds}
    </p>
  );
}
