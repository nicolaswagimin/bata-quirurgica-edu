import { afterEach, describe, expect, it, vi } from 'vitest';
import lessons from '../../../../content/lecciones/lecciones.json';
import type { Profile } from '../../src/lib/api.ts';
import { citation, LESSONS_FILE } from '../../src/lib/lessons.ts';
import {
  isMentaMuted,
  queueMentaEvent,
  setMentaMuted,
  takeMentaEvents,
} from '../../src/lib/menta-events.ts';
import {
  MENTA_FACTS,
  MENTA_INTERVAL_MS,
  type MentaInput,
  type MentaState,
  motivationMessage,
  pickMessage,
  streakMessage,
} from '../../src/lib/menta-messages.ts';

const profile: Profile = {
  uid: 'test',
  displayName: 'Ana',
  role: 'student',
  groupId: null,
  xp: 0,
  level: 1,
  streakDays: 0,
  lastActiveDate: null,
};
const now = Date.parse('2026-11-16T05:00:00Z');
const initial: MentaState = { lastShownAt: null, greeted: false, seenFacts: [] };
const input: MentaInput = {
  now,
  muted: false,
  visible: true,
  mainScreen: true,
  profile,
  pending: [],
};

describe('Menta messages', () => {
  it('includes exactly the eligible verbatim key points and resolved citations', () => {
    const expected = lessons.lessons.flatMap((lesson) =>
      lesson.keyPoints.flatMap((point, index) => {
        const sources = point.sourceIds.map((id) => LESSONS_FILE.sources[id]);
        if (point.text.length > 220 || !sources.length || sources.some((source) => !source))
          return [];
        return [
          {
            kind: 'fact',
            id: `${lesson.missionId}-${index}`,
            text: point.text,
            source: sources.flatMap((source) => (source ? [citation(source)] : [])).join(' · '),
          },
        ];
      }),
    );
    expect(MENTA_FACTS).toEqual(expected);
    expect(MENTA_FACTS.length).toBeGreaterThan(1);
    for (const fact of MENTA_FACTS) {
      expect(fact.source.length).toBeGreaterThan(0);
      expect(fact.text.length).toBeLessThanOrEqual(220);
    }
  });

  it('switches from saved to unsaved at Bogotá midnight', () => {
    const active = { ...profile, streakDays: 2, lastActiveDate: '2026-11-15' };
    expect(streakMessage(active, new Date(now - 1))).toEqual({
      kind: 'streak',
      text: 'Tu racha está a salvo hoy, sigue cuando quieras.',
    });
    expect(streakMessage(active, new Date(now)).text).toBe(
      'Aún no salvas tu racha de hoy: aprueba una misión antes de la medianoche para mantener tus 2 días.',
    );
    expect(streakMessage({ ...active, streakDays: 1 }, new Date(now)).text).toContain('tus 1 día.');
    expect(streakMessage(profile, new Date(now)).text).toBe(
      'Aprueba una misión hoy y empiezas tu racha.',
    );
  });

  it.each([{ muted: true }, { visible: false }, { mainScreen: false }])(
    'blocks all messages for %o',
    (override) => {
      const pending = [{ type: 'level' as const, level: 2 }];
      const result = pickMessage(initial, { ...input, ...override, pending });
      expect(result.message).toBeNull();
      expect(result.state).toBe(initial);
      expect(result.pending).toBe(pending);
    },
  );

  it('greets with a streak, falling back to a fact without a profile', () => {
    expect(pickMessage(initial, input)).toMatchObject({
      message: { kind: 'streak' },
      state: { greeted: true, lastShownAt: now },
    });
    expect(pickMessage(initial, { ...input, profile: null })).toMatchObject({
      message: { kind: 'fact' },
      state: { greeted: true, lastShownAt: now },
    });
  });

  it('waits 5 minutes since the last message', () => {
    const { state } = pickMessage(initial, input);
    expect(MENTA_INTERVAL_MS).toBe(300_000);
    expect(pickMessage(state, { ...input, now: now + 299_000 }).message).toBeNull();
    expect(pickMessage(state, { ...input, now: now + 300_000 }).message?.kind).toBe('fact');
  });

  it('consumes one motivation FIFO without mutating inputs, before greeting or interval', () => {
    const pending = [
      { type: 'level' as const, level: 2 },
      { type: 'mission' as const, title: 'Bata' },
    ];
    const original = structuredClone({ initial, pending });
    const first = pickMessage(initial, { ...input, pending });
    expect(first.message).toEqual(motivationMessage({ type: 'level', level: 2 }));
    expect(first.pending).toEqual([pending[1]]);
    expect(first.state.greeted).toBe(false);
    const second = pickMessage(first.state, { ...input, pending: first.pending });
    expect(second.message?.text).toBe('¡Aprobaste «Bata»! Sigue así.');
    expect(second.pending).toEqual([]);
    expect({ initial, pending }).toEqual(original);
    expect(first.message?.text).toBe(
      '¡Subiste al nivel 2! Cada misión te acerca a dominar la bata.',
    );
    expect(pickMessage(second.state, input).message?.kind).toBe('streak');
  });

  it('cycles through every fact without repeating across cycle boundaries', () => {
    let state = initial;
    let previous: string | undefined;
    const ids: string[] = [];
    for (let i = 0; i < MENTA_FACTS.length * 3; i++) {
      const result = pickMessage(state, {
        ...input,
        profile: null,
        now: now + i * MENTA_INTERVAL_MS,
      });
      expect(result.message?.kind).toBe('fact');
      if (result.message?.kind !== 'fact') throw new Error('Expected a fact');
      expect(result.message.id).not.toBe(previous);
      previous = result.message.id;
      ids.push(previous);
      state = result.state;
    }
    expect(new Set(ids.slice(0, MENTA_FACTS.length)).size).toBe(MENTA_FACTS.length);
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('Menta persistence', () => {
  function setup() {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
    };
    const dispatchEvent = vi.fn();
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { dispatchEvent });
    return { data, storage, dispatchEvent };
  }

  it('bounds the FIFO queue, dispatches notifications and drains only once', () => {
    const { dispatchEvent } = setup();
    for (let level = 1; level <= 21; level++) queueMentaEvent('test', { type: 'level', level });
    const events = takeMentaEvents('test');
    expect(events).toHaveLength(20);
    expect(events[0]).toEqual({ type: 'level', level: 2 });
    expect(events.at(-1)).toEqual({ type: 'level', level: 21 });
    expect(takeMentaEvents('test')).toEqual([]);
    expect(dispatchEvent.mock.calls[0]?.[0].type).toBe('menta:event');
  });

  it('persists mute and notifies on changes', () => {
    const { dispatchEvent } = setup();
    expect(isMentaMuted()).toBe(false);
    setMentaMuted(true);
    expect(isMentaMuted()).toBe(true);
    setMentaMuted(false);
    expect(isMentaMuted()).toBe(false);
    expect(dispatchEvent.mock.calls[0]?.[0].type).toBe('menta:muted');
  });

  it('ignores invalid stored events', () => {
    const { data } = setup();
    data.set('bata.menta.pending.test', '[{"type":"level","level":-1}]');
    expect(takeMentaEvents('test')).toEqual([]);
    data.set('bata.menta.pending.test', '{broken');
    expect(takeMentaEvents('test')).toEqual([]);
    expect(() => queueMentaEvent('test', { type: 'level', level: 2 })).not.toThrow();
  });

  it('recovers when queuing directly over corrupt JSON', () => {
    const { data } = setup();
    data.set('bata.menta.pending.test', '{broken');
    queueMentaEvent('test', { type: 'level', level: 2 });
    expect(takeMentaEvents('test')).toEqual([{ type: 'level', level: 2 }]);
    data.set('bata.menta.pending.test', '{broken');
    expect(takeMentaEvents('test')).toEqual([]);
    expect(data.has('bata.menta.pending.test')).toBe(false);
  });

  it('isolates pending events by uid', () => {
    setup();
    queueMentaEvent('alice', { type: 'level', level: 2 });
    queueMentaEvent('bob', { type: 'mission', title: 'Bata' });
    expect(takeMentaEvents('alice')).toEqual([{ type: 'level', level: 2 }]);
    expect(takeMentaEvents('alice')).toEqual([]);
    expect(takeMentaEvents('bob')).toEqual([{ type: 'mission', title: 'Bata' }]);
  });

  it.each(['getItem', 'setItem', 'removeItem'] as const)(
    'tolerates storage failure in %s',
    (method) => {
      const { storage } = setup();
      vi.spyOn(storage, method).mockImplementation(() => {
        throw new Error('Storage blocked');
      });
      expect(() => queueMentaEvent('test', { type: 'level', level: 2 })).not.toThrow();
      expect(() => takeMentaEvents('test')).not.toThrow();
      expect(() => setMentaMuted(true)).not.toThrow();
      expect(() => isMentaMuted()).not.toThrow();
    },
  );
});
