// Helpers around the game view: re-render checks, the e2e finished view and the score.
import type { ArGameStep } from '@bata/shared/schemas';
import type { GameView } from './game-steps.ts';

/** Whether the HUD needs a re-render (hold rounded to 5 %). */
export function sameView(a: GameView | null, b: GameView): boolean {
  return (
    !!a &&
    a.stepIndex === b.stepIndex &&
    a.hint === b.hint &&
    a.done === b.done &&
    Math.abs(a.hold - b.hold) < 0.05
  );
}

export function doneView(steps: readonly ArGameStep[]): GameView {
  return {
    stepIndex: steps.length,
    hold: 0,
    hint: '',
    completedIds: steps.map((s) => s.id),
    done: true,
    warningsOn: true,
    scene: {
      mask: 'worn',
      maskT: 1,
      gown: 'worn',
      gownT: 1,
      sleeves: [true, true],
      ties: 'tied',
      tieT: 1,
      gloves: 'on',
      gloveT: 1,
      flap: 'closed',
      flapT: 1,
    },
  };
}

/** 100 for a clean run; each sterile-technique warning costs 10 points. */
export function scoreFor(warnings: number): number {
  return Math.max(0, 100 - warnings * 10);
}
