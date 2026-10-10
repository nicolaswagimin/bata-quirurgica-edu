import type { BataPasos, Hotspot, ProtocolStep } from '@bata/shared/schemas';

export type TimelineMode = 'donning' | 'doffing';

export type TimelineStep = ProtocolStep & {
  hotspots: Hotspot[];
  // How much of the gown is on the mannequin at this step (0 = none, 1 = fully dressed).
  progress: number;
};

// Orders the steps of one phase and assigns each a gown keyframe: donning goes 0 → 1,
// doffing goes 1 → 0, evenly spaced across the steps.
export function buildTimeline(pasos: BataPasos, mode: TimelineMode): TimelineStep[] {
  const byId = new Map(pasos.hotspots.map((h) => [h.id, h]));
  const steps = [...pasos[mode]].sort((a, b) => a.order - b.order);
  const last = Math.max(steps.length - 1, 1);
  return steps.map((step, i) => {
    const fraction = steps.length === 1 ? 1 : i / last;
    return {
      ...step,
      hotspots: step.hotspotIds.flatMap((id) => byId.get(id) ?? []),
      progress: mode === 'donning' ? fraction : 1 - fraction,
    };
  });
}
