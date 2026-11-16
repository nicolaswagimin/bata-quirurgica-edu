export type DialogueState = { index: number; shown: number; mode: 'typing' | 'done' };
export type DialogueAction = { type: 'tick' | 'next' | 'skip' | 'restart' | 'complete' };
export const INITIAL_DIALOGUE: DialogueState = { index: 0, shown: 0, mode: 'typing' };

/** Pure state transitions; the caller supplies the script, so this has no UI dependency. */
export function dialogueReducer(
  state: DialogueState,
  action: DialogueAction,
  lines: readonly string[],
): DialogueState {
  const length = lines[state.index]?.length ?? 0;
  const complete = (): DialogueState => ({ ...state, shown: length, mode: 'done' });
  switch (action.type) {
    case 'complete':
      return complete();
    case 'restart':
      return { ...INITIAL_DIALOGUE };
    case 'skip':
      return { index: lines.length - 1, shown: lines.at(-1)?.length ?? 0, mode: 'done' };
    case 'next':
      if (state.mode === 'typing') return complete();
      return state.index < lines.length - 1
        ? { index: state.index + 1, shown: 0, mode: 'typing' }
        : state;
    case 'tick': {
      if (state.mode === 'done') return state;
      const shown = Math.min(length, state.shown + 1);
      return { ...state, shown, mode: shown === length ? 'done' : 'typing' };
    }
  }
}

/** Pause after the most recently revealed punctuation. */
export function nextDelay(line: string, shown: number): number {
  const previous = line[shown - 1] ?? '';
  return 28 + (/[,:]/.test(previous) ? 180 : /[.?!]/.test(previous) ? 320 : 0);
}
