// The gown "hanging" in front of the player before they put it on. Built with the same gownMesh
// as the worn gown (from a synthetic, arms-down body frame placed in front of the chest), so the
// two meshes share topology and the donning animation is a point-by-point interpolation.
import type { GownMesh, Quad } from './gown-mesh.ts';
import type { BodyFrame, Vec } from './posture.ts';

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });

/**
 * A frame for the hanging gown: centred on the player, a little higher and narrower, arms hanging
 * straight down, shorter skirt. `bob` (px) adds the gentle sway of a gown held up by its neck.
 */
export function hangingFrame(body: BodyFrame, bob = 0): BodyFrame {
  const { across, down } = body;
  const sw = body.shoulderWidth * 0.92;
  const th = body.torsoHeight * 0.95;
  const top = add(add(body.shoulderMid, scale(down, -body.torsoHeight * 0.08)), { x: 0, y: bob });
  const L = add(top, scale(across, sw / 2));
  const R = add(top, scale(across, -sw / 2));
  const hipMid = add(top, scale(down, th));
  const hang = (shoulder: Vec, side: number) => {
    const elbow = add(shoulder, add(scale(down, th * 0.42), scale(across, side * sw * 0.08)));
    return { shoulder, elbow, wrist: add(elbow, scale(down, th * 0.4)), wristDepth: 0 };
  };
  const knee = (side: number) =>
    add(hipMid, add(scale(down, th * 0.55), scale(across, side * sw * 0.22)));
  return {
    shoulderMid: top,
    hipMid,
    down,
    across,
    shoulderWidth: sw,
    torsoHeight: th,
    left: hang(L, 1),
    right: hang(R, -1),
    knees: { left: knee(1), right: knee(-1) },
    ankles: { left: null, right: null },
  };
}

/** Sleeve openings of the hanging gown, where the wrists go in. */
export function sleeveOpenings(hanging: BodyFrame): [Vec, Vec] {
  const { across, down, shoulderWidth: sw, torsoHeight: th } = hanging;
  const opening = (shoulder: Vec, side: number) =>
    add(shoulder, add(scale(across, side * sw * 0.12), scale(down, th * 0.1)));
  return [opening(hanging.left.shoulder, 1), opening(hanging.right.shoulder, -1)];
}

const lerpV = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

function lerpQuads(a: Quad[], b: Quad[], t: number): Quad[] {
  return b.map((q, i) => {
    const from = a[i] ?? q;
    return {
      ...q,
      p: q.p.map((p, k) => lerpV(from.p[k] as Vec, p, t)) as Quad['p'],
    };
  });
}

/** Ease-out cubic: fast start, settles on the body. */
export const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** Interpolates the hanging gown onto the body (`t` 0 → hanging, 1 → worn). */
export function lerpMesh(hanging: GownMesh, worn: GownMesh, t: number): GownMesh {
  const k = easeOut(t);
  return {
    body: lerpQuads(hanging.body, worn.body, k),
    sleeves: lerpQuads(hanging.sleeves, worn.sleeves, k),
    cuffs: lerpQuads(hanging.cuffs, worn.cuffs, k),
    ties: worn.ties.map((tie, i) => tie.map((p, j) => lerpV(hanging.ties[i]?.[j] ?? p, p, k))),
    neckline: worn.neckline.map((p, i) => lerpV(hanging.neckline[i] ?? p, p, k)),
    hotspots: worn.hotspots,
  };
}
