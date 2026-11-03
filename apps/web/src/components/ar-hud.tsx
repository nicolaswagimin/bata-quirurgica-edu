import type { BataPasos } from '@bata/shared/schemas';
import { VIOLATION_SHORT, VIOLATION_TEXT, type Violation } from '../ar/posture.ts';
import type { PracticeView } from '../ar/practice.ts';
import { Pictogram } from './pictogram.tsx';

type Step = BataPasos['donning'][number];

/** Big instruction at the top of the camera image, readable at ~2 m. */
export function ArInstruction({ text, sub }: { text: string; sub?: string | null }) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2 px-4 text-center">
      <p
        aria-live="polite"
        data-testid="ar-instruction"
        className="max-w-[24ch] rounded-card bg-ink/70 px-4 py-2.5 text-xl leading-tight font-extrabold text-balance text-bg shadow-float backdrop-blur-sm md:max-w-[34ch] md:px-5 md:py-3 md:text-[32px] landscape:max-w-[40ch]"
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
export function ArStepProgress({ steps, view }: { steps: readonly Step[]; view: PracticeView }) {
  return (
    <ol
      aria-label="Pasos de la colocación"
      className="pointer-events-none flex items-center gap-1.5 rounded-pill bg-ink/60 px-3 py-2 backdrop-blur-sm"
    >
      {steps.map((step, i) => {
        const done = view.completedIds.includes(step.id);
        const current = i === view.stepIndex && !view.done;
        return (
          <li
            key={step.id}
            aria-current={current ? 'step' : undefined}
            className={`relative grid size-8 place-items-center overflow-hidden rounded-pill font-mono text-sm font-bold md:size-11 ${
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
    <div aria-live="assertive" data-testid="ar-alerts" className="pointer-events-none px-4">
      {violations.length > 0 ? (
        <ul className="mx-auto flex max-w-xl flex-col items-center gap-1 rounded-pill bg-danger px-6 py-3 text-center text-xl leading-snug font-extrabold text-bg shadow-float md:text-[28px]">
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
