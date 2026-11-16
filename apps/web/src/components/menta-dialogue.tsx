import { useEffect, useId, useReducer, useState } from 'react';
import { dialogueReducer, INITIAL_DIALOGUE, nextDelay } from '../lib/dialogue.ts';
import { LANDING_COPY as copy, DIALOGUE_LINES } from './landing-copy.ts';
import { MascotAnimated } from './mascot-animated.tsx';
import { Pictogram } from './pictogram.tsx';
import { buttonSecondary, textLink } from './ui-classes.ts';

export function MentaDialogue() {
  const [state, dispatch] = useReducer(
    (state: typeof INITIAL_DIALOGUE, action: Parameters<typeof dialogueReducer>[1]) =>
      dialogueReducer(state, action, DIALOGUE_LINES),
    INITIAL_DIALOGUE,
  );
  const [transcript, setTranscript] = useState(false);
  const [reduced, setReduced] = useState(false);
  const transcriptId = useId();
  const line = DIALOGUE_LINES[state.index] ?? DIALOGUE_LINES[0];
  const last = state.index === DIALOGUE_LINES.length - 1;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (state.mode === 'done') return;
    if (reduced || transcript || document.hidden) {
      dispatch({ type: 'complete' });
      return;
    }
    const timer = window.setTimeout(() => dispatch({ type: 'tick' }), nextDelay(line, state.shown));
    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        dispatch({ type: 'complete' });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state.mode, state.shown, line, reduced, transcript]);

  return (
    <section
      aria-label={copy.dialogueLabel}
      className="min-w-0 md:col-span-6 md:col-start-7 md:row-span-4 md:row-start-1"
    >
      <div className="flex items-end gap-3 md:flex-col md:gap-4">
        <MascotAnimated
          speaking={state.mode === 'typing'}
          className="h-33 w-24 md:order-2 md:h-55 md:w-40 md:self-end"
        />
        <figure className="relative min-w-0 flex-1 rounded-card bg-bg p-3 text-sm text-ink shadow-sheet before:absolute before:bottom-24 before:-left-1.5 before:size-3 before:rotate-45 before:bg-bg md:w-full md:flex-none md:p-4 md:text-base md:before:-bottom-1.5 md:before:left-auto md:before:right-20">
          <div id={transcriptId}>
            {transcript ? (
              <>
                <p className="mb-4">{copy.intro}</p>
                <ol className="list-decimal space-y-3 pl-5">
                  {DIALOGUE_LINES.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ol>
              </>
            ) : (
              <div className="grid">
                {DIALOGUE_LINES.map((text) => (
                  <p key={text} aria-hidden="true" className="invisible col-start-1 row-start-1">
                    {text}
                  </p>
                ))}
                <p
                  data-testid="dialogue-text"
                  aria-hidden="true"
                  className="relative col-start-1 row-start-1"
                >
                  {line.slice(0, state.shown)}
                </p>
              </div>
            )}
          </div>
          <figcaption className="relative mt-2 font-pixel text-xs text-primary">
            {copy.signature}
          </figcaption>
          {transcript ? null : (
            // Mouse/touch shortcut over the bubble; keyboard and screen readers use "Siguiente".
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => dispatch({ type: 'next' })}
              className="absolute inset-0 cursor-pointer rounded-card"
            />
          )}
        </figure>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {line}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className={buttonSecondary}
          onClick={() => dispatch({ type: last && state.mode === 'done' ? 'restart' : 'next' })}
        >
          {last && state.mode === 'done' ? copy.restart : copy.next}
          <Pictogram name="arrow" className="size-4" />
        </button>
        {!last && (
          <button
            type="button"
            className={`min-h-11 ${textLink}`}
            onClick={() => dispatch({ type: 'skip' })}
          >
            {copy.skip}
          </button>
        )}
        <span aria-hidden="true" className="font-mono text-xs">
          {state.index + 1} de {DIALOGUE_LINES.length}
        </span>
        <button
          type="button"
          className={`min-h-11 text-sm ${textLink}`}
          aria-expanded={transcript}
          aria-controls={transcriptId}
          onClick={() => setTranscript((value) => !value)}
        >
          {transcript ? copy.back : copy.transcript}
        </button>
      </div>
    </section>
  );
}
