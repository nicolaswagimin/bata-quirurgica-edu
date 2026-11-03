// Per-frame canvas drawing for the AR mirror: the game scene (mask, hanging / donning / worn gown),
// the posture guides and the hand cursors.
import type { Scene } from './game-steps.ts';
import { gownMesh } from './gown-mesh.ts';
import { createGownTextures, drawGownMesh, type GownTextures } from './gown-render.ts';
import { hangingFrame, lerpMesh, sleeveOpenings } from './hanging-gown.ts';
import { HAND_LANDMARKS } from './hover-targets.ts';
import { drawMask, faceAnchor } from './mask.ts';
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

export interface DrawOptions {
  scene: Scene | null;
  hotspot: string | null;
  cursors: boolean;
  landmarks: readonly Landmark[];
  reducedMotion: boolean;
}

type Ctx = CanvasRenderingContext2D;

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
    options: DrawOptions,
  ): number {
    const start = performance.now();
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return 0;
    if (this.canvas.width !== video.videoWidth) this.canvas.width = video.videoWidth;
    if (this.canvas.height !== video.videoHeight) this.canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.textures === undefined) this.textures = createGownTextures(ctx, this.colors);
    if (body && options.scene) {
      this.drawGown(ctx, body, options.scene, options.hotspot, options.reducedMotion);
      this.drawSceneMask(ctx, body, options.landmarks, options.scene, options.reducedMotion);
    }
    drawPostureGuides(ctx, body, active, this.colors);
    if (options.cursors) this.drawHandCursors(ctx, options.landmarks);
    return performance.now() - start;
  }

  private drawGown(
    ctx: Ctx,
    body: BodyFrame,
    scene: Scene,
    hotspot: string | null,
    still: boolean,
  ) {
    const textures = this.textures;
    if (!textures || scene.gown === 'hidden') return;
    const bob = still ? 0 : Math.sin(performance.now() / 700) * body.torsoHeight * 0.015;
    const hanging = hangingFrame(body, bob);
    const mesh =
      scene.gown === 'hanging'
        ? gownMesh(hanging)
        : scene.gown === 'donning'
          ? lerpMesh(gownMesh(hanging), gownMesh(body), scene.gownT)
          : gownMesh(body);
    const spot = scene.gown === 'worn' ? hotspot : null;
    drawGownMesh(ctx, mesh, textures, this.colors, body.shoulderWidth, spot);
    if (scene.gown !== 'hanging') return;
    // Sleeve openings: pulsing rings until a wrist goes in, then filled.
    const pulse = still ? 1 : 1 + Math.sin(performance.now() / 220) * 0.12;
    sleeveOpenings(hanging).forEach((p, i) => {
      const inside = scene.sleeves[i] ?? false;
      ctx.save();
      ctx.lineWidth = Math.max(3, body.shoulderWidth * 0.03);
      ctx.strokeStyle = this.colors.paper;
      ctx.fillStyle = this.colors.paper;
      ctx.globalAlpha = inside ? 0.55 : 0.95;
      ctx.beginPath();
      ctx.arc(p.x, p.y, body.shoulderWidth * 0.16 * (inside ? 1 : pulse), 0, Math.PI * 2);
      if (inside) ctx.fill();
      else ctx.stroke();
      ctx.restore();
    });
  }

  private drawSceneMask(
    ctx: Ctx,
    body: BodyFrame,
    landmarks: readonly Landmark[],
    scene: Scene,
    still: boolean,
  ) {
    const face = faceAnchor(landmarks, { width: this.canvas.width, height: this.canvas.height });
    if (!face) return;
    const colors = {
      mask: this.colors.mask,
      maskShade: this.colors.maskShade,
      paper: this.colors.paper,
    };
    if (scene.mask === 'worn') return drawMask(ctx, face, colors, 1);
    // Floating beside the head, gently bobbing, until both hands bring it to the face.
    const bob = still ? 0 : Math.sin(performance.now() / 500) * body.torsoHeight * 0.03;
    const reach = body.shoulderWidth * 0.8;
    const float = {
      x: face.center.x + body.across.x * reach,
      y: face.center.y + body.across.y * reach + bob,
    };
    const t = scene.mask === 'snapping' ? scene.maskT : 0;
    if (t === 0) {
      // A pulsing halo says "grab me".
      const halo = face.width * (still ? 0.75 : 0.7 + Math.sin(performance.now() / 260) * 0.08);
      ctx.save();
      ctx.strokeStyle = this.colors.paper;
      ctx.lineWidth = Math.max(3, face.width * 0.06);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(float.x, float.y, halo, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const k = 1 - (1 - t) ** 3;
    drawMask(
      ctx,
      {
        center: {
          x: float.x + (face.center.x - float.x) * k,
          y: float.y + (face.center.y - float.y) * k,
        },
        width: face.width,
        angle: face.angle * k,
        ears: null,
      },
      colors,
      t,
    );
  }

  /** Paper rings on the hands so the player sees what "presses" the floating buttons. */
  private drawHandCursors(ctx: Ctx, landmarks: readonly Landmark[]): void {
    const r = Math.max(10, this.canvas.width * 0.018);
    ctx.save();
    ctx.lineWidth = Math.max(3, r * 0.3);
    ctx.strokeStyle = this.colors.paper;
    ctx.fillStyle = this.colors.trim;
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
