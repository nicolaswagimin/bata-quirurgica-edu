// Holds the last good body pose for a few frames so the gown does not blink out when the model
// loses a shoulder or a hip for one frame. Rendering only: the game rules always use the live body.
import type { BodyFrame } from './posture.ts';

/** How long a stale body may still be drawn after the model loses it. */
export const BODY_HOLD_MS = 250;

export class BodyHold {
  private body: BodyFrame | null = null;
  private at = 0;

  constructor(private readonly holdMs = BODY_HOLD_MS) {}

  /** The live body, or the last one while it is fresh; null once `holdMs` passes without a body. */
  update(body: BodyFrame | null, now: number): BodyFrame | null {
    if (body) {
      this.body = body;
      this.at = now;
      return body;
    }
    return this.body && now - this.at <= this.holdMs ? this.body : null;
  }

  reset(): void {
    this.body = null;
  }
}
