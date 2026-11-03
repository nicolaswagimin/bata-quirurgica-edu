// Surgical mask for the AR game, from MediaPipe Pose face points only (no Face Landmarker):
// nose 0, eyes 2 and 5, ears 7 and 8, mouth corners 9 and 10. Geometry is pure; `drawMask` takes
// the context so it stays testable.
import type { FrameSize, Landmark } from './overlay-math.ts';
import type { Vec } from './posture.ts';

export interface FaceAnchor {
  /** Centre of the mask: between the nose tip and the mouth. */
  center: Vec;
  /** Ear to ear (or eye-based estimate), in pixels. */
  width: number;
  /** Rotation of the eye line. */
  angle: number;
  ears: [Vec, Vec] | null;
}

const ok = (lm: Landmark | undefined): lm is Landmark => !!lm && (lm.visibility ?? 0) >= 0.5;
const px = (lm: Landmark, s: FrameSize): Vec => ({ x: lm.x * s.width, y: lm.y * s.height });

export function faceAnchor(landmarks: readonly Landmark[], size: FrameSize): FaceAnchor | null {
  const nose = landmarks[0];
  const mouthL = landmarks[9];
  const mouthR = landmarks[10];
  if (!ok(nose) || !ok(mouthL) || !ok(mouthR)) return null;
  const n = px(nose, size);
  const mL = px(mouthL, size);
  const mR = px(mouthR, size);
  const mouth = { x: (mL.x + mR.x) / 2, y: (mL.y + mR.y) / 2 };
  const earL = landmarks[7];
  const earR = landmarks[8];
  const eyeL = landmarks[2];
  const eyeR = landmarks[5];
  const ears: [Vec, Vec] | null = ok(earL) && ok(earR) ? [px(earL, size), px(earR, size)] : null;
  const width = ears
    ? Math.hypot(ears[0].x - ears[1].x, ears[0].y - ears[1].y) * 1.1
    : Math.hypot(mL.x - mR.x, mL.y - mR.y) * 3.2;
  const angle =
    ok(eyeL) && ok(eyeR)
      ? Math.atan2(px(eyeL, size).y - px(eyeR, size).y, px(eyeL, size).x - px(eyeR, size).x)
      : Math.atan2(mL.y - mR.y, mL.x - mR.x);
  return {
    center: { x: n.x * 0.45 + mouth.x * 0.55, y: n.y * 0.45 + mouth.y * 0.55 },
    width,
    angle,
    ears,
  };
}

/** Both hands within reach of the face: the gesture that puts the mask on. */
export function handsAtFace(
  landmarks: readonly Landmark[],
  size: FrameSize,
  shoulderWidth: number,
): boolean {
  const face = faceAnchor(landmarks, size);
  if (!face) return false;
  const hands = [15, 16].map((i) => landmarks[i]);
  return hands.every(
    (h) =>
      ok(h) &&
      Math.hypot(h.x * size.width - face.center.x, h.y * size.height - face.center.y) <
        shoulderWidth * 0.75,
  );
}

type Ctx = CanvasRenderingContext2D;

export interface MaskColors {
  mask: string;
  maskShade: string;
  paper: string;
}

/**
 * Pleated mask centred on `center`. `t` (0..1) animates it from a smaller floating card to its
 * worn size; `alpha` lets it fade in.
 */
export function drawMask(
  ctx: Ctx,
  at: { center: Vec; width: number; angle: number; ears: [Vec, Vec] | null },
  colors: MaskColors,
  t = 1,
  alpha = 1,
): void {
  const w = at.width * (0.7 + 0.3 * t);
  const h = w * 0.62;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (at.ears && t >= 1) {
    // Ear loops first, so the mask covers their start.
    ctx.strokeStyle = colors.paper;
    ctx.lineWidth = Math.max(1.5, w * 0.025);
    for (const ear of at.ears) {
      ctx.beginPath();
      ctx.moveTo(at.center.x, at.center.y);
      ctx.quadraticCurveTo((at.center.x + ear.x) / 2, ear.y - h * 0.3, ear.x, ear.y);
      ctx.stroke();
    }
  }
  ctx.translate(at.center.x, at.center.y);
  ctx.rotate(at.angle);
  const r = h * 0.28;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + r, -h / 2);
  ctx.lineTo(w / 2 - r, -h / 2);
  ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  ctx.lineTo(w / 2, h / 2 - r);
  ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  ctx.lineTo(-w / 2 + r, h / 2);
  ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  ctx.lineTo(-w / 2, -h / 2 + r);
  ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  ctx.closePath();
  ctx.fillStyle = colors.mask;
  ctx.fill();
  // Three pleats and the nose wire.
  ctx.strokeStyle = colors.maskShade;
  ctx.lineWidth = Math.max(1.5, h * 0.05);
  for (const k of [-0.18, 0.06, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.44, h * k);
    ctx.quadraticCurveTo(0, h * (k + 0.06), w * 0.44, h * k);
    ctx.stroke();
  }
  ctx.strokeStyle = colors.paper;
  ctx.lineWidth = Math.max(2, h * 0.07);
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, -h * 0.4);
  ctx.lineTo(w * 0.18, -h * 0.4);
  ctx.stroke();
  ctx.restore();
}
