// Pure geometry and timing helpers for the AR mirror. No DOM, no MediaPipe imports: unit-tested in node.

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

export interface Anchor {
  centerX: number;
  centerY: number;
  shoulderWidthPx: number;
  torsoHeightPx: number;
  angleRad: number;
}

// MediaPipe Pose landmark indices.
export const LEFT_SHOULDER = 11;
export const RIGHT_SHOULDER = 12;
export const LEFT_HIP = 23;
export const RIGHT_HIP = 24;
export const ANCHOR_LANDMARKS = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP] as const;

export const MIN_VISIBILITY = 0.5;

// Places the gown over the torso. Landmarks are normalized (0..1); the result is in pixels of `size`.
// The angle goes from the right shoulder (12) to the left one (11), so level shoulders give 0.
export function computeGownAnchor(landmarks: readonly Landmark[], size: FrameSize): Anchor | null {
  const points = ANCHOR_LANDMARKS.map((index) => landmarks[index]);
  if (points.some((p) => !p || (p.visibility ?? 0) < MIN_VISIBILITY)) return null;
  const [ls, rs, lh, rh] = points.map((p) => ({
    x: (p as Landmark).x * size.width,
    y: (p as Landmark).y * size.height,
  })) as [Point, Point, Point, Point];

  const shoulderMid = midpoint(ls, rs);
  const hipMid = midpoint(lh, rh);
  const center = midpoint(shoulderMid, hipMid);
  return {
    centerX: center.x,
    centerY: center.y,
    shoulderWidthPx: Math.hypot(ls.x - rs.x, ls.y - rs.y),
    torsoHeightPx: Math.hypot(hipMid.x - shoulderMid.x, hipMid.y - shoulderMid.y),
    angleRad: Math.atan2(ls.y - rs.y, ls.x - rs.x),
  };
}

interface Point {
  x: number;
  y: number;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export const LOW_FPS_THRESHOLD = 12;
export const LOW_FPS_DURATION_MS = 5_000;
const WINDOW_MS = 1_000;

// Sliding one-second FPS window. `lowPerformance` turns true only after the rate stays below
// 12 fps for 5 continuous seconds, and resets as soon as it recovers.
export class FpsMonitor {
  private timestamps: number[] = [];
  private lowSince: number | null = null;
  fps = 0;
  lowPerformance = false;

  record(nowMs: number): { fps: number; lowPerformance: boolean } {
    const ts = this.timestamps;
    ts.push(nowMs);
    // Keep one sample older than the window so the interval always spans ~1 s.
    while (ts.length > 2 && (ts[1] as number) <= nowMs - WINDOW_MS) ts.shift();

    if (ts.length >= 2) {
      const elapsed = nowMs - (ts[0] as number);
      this.fps = elapsed > 0 ? ((ts.length - 1) * 1000) / elapsed : this.fps;
      if (this.fps < LOW_FPS_THRESHOLD) this.lowSince ??= nowMs;
      else this.lowSince = null;
    }
    this.lowPerformance = this.lowSince !== null && nowMs - this.lowSince >= LOW_FPS_DURATION_MS;
    return { fps: this.fps, lowPerformance: this.lowPerformance };
  }
}
