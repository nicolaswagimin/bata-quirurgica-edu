import { type MotivationEvent, MotivationEventSchema } from './menta-messages.ts';

const PENDING_KEY = 'bata.menta.pending';
const MUTED_KEY = 'bata.menta.muted';
const MAX_PENDING = 20;

function readPending(uid: string): MotivationEvent[] {
  const key = `${PENDING_KEY}.${uid}`;
  const raw = sessionStorage.getItem(key);
  try {
    const parsed = MotivationEventSchema.array().safeParse(JSON.parse(raw ?? '[]'));
    if (parsed.success) return parsed.data.slice(-MAX_PENDING);
  } catch {
    // Malformed JSON is an empty queue, not a permanently blocked queue.
  }
  sessionStorage.removeItem(key);
  return [];
}

export function queueMentaEvent(uid: string, event: MotivationEvent): void {
  try {
    const parsed = MotivationEventSchema.safeParse(event);
    if (!parsed.success) return;
    const pending = [...readPending(uid), parsed.data].slice(-MAX_PENDING);
    sessionStorage.setItem(`${PENDING_KEY}.${uid}`, JSON.stringify(pending));
    window.dispatchEvent(new Event('menta:event'));
  } catch {
    // Storage can be unavailable.
  }
}

export function takeMentaEvents(uid: string): MotivationEvent[] {
  try {
    const pending = readPending(uid);
    sessionStorage.removeItem(`${PENDING_KEY}.${uid}`);
    return pending;
  } catch {
    return [];
  }
}

export function isMentaMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setMentaMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, String(muted));
    window.dispatchEvent(new Event('menta:muted'));
  } catch {
    // Preferences are optional when storage is unavailable.
  }
}
