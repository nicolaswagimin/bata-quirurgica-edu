import {
  type ChatMessage,
  ChatMessageSchema,
  type Citation,
  type ErrorCode,
  messageForStatus,
} from '@bata/shared/schemas';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { StreamHttpError, streamChat } from './stream.ts';
import { blobToBase64, type RecordingHandle, recordUpTo30s, speak } from './voice.ts';

const MAX_SENT_MESSAGES = 10;

type FormValues = { question: string };

export function streamErrorMessage(code: ErrorCode): string {
  if (code === 'QUOTA_EXCEEDED') return messageForStatus(429);
  if (code === 'UNAUTHORIZED') return messageForStatus(401);
  return messageForStatus(500);
}

async function openChat(
  messages: ChatMessage[],
  signal: AbortSignal,
  onEvent: Parameters<typeof streamChat>[1],
): Promise<void> {
  const { auth, env } = await import('../lib/firebase.tsx');
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

export function useAssistantChat() {
  const generation = useRef(0);
  const speechAbort = useRef<AbortController | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
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

  async function ask(values: FormValues) {
    const parsed = ChatMessageSchema.shape.content.safeParse(values.question.trim());
    if (!parsed.success) {
      setError('question', { message: 'Escribe una pregunta de 1 a 2000 caracteres' });
      return;
    }
    if (abortRef.current) return;
    const request = ++generation.current;
    speechAbort.current?.abort();
    setTtsSpeaking(false);
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
        if (request !== generation.current) return;
        if (event.type === 'delta') {
          setStreaming(true);
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
      if (request !== generation.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setErrorText(err instanceof StreamHttpError ? err.message : messageForStatus(500));
    } finally {
      if (request === generation.current) {
        setBusy(false);
        setStreaming(false);
        abortRef.current = null;
      }
    }
    if (request !== generation.current) return;
    if (text) {
      setHistory((prev) => [...prev, { role: 'assistant' as const, content: text.slice(0, 2000) }]);
      if (speakAloud && !failed) {
        speechAbort.current = new AbortController();
        void speak(text, {
          signal: speechAbort.current.signal,
          onStart: () => {
            if (request === generation.current) setTtsSpeaking(true);
          },
          onEnd: () => {
            if (request === generation.current) setTtsSpeaking(false);
          },
        });
      }
    }
  }

  async function toggleRecording() {
    const { ApiError, apiFetch } = await import('../lib/api.ts');
    if (recordingRef.current) {
      recordingRef.current.stop();
      return;
    }
    const request = generation.current;
    setErrorText(null);
    try {
      const handle = await recordUpTo30s();
      if (request !== generation.current) {
        handle.stop();
        return;
      }
      recordingRef.current = handle;
      setRecording(true);
      const { blob, mimeType } = await handle.result;
      if (request !== generation.current) return;
      recordingEndedAt.current = performance.now();
      setRecording(false);
      recordingRef.current = null;
      setTranscribing(true);
      const { text } = await apiFetch<{ text: string }>('/assistant/transcribe', {
        method: 'POST',
        body: { mimeType, audioBase64: await blobToBase64(blob) },
      });
      if (request !== generation.current) return;
      setValue('question', text, { shouldValidate: false });
    } catch (err) {
      if (request !== generation.current) return;
      setErrorText(
        err instanceof ApiError
          ? err.message
          : 'No pudimos usar el micrófono. Escribe tu pregunta.',
      );
    } finally {
      if (request === generation.current) {
        recordingRef.current = null;
        setRecording(false);
        setTranscribing(false);
      }
    }
  }

  function close() {
    generation.current++;
    speechAbort.current?.abort();
    abortRef.current?.abort();
    recordingRef.current?.stop();
    abortRef.current = null;
    recordingRef.current = null;
    recordingEndedAt.current = null;
    setBusy(false);
    setRecording(false);
    setTranscribing(false);
    setStreaming(false);
    setTtsSpeaking(false);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  useEffect(
    () => () => {
      generation.current++;
      speechAbort.current?.abort();
      abortRef.current?.abort();
      recordingRef.current?.stop();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    [],
  );

  return {
    asked,
    history,
    answer,
    citations,
    error,
    busy,
    recording,
    transcribing,
    speakAloud,
    speaking: streaming || ttsSpeaking,
    ask,
    toggleRecording,
    setSpeakAloud,
    close,
    register,
    handleSubmit,
    formState,
    reset: () => {
      close();
      reset();
      setAsked([]);
      setHistory([]);
      setAnswer('');
      setCitations([]);
      setErrorText(null);
    },
  };
}
