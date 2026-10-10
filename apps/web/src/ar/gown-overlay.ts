// Pure gown geometry for the AR mirror: canvas pixels from an anchor. `drawGown` is the only part
// that touches a canvas, and it takes the context as a parameter so the geometry stays DOM-free.
import type { Anchor } from './overlay-math.ts';

export type HotspotId = 'cuello' | 'punos' | 'zona-esteril' | 'mangas' | 'cierre-posterior';

export interface Point {
  x: number;
  y: number;
}

export interface GownShape {
  kind: 'body' | 'sleeve';
  points: Point[];
}

export interface GownHotspot {
  id: HotspotId;
  x: number;
  y: number;
}

export interface GownGeometry {
  shapes: GownShape[];
  hotspots: GownHotspot[];
}

export const HEM_WIDTH_FACTOR = 1.4;
const SLEEVE_LENGTH_FACTOR = 0.85; // of torso height
const SLEEVE_WIDTH_FACTOR = 0.28; // of shoulder width
const SLEEVE_SPREAD_FACTOR = 0.25; // how far the cuff drifts outwards, of shoulder width

// Local frame: origin at the torso center, +x towards the left shoulder (landmark 11), +y down.
// Every point is then rotated by the shoulder angle and moved to the anchor center.
export function gownGeometry(anchor: Anchor | null): GownGeometry {
  if (!anchor) return { shapes: [], hotspots: [] };
  const { centerX, centerY, shoulderWidthPx: w, torsoHeightPx: h, angleRad } = anchor;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const place = (x: number, y: number): Point => ({
    x: centerX + x * cos - y * sin,
    y: centerY + x * sin + y * cos,
  });

  const top = -h / 2;
  const hem = h / 2;
  const halfHem = (w * HEM_WIDTH_FACTOR) / 2;
  const sleeveLength = h * SLEEVE_LENGTH_FACTOR;
  const sleeveWidth = w * SLEEVE_WIDTH_FACTOR;
  const spread = w * SLEEVE_SPREAD_FACTOR;

  const body: GownShape = {
    kind: 'body',
    points: [place(-w / 2, top), place(w / 2, top), place(halfHem, hem), place(-halfHem, hem)],
  };
  const sleeve = (side: 1 | -1): GownShape => ({
    kind: 'sleeve',
    points: [
      place((side * w) / 2, top),
      place(side * (w / 2 + sleeveWidth), top + sleeveWidth / 2),
      place(side * (w / 2 + spread + sleeveWidth), top + sleeveLength),
      place(side * (w / 2 + spread), top + sleeveLength),
    ],
  });

  const hotspot = (id: HotspotId, x: number, y: number): GownHotspot => ({ id, ...place(x, y) });
  return {
    shapes: [body, sleeve(1), sleeve(-1)],
    hotspots: [
      hotspot('cuello', 0, top),
      hotspot('zona-esteril', 0, top + h * 0.35),
      hotspot('mangas', -(w / 2 + spread / 2 + sleeveWidth / 2), top + sleeveLength / 2),
      hotspot('punos', -(w / 2 + spread + sleeveWidth / 2), top + sleeveLength),
      // The wrap-around back flap shows at the side seam from the front.
      hotspot('cierre-posterior', halfHem * 0.9, hem - h * 0.15),
    ],
  };
}

const HOTSPOT_RADIUS = 10;
const GOWN_ALPHA = 0.45;

type DrawContext = Pick<
  CanvasRenderingContext2D,
  'beginPath' | 'moveTo' | 'lineTo' | 'closePath' | 'fill' | 'stroke' | 'arc'
> & { fillStyle: CanvasRenderingContext2D['fillStyle']; globalAlpha: number; lineWidth: number };

export function drawGown(ctx: DrawContext, geometry: GownGeometry, color: string): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = GOWN_ALPHA;
  for (const shape of geometry.shapes) {
    const [first, ...rest] = shape.points;
    if (!first) continue;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const p of rest) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const spot of geometry.hotspots) {
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, HOTSPOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}
