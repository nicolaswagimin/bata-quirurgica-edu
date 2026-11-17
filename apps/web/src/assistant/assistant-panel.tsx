// Existing assistant panel; chat state and actions live in useAssistantChat.
import { useRef } from 'react';
import { Pictogram } from '../components/pictogram.tsx';
import {
  buttonPrimary as primaryButtonClass,
  buttonSecondary as secondaryButtonClass,
} from '../components/ui-classes.ts';
import { useAssistantChat } from './use-assistant-chat.ts';

export default function AssistantPanel() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const {
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

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="pressable fixed top-3 left-3 z-50 inline-flex min-h-11 items-center gap-2 rounded-pill bg-bg py-1.5 pr-4 pl-1.5 text-sm font-extrabold text-primary focus-dual shadow-float hover:bg-primary-soft"
      >
        <span className="grid size-8 place-items-center rounded-pill bg-primary text-bg">
          <Pictogram name="ask" className="size-[18px]" />
        </span>
        Pregúntale<span className="sr-only">, abrir asistente</span>
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="asistente-titulo"
        onClose={close}
        className="mt-16 ml-3 max-h-[calc(100dvh-5rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto rounded-card bg-bg p-4 text-ink shadow-float backdrop:bg-ink/40"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="asistente-titulo" className="text-lg font-extrabold">
            Asistente de bioseguridad
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={secondaryButtonClass}
          >
            Cerrar
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          Responde con base en normativas citadas. No reemplaza el criterio de tu docente.
        </p>

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

        <div aria-live="polite" className="mt-3 rounded-card bg-surface p-3 whitespace-pre-wrap">
          {answer || (busy ? 'Pensando…' : '')}
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
        <p role="alert" className="mt-2 text-sm text-danger empty:hidden">
          {error ?? ''}
        </p>

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
            <button type="submit" disabled={busy || recording} className={primaryButtonClass}>
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
      </dialog>
    </>
  );
}
