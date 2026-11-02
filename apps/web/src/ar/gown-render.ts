// Paints the deformable gown of gown-mesh.ts: a procedural SMS non-woven fabric mapped onto every
// cell with a per-triangle affine transform (so the weave bends with the body), side shading for
// volume, knit cuffs, waist ties and neckline binding. Colours come from the design tokens.
import type { GownMesh, Quad } from './gown-mesh.ts';
import type { Vec } from './posture.ts';

export interface GownColors {
  fabric: string;
  trim: string;
  paper: string;
}

export interface GownTextures {
  fabric: CanvasPattern;
  knit: CanvasPattern;
}

type Ctx = CanvasRenderingContext2D;

/** Deterministic PRNG so the fabric looks the same on every load. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds the two tiles once per session; returns null where 2D canvases are unavailable. */
export function createGownTextures(ctx: Ctx, colors: GownColors): GownTextures | null {
  const fabricTile = document.createElement('canvas');
  fabricTile.width = 256;
  fabricTile.height = 256;
  const f = fabricTile.getContext('2d');
  const knitTile = document.createElement('canvas');
  knitTile.width = 40;
  knitTile.height = 24;
  const k = knitTile.getContext('2d');
  if (!f || !k) return null;

  // SMS non-woven: flat base, fine light/dark speckle and short random fibres.
  const rand = mulberry32(13795);
  f.fillStyle = colors.fabric;
  f.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    f.globalAlpha = 0.05 + rand() * 0.07;
    f.fillStyle = rand() > 0.5 ? colors.paper : colors.trim;
    f.fillRect(rand() * 256, rand() * 256, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
  f.lineWidth = 0.6;
  for (let i = 0; i < 220; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const a = rand() * Math.PI;
    const l = 4 + rand() * 10;
    f.globalAlpha = 0.06;
    f.strokeStyle = colors.paper;
    f.beginPath();
    f.moveTo(x, y);
    f.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    f.stroke();
  }
  f.globalAlpha = 1;

  // Knit cuff: ribs running along the forearm.
  k.fillStyle = colors.trim;
  k.fillRect(0, 0, 40, 24);
  for (let x = 0; x < 40; x += 5) {
    k.fillStyle = colors.paper;
    k.globalAlpha = 0.14;
    k.fillRect(x, 0, 2, 24);
  }
  k.globalAlpha = 1;

  const fabric = ctx.createPattern(fabricTile, 'repeat');
  const knit = ctx.createPattern(knitTile, 'repeat');
  return fabric && knit ? { fabric, knit } : null;
}

/** Affine map taking the uv triangle onto the screen triangle. */
function affine(uv: [Vec, Vec, Vec], p: [Vec, Vec, Vec]) {
  const [a, b, c] = uv;
  const [x, y, z] = p;
  const du1 = b.x - a.x;
  const dv1 = b.y - a.y;
  const du2 = c.x - a.x;
  const dv2 = c.y - a.y;
  const det = du1 * dv2 - du2 * dv1 || 1e-6;
  const m11 = ((y.x - x.x) * dv2 - (z.x - x.x) * dv1) / det;
  const m12 = ((z.x - x.x) * du1 - (y.x - x.x) * du2) / det;
  const m21 = ((y.y - x.y) * dv2 - (z.y - x.y) * dv1) / det;
  const m22 = ((z.y - x.y) * du1 - (y.y - x.y) * du2) / det;
  return {
    a: m11,
    b: m21,
    c: m12,
    d: m22,
    e: x.x - m11 * a.x - m12 * a.y,
    f: x.y - m21 * a.x - m22 * a.y,
  };
}

/** Grows a triangle by ~0.6 px so neighbouring clips leave no hairline seams. */
function inflate(p: [Vec, Vec, Vec]): [Vec, Vec, Vec] {
  const cx = (p[0].x + p[1].x + p[2].x) / 3;
  const cy = (p[0].y + p[1].y + p[2].y) / 3;
  return p.map((q) => {
    const dx = q.x - cx;
    const dy = q.y - cy;
    const l = Math.hypot(dx, dy) || 1;
    return { x: q.x + (dx / l) * 0.6, y: q.y + (dy / l) * 0.6 };
  }) as [Vec, Vec, Vec];
}

function texturedTriangle(
  ctx: Ctx,
  pattern: CanvasPattern,
  p: [Vec, Vec, Vec],
  uv: [Vec, Vec, Vec],
) {
  const q = inflate(p);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(q[0].x, q[0].y);
  ctx.lineTo(q[1].x, q[1].y);
  ctx.lineTo(q[2].x, q[2].y);
  ctx.closePath();
  ctx.clip();
  const m = affine(uv, p);
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  const minU = Math.min(uv[0].x, uv[1].x, uv[2].x) - 2;
  const minV = Math.min(uv[0].y, uv[1].y, uv[2].y) - 2;
  const maxU = Math.max(uv[0].x, uv[1].x, uv[2].x) + 2;
  const maxV = Math.max(uv[0].y, uv[1].y, uv[2].y) + 2;
  ctx.fillStyle = pattern;
  ctx.fillRect(minU, minV, maxU - minU, maxV - minV);
  ctx.restore();
}

function quadPath(ctx: Ctx, quad: Quad) {
  const [a, b, c, d] = quad.p;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

function paintQuads(ctx: Ctx, quads: Quad[], pattern: CanvasPattern) {
  for (const quad of quads) {
    const [a, b, c, d] = quad.p;
    const [ua, ub, uc, ud] = quad.uv;
    texturedTriangle(ctx, pattern, [a, b, c], [ua, ub, uc]);
    texturedTriangle(ctx, pattern, [a, c, d], [ua, uc, ud]);
  }
}

/** "#rrggbb" + alpha → "rgba(r, g, b, a)" for gradient stops. */
function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.trim().replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Body outline: right seam down, along the hem, left seam back up. */
function bodyOutline(mesh: GownMesh): Vec[] {
  const rows = mesh.body.length / 6;
  const left = mesh.body.filter((_, i) => i % 6 === 5).map((q) => q.p[1]);
  const right = mesh.body.filter((_, i) => i % 6 === 0).map((q) => q.p[0]);
  const lastRow = mesh.body.slice((rows - 1) * 6);
  const hem = [lastRow[0]?.p[3], ...lastRow.map((q) => q.p[2])].filter((p): p is Vec => !!p);
  return [...right, ...hem, ...left.reverse()];
}

/**
 * Volume in one pass over the whole silhouette (per-cell fills leave hairlines at the seams):
 * the cloth darkens as it turns away from the camera towards the side seams.
 */
function shadeBody(ctx: Ctx, mesh: GownMesh, outline: Vec[], trim: string, depth: number) {
  const mid = Math.floor(mesh.body.length / 12) * 6;
  const row = mesh.body.slice(mid, mid + 6);
  const from = row[0]?.p[0];
  const to = row[5]?.p[1];
  if (!from || !to) return;
  const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  g.addColorStop(0, rgba(trim, depth));
  g.addColorStop(0.22, rgba(trim, depth * 0.18));
  g.addColorStop(0.5, rgba(trim, 0));
  g.addColorStop(0.78, rgba(trim, depth * 0.18));
  g.addColorStop(1, rgba(trim, depth));
  ctx.save();
  polyline(ctx, outline);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function polyline(ctx: Ctx, points: readonly Vec[]) {
  const [first, ...rest] = points;
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const p of rest) ctx.lineTo(p.x, p.y);
}

export function drawGownMesh(
  ctx: Ctx,
  mesh: GownMesh,
  textures: GownTextures,
  colors: GownColors,
  shoulderWidth: number,
  activeHotspot: string | null,
): void {
  const unit = shoulderWidth / 200;
  ctx.save();
  ctx.globalAlpha = 1;
  // Body first, then sleeves and cuffs on top: forearms held in front must cover the chest.
  const outline = bodyOutline(mesh);
  paintQuads(ctx, mesh.body, textures.fabric);
  shadeBody(ctx, mesh, outline, colors.trim, 0.5);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = colors.trim;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, 1.5 * unit);
  polyline(ctx, outline);
  ctx.closePath();
  ctx.stroke();

  ctx.globalAlpha = 1;
  paintQuads(ctx, mesh.sleeves, textures.fabric);
  paintQuads(ctx, mesh.cuffs, textures.knit);
  // Sleeve seams: each sleeve outlined as one tube (shoulder, elbow, cuff), not per segment.
  ctx.globalAlpha = 0.55;
  for (let s = 0; s + 1 < mesh.sleeves.length; s += 2) {
    const upper = mesh.sleeves[s];
    const lower = mesh.sleeves[s + 1];
    if (!upper || !lower) continue;
    polyline(ctx, [upper.p[0], lower.p[0], lower.p[3]]);
    ctx.stroke();
    polyline(ctx, [upper.p[1], lower.p[1], lower.p[2]]);
    ctx.stroke();
  }
  for (const cuff of mesh.cuffs) {
    quadPath(ctx, cuff);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = Math.max(1, 2 * unit);
  for (const col of [2, 4]) {
    const fold = mesh.body.filter((_, i) => i % 6 === col && i >= 3 * 6).map((q) => q.p[0]);
    polyline(ctx, fold);
    ctx.stroke();
  }

  // Neckline binding and waist ties in the trim colour.
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(2, 7 * unit);
  polyline(ctx, mesh.neckline);
  ctx.stroke();
  ctx.lineWidth = Math.max(2, 6 * unit);
  for (const tie of mesh.ties) {
    polyline(ctx, tie);
    ctx.stroke();
  }
  const knot = mesh.ties[0]?.[0];
  if (knot) {
    ctx.fillStyle = colors.trim;
    ctx.beginPath();
    ctx.arc(knot.x, knot.y, 7 * unit, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hotspot markers: paper dot with a trim ring; the selected one grows.
  for (const spot of mesh.hotspots) {
    const r = (spot.id === activeHotspot ? 11 : 6) * unit + 2;
    ctx.fillStyle = colors.paper;
    ctx.strokeStyle = colors.trim;
    ctx.lineWidth = Math.max(1.5, 2.5 * unit);
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
