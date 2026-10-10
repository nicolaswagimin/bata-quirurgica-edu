import { BataPasosSchema } from '@bata/shared/schemas';
import { describe, expect, it } from 'vitest';
import pasosJson from '../../../../content/protocolos/bata-pasos.json';
import { buildTimeline } from '../../src/three/steps.ts';

const pasos = BataPasosSchema.parse(pasosJson);

describe('buildTimeline', () => {
  it('orders donning steps and dresses the gown from 0 to 1', () => {
    const timeline = buildTimeline(pasos, 'donning');
    expect(timeline.map((s) => s.order)).toEqual(
      [...pasos.donning].map((s) => s.order).sort((a, b) => a - b),
    );
    expect(timeline[0]?.progress).toBe(0);
    expect(timeline.at(-1)?.progress).toBe(1);
  });

  it('undresses the gown from 1 to 0 when doffing and resolves hotspots', () => {
    const timeline = buildTimeline(pasos, 'doffing');
    expect(timeline[0]?.progress).toBe(1);
    expect(timeline.at(-1)?.progress).toBe(0);
    for (const step of timeline) {
      expect(step.hotspots.map((h) => h.id)).toEqual(step.hotspotIds);
    }
  });
});
