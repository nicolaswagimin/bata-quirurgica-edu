// Browser voice helpers: microphone recording (≤ 30 s) and Spanish speech synthesis.
// Audio leaves the browser only through POST /assistant/transcribe; nothing is stored.
import type { TranscribeRequest } from '@bata/shared/schemas';

export type RecorderMimeType = TranscribeRequest['mimeType'];

export const MAX_RECORDING_MS = 30_000;

export function pickRecorderMimeType(
  isTypeSupported: (type: string) => boolean = (type) => MediaRecorder.isTypeSupported(type),
): RecorderMimeType {
  return isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm' : 'audio/mp4';
}

export type Recording = { blob: Blob; mimeType: RecorderMimeType };

export type RecordingHandle = {
  // Resolves when the recording ends: on stop() or after 30 s.
  result: Promise<Recording>;
  stop: () => void;
};

export async function recordUpTo30s(): Promise<RecordingHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickRecorderMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType: mimeType === 'audio/webm' ? 'audio/webm;codecs=opus' : 'audio/mp4',
  });
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  });
  const result = new Promise<Recording>((resolve, reject) => {
    recorder.addEventListener('stop', () => {
      for (const track of stream.getTracks()) track.stop();
      resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType });
    });
    recorder.addEventListener('error', () => {
      for (const track of stream.getTracks()) track.stop();
      reject(new Error('No se pudo grabar el audio'));
    });
  });
  const stop = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };
  const timer = setTimeout(stop, MAX_RECORDING_MS);
  void result.finally(() => clearTimeout(timer)).catch(() => undefined);
  recorder.start();
  return { result, stop };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

type VoiceLike = Pick<SpeechSynthesisVoice, 'lang'>;

export function pickSpanishVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  return (
    voices.find((v) => v.lang.replace('_', '-').toLowerCase() === 'es-co') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('es')) ??
    null
  );
}

function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const voices = synth.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    // Some browsers never fire voiceschanged; fall back to the default voice.
    setTimeout(done, 1000);
  });
}

export async function speak(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const voice = pickSpanishVoice(await loadVoices(synth));
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? 'es-CO';
  if (voice) utterance.voice = voice;
  synth.cancel();
  synth.speak(utterance);
}
