import { bogotaDate } from '@bata/shared/gamification';
import { z } from 'zod';
import type { Profile } from './api.ts';
import { citation, LESSONS_FILE } from './lessons.ts';

export type MentaMessage =
  | { kind: 'streak'; text: string }
  | { kind: 'fact'; id: string; text: string; source: string; shortSource: string }
  | { kind: 'motivation'; text: string };
export type FactMessage = Extract<MentaMessage, { kind: 'fact' }>;

export const MotivationEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('level'), level: z.number().int().min(1) }),
  z.object({ type: z.literal('mission'), title: z.string().min(1) }),
]);
export type MotivationEvent = z.infer<typeof MotivationEventSchema>;

export function streakMessage(profile: Profile, now: Date): MentaMessage {
  if (profile.lastActiveDate === bogotaDate(now)) {
    return { kind: 'streak', text: 'Tu racha está a salvo hoy.' };
  }
  const n = profile.streakDays;
  return {
    kind: 'streak',
    text:
      n > 0
        ? `Aún no salvas tu racha: aprueba una misión hoy para mantener tus ${n} ${n === 1 ? 'día' : 'días'}.`
        : 'Aprueba una misión hoy y empieza tu racha.',
  };
}

/** Keep only a verbatim short point or its first complete sentence. */
export function compactFact(text: string): string | null {
  if (text.length <= 140) return text;
  const end = text.indexOf('. ');
  if (end === -1) return null;
  const sentence = text.slice(0, end + 1);
  return sentence.length >= 40 && sentence.length <= 140 ? sentence : null;
}

export const MENTA_FACTS: readonly FactMessage[] = LESSONS_FILE.lessons.flatMap((lesson) =>
  lesson.keyPoints.flatMap((point, index): FactMessage[] => {
    const sources = point.sourceIds.map((id) => LESSONS_FILE.sources[id]);
    const text = compactFact(point.text);
    if (!text || sources.length === 0 || sources.some((ref) => !ref)) return [];
    return [
      {
        kind: 'fact',
        id: `${lesson.missionId}-${index}`,
        text,
        shortSource: sources
          .flatMap((ref) => (ref ? [`${ref.org} (${ref.year})`] : []))
          .join(' · '),
        source: sources.flatMap((ref) => (ref ? [citation(ref)] : [])).join(' · '),
      },
    ];
  }),
);

export function motivationMessage(event: MotivationEvent): MentaMessage {
  return {
    kind: 'motivation',
    text:
      event.type === 'level'
        ? `¡Nivel ${event.level}! Vas muy bien.`
        : `¡Aprobaste «${event.title}»!`,
  };
}

export const MENTA_INTERVAL_MS = 5 * 60 * 1000;
export type MentaState = { lastShownAt: number | null; greeted: boolean; seenFacts: string[] };
export type MentaInput = {
  now: number;
  muted: boolean;
  visible: boolean;
  mainScreen: boolean;
  profile: Profile | null;
  pending: MotivationEvent[];
};

/** Returns the remaining FIFO queue separately so neither input nor state is mutated. */
export function pickMessage(
  state: MentaState,
  input: MentaInput,
): {
  message: MentaMessage | null;
  state: MentaState;
  pending: MotivationEvent[];
} {
  const idle = { message: null, state, pending: input.pending };
  if (input.muted || !input.visible || !input.mainScreen) return idle;
  const event = input.pending[0];
  if (event) {
    return {
      message: motivationMessage(event),
      state: { ...state, lastShownAt: input.now },
      pending: input.pending.slice(1),
    };
  }
  if (!state.greeted && input.profile) {
    return {
      message: streakMessage(input.profile, new Date(input.now)),
      state: { ...state, greeted: true, lastShownAt: input.now },
      pending: input.pending,
    };
  }
  if (
    state.greeted &&
    state.lastShownAt !== null &&
    input.now - state.lastShownAt < MENTA_INTERVAL_MS
  ) {
    return idle;
  }
  const lastFact = state.seenFacts.at(-1);
  let seenFacts = state.seenFacts;
  let fact = MENTA_FACTS.find((item) => !seenFacts.includes(item.id) && item.id !== lastFact);
  if (!fact) {
    seenFacts = [];
    fact = MENTA_FACTS.find((item) => item.id !== lastFact);
  }
  // An empty (or exhausted singleton) catalogue cannot produce a non-repeating fact.
  if (!fact) return idle;
  return {
    message: fact,
    state: { lastShownAt: input.now, greeted: true, seenFacts: [...seenFacts, fact.id] },
    pending: input.pending,
  };
}
