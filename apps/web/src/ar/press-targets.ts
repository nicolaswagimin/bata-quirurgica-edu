// Bridges the pure DwellTracker to the DOM: reads where each registered button is on the stage,
// feeds the hand positions and writes the ring progress to `--dwell`.

import { type DwellTracker, handPoints, type Size, type Target } from './hover-targets.ts';
import type { Landmark } from './overlay-math.ts';

export type TargetMap = Map<string, { el: HTMLElement; onActivate: () => void }>;

export function pressTargets(
  stageEl: HTMLElement | null,
  landmarks: readonly Landmark[],
  video: Size,
  targets: TargetMap,
  dwell: DwellTracker,
  now: number,
): void {
  const stage = stageEl?.getBoundingClientRect();
  if (!stage) return;
  const hands = handPoints(landmarks, video, stage);
  const list: Target[] = [];
  for (const [id, t] of targets) {
    const r = t.el.getBoundingClientRect();
    if (r.width === 0) continue;
    list.push({
      id,
      rect: { left: r.left - stage.left, top: r.top - stage.top, width: r.width, height: r.height },
    });
  }
  const state = dwell.update(hands, list, now);
  for (const [id, t] of targets)
    t.el.style.setProperty('--dwell', String(state.progress.get(id) ?? 0));
  if (state.activated) targets.get(state.activated)?.onActivate();
}
