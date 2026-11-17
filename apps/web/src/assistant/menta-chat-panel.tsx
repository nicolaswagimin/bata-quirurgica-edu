import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MascotAnimated } from '../components/mascot-animated.tsx';
import { Pictogram } from '../components/pictogram.tsx';
import {
  buttonPrimary as primaryButtonClass,
  buttonSecondary as secondaryButtonClass,
} from '../components/ui-classes.ts';
import { canSendQuestion, useAssistantChat } from './use-assistant-chat.ts';

export default function MentaChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const {
    speaking,
    asked,
    answer,
    citations,
    error,
    busy,
    recording,
    transcribing,
    speakAloud,
    ask,
    toggleRecording,
    setSpeakAloud,
    close,
    register,
    handleSubmit,
    formState,
  } = useAssistantChat();
  const questionError = formState.errors.question?.message;
  const pastQuestions = asked.slice(0, -1);

  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const finishClose = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const dialog = dialogRef.current;
    if (!dialog?.open) return;
    // Synchronize the owner before close() restores focus. The native close event is queued
    // and may arrive after another activation, so it must not own this state transition.
    onCloseRef.current();
    dialog.close();
  };

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      closingRef.current = false;
      setClosing(false);
      if (!dialog?.open) dialog?.showModal();
    } else {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (dialog?.open) {
        closeRef.current();
        dialog.close();
      }
    }
  }, [open]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const requestClose = () => {
    if (closingRef.current || !dialogRef.current?.open) return;
    closingRef.current = true;
    close();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishClose();
      return;
    }
    setClosing(true);
    // Transitionend normally finishes first; this bounds the delay if it is interrupted.
    timer.current = setTimeout(finishClose, 200);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="asistente-titulo"
      data-closing={closing}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onTransitionEnd={(event) => {
        if (
          closingRef.current &&
          event.target === event.currentTarget &&
          event.propertyName === 'opacity'
        )
          finishClose();
      }}
      onClose={() => {
        // Ignore queued events from a previous close after the dialog has reopened.
        if (!dialogRef.current?.open) {
          close();
          onCloseRef.current();
        }
      }}
      className="menta-dialog fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-visible rounded-t-card bg-bg p-0 text-ink shadow-sheet md:inset-x-auto md:right-6 md:bottom-6 md:max-h-[80dvh] md:w-[28rem] md:rounded-card"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:max-h-[80dvh]">
        <div className="flex items-center gap-3">
          <MascotAnimated
            speaking={speaking}
            className="h-[88px] w-16 md:absolute md:bottom-4 md:-left-20 md:h-[132px] md:w-24"
          />
          <div className="min-w-0 flex-1">
            <h2 id="asistente-titulo" className="text-xl font-extrabold">
              Dra. Menta
            </h2>
            <p className="text-sm text-muted">
              Asistente virtual · responde con las guías cargadas
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar"
            className="pressable flex size-11 shrink-0 items-center justify-center rounded-pill text-primary hover:bg-primary-soft"
          >
            <Pictogram name="close" className="size-6" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">No reemplaza el criterio de tu docente.</p>

        {pastQuestions.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Preguntas anteriores</summary>
            <ul className="mt-1 list-disc pl-5">
              {pastQuestions.map((q) => (
                <li key={q.id}>{q.text}</li>
              ))}
            </ul>
          </details>
        )}

        <div aria-live="polite">
          {(answer || error || busy) && (
            <div className="mt-3 rounded-card bg-surface p-3 whitespace-pre-wrap">
              {answer || (busy ? 'Pensando…' : '')}
              <p role="alert" className="mt-2 text-sm text-danger empty:hidden">
                {error ?? ''}
              </p>
            </div>
          )}
        </div>
        {citations.length > 0 && (
          <ol aria-label="Fuentes" className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {citations.map((c) => (
              <li key={c.n}>
                [{c.n}] {c.org} — {c.title}, {c.section}
              </li>
            ))}
          </ol>
        )}

        <form onSubmit={handleSubmit(ask)} noValidate className="mt-3 flex flex-col gap-2">
          <label htmlFor="asistente-pregunta" className="text-sm font-medium">
            Tu pregunta
          </label>
          <textarea
            id="asistente-pregunta"
            rows={3}
            maxLength={2000}
            aria-invalid={questionError ? 'true' : undefined}
            aria-describedby={questionError ? 'asistente-pregunta-error' : undefined}
            className="rounded-card border border-muted p-2"
            {...register('question')}
          />
          {questionError && (
            <p id="asistente-pregunta-error" className="text-sm text-danger">
              {questionError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!canSendQuestion(busy, recording, transcribing)}
              className={primaryButtonClass}
            >
              Enviar
            </button>
            <button
              type="button"
              onClick={() => void toggleRecording()}
              disabled={busy || transcribing}
              aria-pressed={recording}
              className={secondaryButtonClass}
            >
              {recording ? 'Detener grabación' : transcribing ? 'Transcribiendo…' : 'Grabar voz'}
            </button>
            <label className="ml-auto flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                role="switch"
                aria-checked={speakAloud}
                checked={speakAloud}
                onChange={(e) => setSpeakAloud(e.target.checked)}
                className="size-5 accent-primary"
              />
              Leer en voz alta
            </label>
          </div>
        </form>
      </div>
    </dialog>
  );
}
