// Touch-free controls for the AR mirror: a button activates when a hand stays over it for a second.
// Pure: no DOM. Coordinates are CSS pixels of the full-screen stage.
import type { Landmark } from './overlay-math.ts';

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Maps a normalized landmark of the camera frame to the stage, where the video is shown with
 * `object-fit: cover` and mirrored horizontally (the user sees themself as in a mirror).
 */
export function videoToStage(p: Landmark, video: Size, stage: Size, mirrored = true): Point {
  const scale = Math.max(stage.width / video.width, stage.height / video.height);
  const shownW = video.width * scale;
  const shownH = video.height * scale;
  const offsetX = (stage.width - shownW) / 2;
  const offsetY = (stage.height - shownH) / 2;
  const x = offsetX + p.x * shownW;
  return { x: mirrored ? stage.width - x : x, y: offsetY + p.y * shownH };
}

// Wrists and index fingertips of both hands (MediaPipe Pose).
export const HAND_LANDMARKS = [15, 16, 19, 20] as const;

export function handPoints(landmarks: readonly Landmark[], video: Size, stage: Size): Point[] {
  return HAND_LANDMARKS.map((i) => landmarks[i])
    .filter((lm): lm is Landmark => !!lm && (lm.visibility ?? 0) >= 0.5)
    .map((lm) => videoToStage(lm, video, stage));
}

function inside(p: Point, r: Rect, grow: number): boolean {
  const gx = r.width * grow;
  const gy = r.height * grow;
  return (
    p.x >= r.left - gx &&
    p.x <= r.left + r.width + gx &&
    p.y >= r.top - gy &&
    p.y <= r.top + r.height + gy
  );
}

export interface Target {
  id: string;
  rect: Rect;
}

export interface DwellState {
  /** 0..1 progress per target currently being hovered. */
  progress: Map<string, number>;
  activated: string | null;
}

/**
 * Hover-to-activate with tolerance: a hovered target grows 15 % so trembling hands do not drop it,
 * a hand may leave for up to `graceMs` without losing progress, and after an activation every
 * target rests for `cooldownMs` so one gesture never triggers twice.
 */
export class DwellTracker {
  private start = new Map<string, number>();
  private lastSeen = new Map<string, number>();
  private coolUntil = 0;

  constructor(
    private readonly dwellMs = 1000,
    private readonly graceMs = 250,
    private readonly cooldownMs = 900,
  ) {}

  update(hands: readonly Point[], targets: readonly Target[], now: number): DwellState {
    const progress = new Map<string, number>();
    if (now < this.coolUntil) return { progress, activated: null };
    let activated: string | null = null;
    for (const t of targets) {
      const hovering = this.start.has(t.id);
      const hit = hands.some((h) => inside(h, t.rect, hovering ? 0.15 : 0));
      if (hit) this.lastSeen.set(t.id, now);
      const seen = this.lastSeen.get(t.id);
      if (seen === undefined || now - seen > this.graceMs) {
        this.start.delete(t.id);
        this.lastSeen.delete(t.id);
        continue;
      }
      const began = this.start.get(t.id) ?? now;
      this.start.set(t.id, began);
      const p = Math.min(1, (now - began) / this.dwellMs);
      progress.set(t.id, p);
      if (p >= 1 && !activated) activated = t.id;
    }
    if (activated) {
      this.start.clear();
      this.lastSeen.clear();
      this.coolUntil = now + this.cooldownMs;
    }
    return { progress, activated };
  }
}
