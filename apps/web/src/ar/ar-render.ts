// Per-frame canvas drawing for the AR mirror: the deformable gown and the posture guides.
import { gownMesh } from './gown-mesh.ts';
import { createGownTextures, drawGownMesh, type GownTextures } from './gown-render.ts';
import { HAND_LANDMARKS } from './hover-targets.ts';
import type { Landmark } from './overlay-math.ts';
import type { BodyFrame, Violation } from './posture.ts';
import { drawPostureGuides } from './posture-overlay.ts';

export interface ArColors {
  fabric: string;
  trim: string;
  paper: string;
  line: string;
  danger: string;
  mask: string;
  maskShade: string;
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
}

/** Canvas colours from the design tokens (see the canvas-tokens regression test). */
export function readArColors(): ArColors {
  return {
    fabric: token('gown'),
    trim: token('gown-trim'),
    paper: token('bg'),
    line: token('bg'),
    danger: token('danger'),
    mask: token('mask'),
    maskShade: token('mask-shade'),
  };
}

export class ArRenderer {
  private textures: GownTextures | null | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly colors: ArColors,
  ) {}

  /** Clears and redraws; returns the time spent in ms. */
  draw(
    video: HTMLVideoElement,
    body: BodyFrame | null,
    active: ReadonlySet<Violation>,
    options: {
      gown: boolean;
      hotspot: string | null;
      cursors: boolean;
      landmarks: readonly Landmark[];
    },
  ): number {
    const start = performance.now();
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return 0;
    if (this.canvas.width !== video.videoWidth) this.canvas.width = video.videoWidth;
    if (this.canvas.height !== video.videoHeight) this.canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.textures === undefined) this.textures = createGownTextures(ctx, this.colors);
    if (body && options.gown && this.textures) {
      drawGownMesh(
        ctx,
        gownMesh(body),
        this.textures,
        this.colors,
        body.shoulderWidth,
        options.hotspot,
      );
    }
    drawPostureGuides(ctx, body, active, this.colors);
    if (options.cursors) this.drawHandCursors(ctx, options.landmarks);
    return performance.now() - start;
  }

  /** Paper rings on the hands so the player sees what "presses" the floating buttons. */
  private drawHandCursors(ctx: CanvasRenderingContext2D, landmarks: readonly Landmark[]): void {
    const r = Math.max(10, this.canvas.width * 0.018);
    ctx.save();
    ctx.lineWidth = Math.max(3, r * 0.3);
    ctx.strokeStyle = this.colors.paper;
    ctx.fillStyle = this.colors.trim;
    ctx.globalAlpha = 0.9;
    for (const i of HAND_LANDMARKS.slice(2)) {
      const lm = landmarks[i];
      if (!lm || (lm.visibility ?? 0) < 0.5) continue;
      ctx.beginPath();
      ctx.arc(lm.x * this.canvas.width, lm.y * this.canvas.height, r, 0, Math.PI * 2);
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.stroke();
    }
    ctx.restore();
  }
}
