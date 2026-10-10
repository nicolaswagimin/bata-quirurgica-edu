// Assistant avatar + panel. Mounted by components/assistant-slot.tsx only when signed in.
// The only assistant module that touches Firebase: it injects the ID token and base URL into streamChat.
import {
  type ChatMessage,
  ChatMessageSchema,
  type Citation,
  type ErrorCode,
  messageForStatus,
} from '@bata/shared/schemas';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, apiFetch } from '../lib/api.ts';
import { auth, env } from '../lib/firebase.tsx';
import { StreamHttpError, streamChat } from './stream.ts';
import { blobToBase64, type RecordingHandle, recordUpTo30s, speak } from './voice.ts';

const MAX_SENT_MESSAGES = 10;

const primaryButtonClass =
  'min-h-11 rounded-pill bg-primary px-4 font-semibold text-bg hover:bg-primary-strong disabled:opacity-60';
const secondaryButtonClass =
  'min-h-11 rounded-pill border border-border bg-bg px-4 font-medium text-ink hover:bg-primary-soft disabled:opacity-60';

type FormValues = { question: string };

function streamErrorMessage(code: ErrorCode): string {
  if (code === 'QUOTA_EXCEEDED') return messageForStatus(429);
  if (code === 'UNAUTHORIZED') return messageForStatus(401);
  return messageForStatus(500);
}

async function openChat(
  messages: ChatMessage[],
  signal: AbortSignal,
  onEvent: Parameters<typeof streamChat>[1],
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new StreamHttpError(401);
  const run = async (forceRefresh: boolean) =>
    streamChat(
      {
        baseUrl: env.VITE_API_BASE_URL,
        idToken: await user.getIdToken(forceRefresh),
        messages,
        signal,
      },
      onEvent,
    );
  try {
    await run(false);
  } catch (err) {
    // The token may have just expired: refresh it and retry once.
    if (err instanceof StreamHttpError && err.status === 401) await run(true);
    else throw err;
  }
}

function AvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke="currentColor" strokeWidth="2" />
      <path d="M8 6.5h8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default function AssistantPanel() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recordingRef = useRef<RecordingHandle | null>(null);
  const recordingEndedAt = useRef<number | null>(null);
  const nextQuestionId = useRef(0);
  const [asked, setAsked] = useState<{ id: number; text: string }[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setErrorText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakAloud, setSpeakAloud] = useState(false);
  const { register, handleSubmit, setError, setValue, reset, formState } = useForm<FormValues>({
    defaultValues: { question: '' },
  });

  async function onSubmit(values: FormValues) {
    const parsed = ChatMessageSchema.shape.content.safeParse(values.question.trim());
    if (!parsed.success) {
      setError('question', { message: 'Escribe una pregunta de 1 a 2000 caracteres' });
      return;
    }
    const startedAt = recordingEndedAt.current ?? performance.now();
    recordingEndedAt.current = null;
    const sent: ChatMessage[] = [...history, { role: 'user' as const, content: parsed.data }].slice(
      -MAX_SENT_MESSAGES,
    );
    setHistory(sent);
    setAsked((prev) => [...prev, { id: nextQuestionId.current++, text: parsed.data }]);
    setAnswer('');
    setCitations([]);
    setErrorText(null);
    setBusy(true);
    reset();
    abortRef.current = new AbortController();
    let text = '';
    let firstToken = true;
    let failed = false;
    try {
      await openChat(sent, abortRef.current.signal, (event) => {
        if (event.type === 'delta') {
          text += event.text;
          setAnswer(text);
          if (firstToken) {
            firstToken = false;
            requestAnimationFrame(() => {
              window.dispatchEvent(
                new CustomEvent('bata:assistant-first-token', {
                  detail: { elapsedMs: Math.round(performance.now() - startedAt) },
                }),
              );
            });
          }
        } else if (event.type === 'citations') {
          setCitations(event.items);
        } else if (event.type === 'error') {
          failed = true;
          setErrorText(streamErrorMessage(event.code));
        }
      });
    } catch (err) {
      failed = true;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setErrorText(err instanceof StreamHttpError ? err.message : messageForStatus(500));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
    if (text) {
      setHistory((prev) => [...prev, { role: 'assistant' as const, content: text.slice(0, 2000) }]);
      if (speakAloud && !failed) void speak(text);
    }
  }

  async function toggleRecording() {
    if (recordingRef.current) {
      recordingRef.current.stop();
      return;
    }
    setErrorText(null);
    try {
      const handle = await recordUpTo30s();
      recordingRef.current = handle;
      setRecording(true);
      const { blob, mimeType } = await handle.result;
      recordingEndedAt.current = performance.now();
      setRecording(false);
      recordingRef.current = null;
      setTranscribing(true);
      const { text } = await apiFetch<{ text: string }>('/assistant/transcribe', {
        method: 'POST',
        body: { mimeType, audioBase64: await blobToBase64(blob) },
      });
      setValue('question', text, { shouldValidate: false });
    } catch (err) {
      setErrorText(
        err instanceof ApiError
          ? err.message
          : 'No pudimos usar el micrófono. Escribe tu pregunta.',
      );
    } finally {
      recordingRef.current = null;
      setRecording(false);
      setTranscribing(false);
    }
  }

  function onClose() {
    abortRef.current?.abort();
    recordingRef.current?.stop();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  const questionError = formState.errors.question?.message;
  const pastQuestions = asked.slice(0, -1);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir asistente"
        onClick={() => dialogRef.current?.showModal()}
        className="fixed top-3 left-3 z-50 flex size-11 items-center justify-center rounded-pill border-2 border-bg bg-primary text-bg hover:bg-primary-strong"
      >
        <AvatarIcon />
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="asistente-titulo"
        onClose={onClose}
        className="mt-16 ml-3 max-h-[calc(100dvh-5rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto rounded-card border border-border bg-bg p-4 text-ink backdrop:bg-ink/40"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="asistente-titulo" className="text-lg font-semibold">
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

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-3 flex flex-col gap-2">
          <label htmlFor="asistente-pregunta" className="text-sm font-medium">
            Tu pregunta
          </label>
          <textarea
            id="asistente-pregunta"
            rows={3}
            maxLength={2000}
            aria-invalid={questionError ? 'true' : undefined}
            aria-describedby={questionError ? 'asistente-pregunta-error' : undefined}
            className="rounded-[8px] border border-border p-2"
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
