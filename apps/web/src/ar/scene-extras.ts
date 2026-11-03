// Late-game scene pieces for the AR mirror: the circulating nurse's hands tying the back ties,
// the sterile gloves put on with the closed technique, and the wrap-around flap. Geometry comes
// from the posture body frame; drawing takes the context as a parameter.
import type { GownMesh } from './gown-mesh.ts';
import type { Landmark } from './overlay-math.ts';
import type { BodyFrame, Vec } from './posture.ts';

type Ctx = CanvasRenderingContext2D;

export interface ExtraColors {
  trim: string;
  paper: string;
  fabric: string;
  glove: string;
  gloveShade: string;
  circulanteGlove: string;
  circulanteCuff: string;
}

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const lerp = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ease = (t: number) => 1 - (1 - clamp01(t)) ** 3;

/** Where the ties are fastened: behind the neck, and at the waist on the wearer's left side. */
export function tiePoints(body: BodyFrame): { neck: Vec; waist: Vec } {
  const { across, down, shoulderWidth: sw, torsoHeight: th } = body;
  return {
    neck: add(body.shoulderMid, scale(down, -th * 0.04)),
    waist: add(add(body.shoulderMid, scale(down, th * 0.72)), scale(across, sw * 0.5)),
  };
}

function bow(ctx: Ctx, at: Vec, size: number, t: number, color: string) {
  const k = ease(t);
  if (k <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.18);
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(
      at.x + side * size * 0.45 * k,
      at.y,
      size * 0.45 * k,
      size * 0.28 * k,
      side * 0.3,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.lineTo(at.x + side * size * 0.35 * k, at.y + size * 0.9 * k);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(at.x, at.y, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A gloved hand with a gown cuff, pointing along `dir`. */
function hand(ctx: Ctx, at: Vec, dir: Vec, size: number, glove: string, cuff: string) {
  const angle = Math.atan2(dir.y, dir.x);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.fillStyle = cuff;
  ctx.beginPath();
  ctx.roundRect(-size * 2.6, -size * 0.46, size * 2.2, size * 0.92, size * 0.3);
  ctx.fill();
  ctx.fillStyle = glove;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.55, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let f = -1.5; f <= 1.5; f += 1) {
    ctx.beginPath();
    ctx.ellipse(size * 0.6, f * size * 0.18, size * 0.32, size * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Bows where the ties are fastened: they grow as the nurse finishes each tie, then stay. */
export function drawTieBows(
  ctx: Ctx,
  body: BodyFrame,
  t: number,
  colors: ExtraColors,
  tied: boolean,
) {
  const { neck, waist } = tiePoints(body);
  const bowSize = body.shoulderWidth * 0.12;
  const neckPhase = clamp01(t / 0.45);
  const waistPhase = clamp01((t - 0.5) / 0.45);
  bow(ctx, neck, bowSize, tied ? 1 : clamp01((neckPhase - 0.6) / 0.4), colors.trim);
  bow(ctx, waist, bowSize, tied ? 1 : clamp01((waistPhase - 0.6) / 0.4), colors.trim);
}

/**
 * The circulating nurse ties the gown from behind: first the neck ties (t 0–0.45), then the waist
 * ties (0.5–0.95). Draw this BEFORE the gown so the body hides the hands and only what reaches past
 * the silhouette shows, as when someone works behind you.
 */
export function drawCirculante(ctx: Ctx, body: BodyFrame, t: number, colors: ExtraColors) {
  const { neck, waist } = tiePoints(body);
  const sw = body.shoulderWidth;
  const size = sw * 0.26;
  const up = scale(body.down, -1);
  const outL = add(body.left.shoulder, add(scale(body.across, sw * 0.3), scale(up, sw * 0.25)));
  const outR = add(body.right.shoulder, add(scale(body.across, -sw * 0.3), scale(up, sw * 0.25)));
  const neckPhase = clamp01(t / 0.45);
  const waistPhase = clamp01((t - 0.5) / 0.45);
  const glove = colors.circulanteGlove;
  const cuff = colors.circulanteCuff;
  if (t < 0.48) {
    const k = ease(neckPhase / 0.6);
    const l = lerp(outL, add(neck, scale(body.across, sw * 0.16)), k);
    const r = lerp(outR, add(neck, scale(body.across, -sw * 0.16)), k);
    hand(ctx, l, scale(body.across, -1), size, glove, cuff);
    hand(ctx, r, body.across, size, glove, cuff);
  } else if (t < 0.97) {
    const side = add(waist, scale(body.across, sw * 0.14));
    const k = ease(waistPhase / 0.6);
    const a = lerp(outL, add(side, scale(up, sw * 0.1)), k);
    const b = lerp(add(outL, scale(body.down, sw * 0.9)), add(side, scale(body.down, sw * 0.1)), k);
    hand(ctx, a, scale(body.across, -1), size, glove, cuff);
    hand(ctx, b, scale(body.across, -1), size, glove, cuff);
  }
}

/**
 * Closed-technique gloves: the hands stay inside the cuffs, then each glove slides on and covers
 * the knit cuff (`t` 0 → bare cuffs, 1 → gloved).
 */
export function drawGloves(
  ctx: Ctx,
  body: BodyFrame,
  mesh: GownMesh,
  landmarks: readonly Landmark[],
  size: { width: number; height: number },
  t: number,
  colors: ExtraColors,
) {
  const k = ease(t);
  if (k <= 0) return;
  const limbs = [
    { wrist: body.left.wrist, elbow: body.left.elbow, tip: landmarks[19], cuff: mesh.cuffs[0] },
    { wrist: body.right.wrist, elbow: body.right.elbow, tip: landmarks[20], cuff: mesh.cuffs[1] },
  ];
  for (const { wrist, elbow, tip, cuff } of limbs) {
    if (!wrist) continue;
    const tipPx =
      tip && (tip.visibility ?? 0) >= 0.5
        ? { x: tip.x * size.width, y: tip.y * size.height }
        : null;
    const dir = tipPx
      ? { x: tipPx.x - wrist.x, y: tipPx.y - wrist.y }
      : elbow
        ? { x: wrist.x - elbow.x, y: wrist.y - elbow.y }
        : body.down;
    const len = Math.hypot(dir.x, dir.y) || 1;
    const unit = { x: dir.x / len, y: dir.y / len };
    const handSize = body.shoulderWidth * 0.22;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 2);
    // The glove's own cuff slides up over the knit cuff of the gown.
    if (cuff) {
      const [a, b, c, d] = cuff.p;
      ctx.fillStyle = colors.glove;
      ctx.beginPath();
      ctx.moveTo(lerp(d, a, k).x, lerp(d, a, k).y);
      ctx.lineTo(lerp(c, b, k).x, lerp(c, b, k).y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = colors.gloveShade;
      ctx.lineWidth = Math.max(1.5, handSize * 0.08);
      ctx.stroke();
    }
    hand(ctx, add(wrist, scale(unit, handSize * 0.5)), unit, handSize, colors.glove, colors.glove);
    ctx.restore();
  }
}

/**
 * The wrap-around flap: while the player turns, a panel sweeps from the left side seam across the
 * back; once closed a diagonal overlap seam stays on the front.
 */
export function drawFlap(
  ctx: Ctx,
  body: BodyFrame,
  t: number,
  closed: boolean,
  colors: ExtraColors,
) {
  const { across, down, shoulderWidth: sw, torsoHeight: th } = body;
  const top = add(body.shoulderMid, scale(down, th * 0.15));
  const seamTop = add(top, scale(across, sw * 0.55));
  const seamBottom = add(add(body.shoulderMid, scale(down, th * 1.7)), scale(across, sw * 0.6));
  ctx.save();
  ctx.lineCap = 'round';
  if (closed) {
    ctx.strokeStyle = colors.trim;
    ctx.lineWidth = Math.max(2, sw * 0.025);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(seamTop.x, seamTop.y);
    ctx.lineTo(lerp(seamTop, seamBottom, 1).x - across.x * sw * 0.15, seamBottom.y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const k = ease(t);
  const reach = sw * 0.7 * k;
  ctx.fillStyle = colors.fabric;
  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = Math.max(2, sw * 0.02);
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  ctx.moveTo(seamTop.x, seamTop.y);
  ctx.lineTo(seamTop.x - across.x * reach, seamTop.y - across.y * reach);
  ctx.lineTo(seamBottom.x - across.x * reach * 0.8, seamBottom.y - across.y * reach * 0.8);
  ctx.lineTo(seamBottom.x, seamBottom.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
