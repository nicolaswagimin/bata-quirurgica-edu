import { describe, expect, it } from 'vitest';
import {
  type AssistColors,
  drawGhost,
  drawHoldRing,
  drawJointStatus,
} from '../../src/ar/assist-overlay.ts';
import type { JointStatus } from '../../src/ar/pose-targets.ts';

const colors: AssistColors = {
  ghost: 'ghost',
  ok: 'ok',
  near: 'near',
  far: 'far',
  ring: 'ring',
  track: 'track',
  outline: 'outline',
};
function recording() {
  const calls: { method: string; args: number[]; fill: string; stroke: string }[] = [];
  const fake = {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    save() {},
    restore() {},
    beginPath() {},
    moveTo(...args: number[]) {
      record('moveTo', args);
    },
    lineTo(...args: number[]) {
      record('lineTo', args);
    },
    arc(...args: unknown[]) {
      record('arc', args.map(Number));
    },
    fill() {
      record('fill', []);
    },
    stroke() {
      record('stroke', []);
    },
  };
  function record(method: string, args: number[]) {
    calls.push({ method, args, fill: fake.fillStyle, stroke: fake.strokeStyle });
  }
  return { ctx: fake as unknown as CanvasRenderingContext2D, calls, fake };
}
function status(value: JointStatus['status']): JointStatus {
  return {
    joint: 'leftWrist',
    current: { x: 0, y: 0 },
    target: { x: 100, y: 0 },
    distance: 1,
    status: value,
    arrow: value === 'ok' ? null : { x: 1, y: 0 },
    torsoDelta: { side: 100, depth: 0 },
    currentSide: 0,
  };
}
describe('assist canvas', () => {
  it.each([0.25, 0.5, 1, 2])('draws clockwise progress %s from twelve o’clock', (progress) => {
    const { ctx, calls } = recording();
    drawHoldRing(ctx, { x: 10, y: 20 }, 30, progress, colors);
    const arcs = calls.filter((c) => c.method === 'arc');
    expect(arcs[1]?.args[3]).toBe(-Math.PI / 2);
    expect(arcs[1]?.args[4]).toBeCloseTo(-Math.PI / 2 + Math.min(1, progress) * Math.PI * 2);
    expect(arcs[1]?.args[5]).toBe(0);
    expect(arcs.map((c) => c.stroke)).toEqual(['track', 'ring']);
  });
  it('draws only the track at zero or negative progress', () => {
    const { ctx, calls } = recording();
    drawHoldRing(ctx, { x: 0, y: 0 }, 30, -1, colors);
    expect(calls.filter((c) => c.method === 'arc')).toHaveLength(1);
  });
  it('uses status colors and omits arrows for ok joints', () => {
    const { ctx, calls } = recording();
    drawJointStatus(ctx, [status('ok')], colors, 1);
    expect(calls.filter((c) => c.method === 'lineTo')).toHaveLength(0);
    drawJointStatus(ctx, [status('near'), status('far')], colors, 1);
    expect(calls.filter((c) => c.method === 'fill').map((c) => c.fill)).toEqual([
      'ok',
      'near',
      'far',
    ]);
    expect(calls.filter((c) => c.method === 'arc').every((c) => c.stroke === 'outline')).toBe(true);
    expect(calls.find((c) => c.method === 'lineTo')?.args).toEqual([48, 0]);
  });
  it('draws ghost bones and a head with supplied colors and opacity', () => {
    const { ctx, calls, fake } = recording();
    const p = { x: 1, y: 2 };
    drawGhost(
      ctx,
      {
        points: {
          head: p,
          leftShoulder: p,
          rightShoulder: p,
          leftHip: p,
          rightHip: p,
          leftElbow: p,
          rightElbow: p,
          leftWrist: p,
          rightWrist: p,
        },
        bones: [[p, p]],
        headRadius: 4,
        limbWidth: 3,
      },
      colors,
    );
    expect(fake.globalAlpha).toBe(0.35);
    expect(calls.find((c) => c.method === 'fill')?.fill).toBe('ghost');
    expect(calls.find((c) => c.method === 'arc')?.args).toEqual([1, 2, 4, 0, Math.PI * 2]);
  });
});
