// Real-time sterile-technique feedback from MediaPipe Pose landmarks. Pure: no DOM, no MediaPipe
// imports, unit-tested in node. Coordinates are normalized landmarks scaled to frame pixels so
// distances keep the camera's aspect ratio.
import type { FrameSize, Landmark } from './overlay-math.ts';

export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

const MIN_VISIBILITY = 0.5;

/** Smoothing stays within these bounds: below 0.15 the pose lags too much to play. */
export const MIN_SMOOTHING = 0.15;
export const MAX_SMOOTHING = 0.65;

function clampAlpha(alpha: number): number {
  return Math.min(MAX_SMOOTHING, Math.max(MIN_SMOOTHING, alpha));
}

export interface Vec {
  x: number;
  y: number;
}

// ---------- Smoothing ----------

/** Exponential moving average per landmark; a landmark that drops out restarts from its next value. */
export class LandmarkSmoother {
  private prev: Landmark[] = [];
  private alpha: number;
  constructor(alpha = 0.45) {
    this.alpha = clampAlpha(alpha);
  }

  /** Lower alpha = steadier but laggier. The AR loop adapts it to the tracking noise. */
  setAlpha(alpha: number): void {
    this.alpha = clampAlpha(alpha);
  }

  smooth(landmarks: readonly Landmark[]): Landmark[] {
    if (landmarks.length === 0) {
      this.prev = [];
      return [];
    }
    const out = landmarks.map((lm, i) => {
      const p = this.prev[i];
      if (!p || (lm.visibility ?? 1) < MIN_VISIBILITY) return { ...lm };
      const a = this.alpha;
      return {
        x: p.x + a * (lm.x - p.x),
        y: p.y + a * (lm.y - p.y),
        z: (p.z ?? 0) + a * ((lm.z ?? 0) - (p.z ?? 0)),
        visibility: lm.visibility,
      };
    });
    this.prev = out;
    return out;
  }
}

// ---------- Body frame ----------

export interface Limb {
  shoulder: Vec;
  elbow: Vec | null;
  wrist: Vec | null;
  /** Wrist depth relative to the shoulders (MediaPipe z, larger = farther from the camera). */
  wristDepth: number | null;
}

export interface BodyFrame {
  shoulderMid: Vec;
  hipMid: Vec;
  /** Unit vector from the shoulders down to the hips. */
  down: Vec;
  /** Unit vector from the right shoulder (12) to the left one (11). */
  across: Vec;
  shoulderWidth: number;
  torsoHeight: number;
  left: Limb;
  right: Limb;
  knees: { left: Vec | null; right: Vec | null };
  ankles: { left: Vec | null; right: Vec | null };
}

function visible(lm: Landmark | undefined): lm is Landmark {
  return !!lm && (lm.visibility ?? 0) >= MIN_VISIBILITY;
}

function px(lm: Landmark, size: FrameSize): Vec {
  return { x: lm.x * size.width, y: lm.y * size.height };
}

