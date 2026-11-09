// Automatic fallback for the realistic AR gown: if the frame rate drops, step down quality instead
// of making the practice unplayable. Levels: 'xpbd' (optional full cloth) → 'springs' (rigged GLB
// with spring bones) → '2d' (the current 2.5D gown). Steps only go down during a session.

export type GownQuality = 'xpbd' | 'springs' | '2d';

/** Each level needs at least this fps (averaged over the window) to stay. */
export const MIN_FPS: Record<Exclude<GownQuality, '2d'>, number> = { xpbd: 30, springs: 20 };
/** Sustained time below the threshold before stepping down. */
export const DOWNGRADE_AFTER_MS = 3000;
/** Ignore the first seconds: model warm-up and the camera starting distort the fps. */
export const WARMUP_MS = 4000;

export class GownFallback {
  private since: number | null = null;
  private startedAt: number | null = null;
  quality: GownQuality;

  constructor(initial: GownQuality) {
    this.quality = initial;
  }

  /** Feeds the current fps; returns the (possibly lowered) quality. */
  update(fps: number, now: number): GownQuality {
    this.startedAt ??= now;
    if (this.quality === '2d' || now - this.startedAt < WARMUP_MS) return this.quality;
    const needed = MIN_FPS[this.quality];
    if (fps >= needed) {
      this.since = null;
      return this.quality;
    }
    this.since ??= now;
    if (now - this.since >= DOWNGRADE_AFTER_MS) {
      this.quality = this.quality === 'xpbd' ? 'springs' : '2d';
      this.since = null;
    }
    return this.quality;
  }

  /** One step down right away (e.g. the XPBD budget check failed on this device). */
  downgrade(): GownQuality {
    if (this.quality === 'xpbd') this.quality = 'springs';
    else this.quality = '2d';
    this.since = null;
    return this.quality;
  }

  /** Something failed outright (no WebGL, model did not load): straight to the 2.5D gown. */
  fail(): GownQuality {
    this.quality = '2d';
    return this.quality;
  }
}
