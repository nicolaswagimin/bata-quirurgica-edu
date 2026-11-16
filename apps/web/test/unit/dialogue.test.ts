import { describe, expect, it } from 'vitest';
import { DIALOGUE_LINES } from '../../src/components/landing-copy.ts';
import {
  type DialogueState,
  dialogueReducer,
  INITIAL_DIALOGUE,
  nextDelay,
} from '../../src/lib/dialogue.ts';

const step = (state: DialogueState, type: Parameters<typeof dialogueReducer>[1]['type']) =>
  dialogueReducer(state, { type }, DIALOGUE_LINES);
describe('dialogue', () => {
  it('types one character at a time and stops at the end', () => {
    let state = INITIAL_DIALOGUE;
    expect(step(state, 'tick').shown).toBe(1);
    for (const _ of DIALOGUE_LINES[0]) state = step(state, 'tick');
    expect(state).toEqual({ index: 0, shown: DIALOGUE_LINES[0].length, mode: 'done' });
    expect(step(state, 'tick')).toBe(state);
  });
  it('next completes typing before advancing, and never autoplays', () => {
    const done = step(step(INITIAL_DIALOGUE, 'tick'), 'next');
    expect(done).toEqual({ index: 0, shown: DIALOGUE_LINES[0].length, mode: 'done' });
    expect(step(done, 'next')).toEqual({ index: 1, shown: 0, mode: 'typing' });
  });
  it('skip completes the last line; next stays there; restart types from zero', () => {
    const last = step(INITIAL_DIALOGUE, 'skip');
    expect(last).toEqual({ index: 4, shown: DIALOGUE_LINES[4].length, mode: 'done' });
    expect(step(last, 'next')).toBe(last);
    expect(step(last, 'restart')).toEqual(INITIAL_DIALOGUE);
  });
  it('complete reveals every new line for reduced motion or transcript mode', () => {
    let state = INITIAL_DIALOGUE;
    for (let index = 0; index < DIALOGUE_LINES.length; index++) {
      state = step(state, 'complete');
      expect(state).toEqual({ index, shown: DIALOGUE_LINES[index]?.length, mode: 'done' });
      expect(step(state, 'complete')).toEqual(state);
      state = step(state, 'next');
    }
  });
  it('uses 28ms plus punctuation pauses after the displayed character', () => {
    expect(nextDelay('Hola', 0)).toBe(28);
    expect(nextDelay('Hola', 1)).toBe(28);
    for (const punctuation of [',', ':']) expect(nextDelay(`a${punctuation}`, 2)).toBe(208);
    for (const punctuation of ['.', '?', '!']) expect(nextDelay(`a${punctuation}`, 2)).toBe(348);
    expect(nextDelay('a, ', 3)).toBe(28);
  });
});