function mid(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Needs both shoulders and both hips; arms, knees and ankles are optional. */
export function bodyFrame(landmarks: readonly Landmark[], size: FrameSize): BodyFrame | null {
  const ls = landmarks[LM.leftShoulder];
  const rs = landmarks[LM.rightShoulder];
  const lh = landmarks[LM.leftHip];
  const rh = landmarks[LM.rightHip];
  if (!visible(ls) || !visible(rs) || !visible(lh) || !visible(rh)) return null;
  const L = px(ls, size);
  const R = px(rs, size);
  const shoulderMid = mid(L, R);
  const hipMid = mid(px(lh, size), px(rh, size));
  const torsoHeight = dist(shoulderMid, hipMid);
  const shoulderWidth = dist(L, R);
  if (torsoHeight < 1 || shoulderWidth < 1) return null;
  const down = {
    x: (hipMid.x - shoulderMid.x) / torsoHeight,
    y: (hipMid.y - shoulderMid.y) / torsoHeight,
  };
  const across = { x: (L.x - R.x) / shoulderWidth, y: (L.y - R.y) / shoulderWidth };
  const shoulderZ = ((ls.z ?? 0) + (rs.z ?? 0)) / 2;
  const opt = (i: number) => {
    const lm = landmarks[i];
    return visible(lm) ? px(lm, size) : null;
  };
  const limb = (shoulder: Vec, e: number, w: number): Limb => {
    const wristLm = landmarks[w];
    return {
      shoulder,
      elbow: opt(e),
      wrist: opt(w),
      wristDepth: visible(wristLm) ? (wristLm.z ?? 0) - shoulderZ : null,
    };
  };
  return {
    shoulderMid,
    hipMid,
    down,
    across,
    shoulderWidth,
    torsoHeight,
    left: limb(L, LM.leftElbow, LM.leftWrist),
    right: limb(R, LM.rightElbow, LM.rightWrist),
    knees: { left: opt(LM.leftKnee), right: opt(LM.rightKnee) },
    ankles: { left: opt(LM.leftAnkle), right: opt(LM.rightAnkle) },
  };
}

/** Position along the torso: 0 at the shoulder line, 1 at the hip line (negative = above shoulders). */
export function torsoDepth(frame: BodyFrame, p: Vec): number {
  return dot(sub(p, frame.shoulderMid), frame.down) / frame.torsoHeight;
}

/** Signed sideways offset from the body's midline, in shoulder widths (+ towards landmark 11). */
export function sideOffset(frame: BodyFrame, p: Vec): number {
  return dot(sub(p, frame.shoulderMid), frame.across) / frame.shoulderWidth;
}

/** The waist sits ~72 % of the way from the shoulder line to the hip joints. */
export const WAIST_DEPTH = 0.72;

export function waistLine(frame: BodyFrame): [Vec, Vec] {
  const c = {
    x: frame.shoulderMid.x + frame.down.x * frame.torsoHeight * WAIST_DEPTH,
    y: frame.shoulderMid.y + frame.down.y * frame.torsoHeight * WAIST_DEPTH,
  };
  const half = frame.shoulderWidth * 0.9;
  return [
    { x: c.x - frame.across.x * half, y: c.y - frame.across.y * half },
    { x: c.x + frame.across.x * half, y: c.y + frame.across.y * half },
  ];
}

// ---------- Violations ----------

export type Violation = 'bajo-cintura' | 'cuello' | 'espalda' | 'axilas';

export const VIOLATION_TEXT: Record<Violation, string> = {
  'bajo-cintura':
    'Una muñeca bajó de la cintura. Súbela: por debajo de la cintura la bata ya no es estéril.',
  cuello: 'No toques el cuello: es una zona no estéril.',
  espalda: 'Tus manos van hacia la espalda: es una zona no estéril.',
  axilas: 'No cruces los brazos ni metas las manos bajo las axilas: no son zonas estériles.',
};

/** Short form for the game banner, readable at ~2 m; the full text above goes to screen readers. */
export const VIOLATION_SHORT: Record<Violation, string> = {
  'bajo-cintura': 'Muñeca bajo la cintura: súbela',
  cuello: 'No toques el cuello',
  espalda: 'Manos fuera de la espalda',
  axilas: 'Manos fuera de las axilas',
};

// Thresholds include a margin past the anatomical line so jitter around it never warns.
export const THRESHOLDS = {
  /** Wrist this far below the waist (in torso heights) counts as below it. */
  waistMargin: 0.08,
  /** Wrist within this distance of the neck point (in shoulder widths). */
  neckRadius: 0.2,
  /** …and not held out in front of the body (MediaPipe depth below this). */
  neckMaxForward: -0.25,
  /** Wrist depth behind the shoulders that means reaching to the back. */
  backDepth: 0.3,
  /** Wrist within this distance of either armpit (in shoulder widths). */
  armpitRadius: 0.24,
} as const;

function neckPoint(frame: BodyFrame): Vec {
  return {
    x: frame.shoulderMid.x - frame.down.x * frame.torsoHeight * 0.12,
    y: frame.shoulderMid.y - frame.down.y * frame.torsoHeight * 0.12,
  };
}

function armpit(frame: BodyFrame, shoulder: Vec): Vec {
  const inward = sub(frame.shoulderMid, shoulder);
  const len = Math.hypot(inward.x, inward.y) || 1;
  return {
    x:
      shoulder.x +
      frame.down.x * frame.torsoHeight * 0.2 +
      (inward.x / len) * frame.shoulderWidth * 0.1,
    y:
      shoulder.y +
      frame.down.y * frame.torsoHeight * 0.2 +
      (inward.y / len) * frame.shoulderWidth * 0.1,
  };
}

/** Raw, per-frame violations. Unseen wrists never produce a warning. */
export function detectViolations(frame: BodyFrame): Set<Violation> {
  const found = new Set<Violation>();
  const neck = neckPoint(frame);
  const pits = [armpit(frame, frame.left.shoulder), armpit(frame, frame.right.shoulder)];
  for (const limb of [frame.left, frame.right]) {
    const w = limb.wrist;
    if (!w) continue;
    if (torsoDepth(frame, w) > WAIST_DEPTH + THRESHOLDS.waistMargin) found.add('bajo-cintura');
    const forward = limb.wristDepth ?? 0;
    if (
      dist(w, neck) < THRESHOLDS.neckRadius * frame.shoulderWidth &&
      forward > THRESHOLDS.neckMaxForward
    ) {
      found.add('cuello');
    }
    if (limb.wristDepth !== null && limb.wristDepth > THRESHOLDS.backDepth) found.add('espalda');
    // Arms held out in front can pass over the armpits in 2D; only count hands at body depth.
    if (
      forward > THRESHOLDS.neckMaxForward &&
      pits.some((p) => dist(w, p) < THRESHOLDS.armpitRadius * frame.shoulderWidth)
    ) {
      found.add('axilas');
    }
  }
  return found;
}

/**
 * Debounces violations: one must persist `onsetMs` before it shows, and must be absent `releaseMs`
 * before it clears. A single noisy frame never produces or drops a warning.
 */
export class ViolationTracker {
  private since = new Map<Violation, number>();
  private clearSince = new Map<Violation, number>();
  private active = new Set<Violation>();

  constructor(
    private readonly onsetMs = 350,
    private readonly releaseMs = 600,
  ) {}

  update(raw: ReadonlySet<Violation>, now: number): ReadonlySet<Violation> {
    const kinds: Violation[] = ['bajo-cintura', 'cuello', 'espalda', 'axilas'];
    for (const kind of kinds) {
      if (raw.has(kind)) {
        this.clearSince.delete(kind);
        const start = this.since.get(kind) ?? now;
        this.since.set(kind, start);
        if (now - start >= this.onsetMs) this.active.add(kind);
      } else {
        this.since.delete(kind);
        if (!this.active.has(kind)) continue;
        const start = this.clearSince.get(kind) ?? now;
        this.clearSince.set(kind, start);
        if (now - start >= this.releaseMs) {
          this.active.delete(kind);
          this.clearSince.delete(kind);
        }
      }
    }
    return new Set(this.active);
  }

  reset(): void {
    this.since.clear();
    this.clearSince.clear();
    this.active.clear();
  }
}
