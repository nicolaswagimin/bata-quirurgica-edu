// Movimiento secundario de la bata: resortes amortiguados que se mueven por la aceleración del
// torso. El ruedo y las mangas se atrasan cuando el cuerpo arranca o frena, que es lo que hace que
// la tela deje de verse pegada. Puro: sin DOM, probado en node.
import type { BodyFrame, Vec } from './posture.ts';

export type GownMotion = {
  /** Desplazamiento del ruedo en anchos de hombros. */
  hem: Vec;
  sleeveLeft: Vec;
  sleeveRight: Vec;
};

export const NEUTRAL_GOWN_MOTION: GownMotion = {
  hem: { x: 0, y: 0 },
  sleeveLeft: { x: 0, y: 0 },
  sleeveRight: { x: 0, y: 0 },
};

/** `?bata=vivo` activa el movimiento secundario; la malla 3D tendrá su propia bandera. */
export function isGownMotionEnabled(search: string): boolean {
  return new URLSearchParams(search).get('bata') === 'vivo';
}

const STIFFNESS = 42; // 1/s²
const DAMPING = 8; // 1/s
const GAIN = 0.06; // ancho de hombros por (ancho de hombros / s²)
const MAX = 0.22; // ancho de hombros
const MIN_DT_MS = 8;
const MAX_DT_MS = 100;
const ACCELERATION_SMOOTHING = 0.25;

type Spring = Vec & { vx: number; vy: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function step(spring: Spring, target: Vec, dt: number): Spring {
  const ax = (target.x - spring.x) * STIFFNESS - spring.vx * DAMPING;
  const ay = (target.y - spring.y) * STIFFNESS - spring.vy * DAMPING;
  const vx = spring.vx + ax * dt;
  const vy = spring.vy + ay * dt;
  return {
    x: clamp(spring.x + vx * dt, -MAX, MAX),
    y: clamp(spring.y + vy * dt, -MAX * 0.4, MAX * 0.4),
    vx,
    vy,
  };
}

export class GownSprings {
  private hem: Spring = { x: 0, y: 0, vx: 0, vy: 0 };
  private sleeveLeft: Spring = { x: 0, y: 0, vx: 0, vy: 0 };
  private sleeveRight: Spring = { x: 0, y: 0, vx: 0, vy: 0 };
  private previousCenter: Vec | null = null;
  private previousVelocity: Vec = { x: 0, y: 0 };
  private acceleration: Vec = { x: 0, y: 0 };

  reset(): void {
    this.hem = { x: 0, y: 0, vx: 0, vy: 0 };
    this.sleeveLeft = { x: 0, y: 0, vx: 0, vy: 0 };
    this.sleeveRight = { x: 0, y: 0, vx: 0, vy: 0 };
    this.previousCenter = null;
    this.previousVelocity = { x: 0, y: 0 };
    this.acceleration = { x: 0, y: 0 };
  }

  update(body: BodyFrame, dtMs: number, reducedMotion: boolean): GownMotion {
    if (reducedMotion) {
      this.reset();
      return NEUTRAL_GOWN_MOTION;
    }
    const dt = clamp(Number.isFinite(dtMs) ? dtMs : MAX_DT_MS, MIN_DT_MS, MAX_DT_MS) / 1000;
    const center = {
      x: (body.shoulderMid.x + body.hipMid.x) / 2,
      y: (body.shoulderMid.y + body.hipMid.y) / 2,
    };
    const previous = this.previousCenter;
    this.previousCenter = center;
    if (!previous) return NEUTRAL_GOWN_MOTION;

    const scale = Math.max(1, body.shoulderWidth);
    const velocity = {
      x: (center.x - previous.x) / dt / scale,
      y: (center.y - previous.y) / dt / scale,
    };
    const raw = {
      x: (velocity.x - this.previousVelocity.x) / dt,
      y: (velocity.y - this.previousVelocity.y) / dt,
    };
    this.previousVelocity = velocity;
    this.acceleration = {
      x: this.acceleration.x + (raw.x - this.acceleration.x) * ACCELERATION_SMOOTHING,
      y: this.acceleration.y + (raw.y - this.acceleration.y) * ACCELERATION_SMOOTHING,
    };

    // La tela se atrasa en contra de la aceleración del cuerpo.
    const target = {
      x: clamp(-this.acceleration.x * GAIN, -MAX, MAX),
      y: clamp(-this.acceleration.y * GAIN * 0.4, -MAX * 0.4, MAX * 0.4),
    };
    this.hem = step(this.hem, target, dt);
    this.sleeveLeft = step(this.sleeveLeft, { x: target.x * 0.7, y: target.y * 0.6 }, dt);
    this.sleeveRight = step(this.sleeveRight, { x: target.x * 0.7, y: target.y * 0.6 }, dt);
    return {
      hem: { x: this.hem.x, y: this.hem.y },
      sleeveLeft: { x: this.sleeveLeft.x, y: this.sleeveLeft.y },
      sleeveRight: { x: this.sleeveRight.x, y: this.sleeveRight.y },
    };
  }
}
