import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  SphereGeometry,
  type Vector3,
} from 'three';
import { clinician, v } from './clinician.ts';
import { gown, ramp, smooth } from './garment.ts';

export const PROCEDURE_MODEL = '/models/paso-1-anim.glb';
export const CHAPTER_SECONDS = 6;
type Key = [number, number, number, number];
function path(keys: Key[], t: number) {
  const next = keys.findIndex((k) => k[0] > t);
  const a = keys[next === 0 ? 0 : next < 0 ? keys.length - 1 : next - 1]!,
    b = keys[next < 0 ? keys.length - 1 : next]!;
  return v(a[1], a[2], a[3]).lerp(v(b[1], b[2], b[3]), smooth((t - a[0]) / (b[0] - a[0] || 1)));
}
// Wrist destinations in metres relative to the nurse. Explicit contact poses separate grasp,
// sleeve entry, assisted fastening, rolling the garment and releasing it over the container.
const reach: Key[] = [
  [0, 0.09, 1.11, 0.28],
  [0.25, 0.06, 1.19, 0.25],
  [0.52, 0.16, 1.19, 0.24],
  [0.76, 0.07, 1.22, 0.25],
  [0.92, 0.18, 1.2, 0.24],
  [1.1, 0.14, 1.04, 0.36],
  [1.35, 0.14, 1.14, 0.38],
  [1.8, 0.18, 1.37, 0.34],
  [2, 0.18, 1.36, 0.35],
  [2.28, 0.18, 1.26, 0.26],
  [2.58, 0.2, 1.27, 0.4],
  [2.96, 0.2, 1.26, 0.45],
  [3.35, 0.126, 1.23, 0.255],
  [3.97, 0.126, 1.23, 0.255],
  [4.18, 0.083, 1.19, 0.28],
  [4.43, 0.13, 1.21, 0.31],
  [4.67, 0.083, 1.19, 0.275],
  [4.92, 0.14, 1.21, 0.29],
  [5.12, 0.11, 1.03, 0.24],
  [5.38, 0.37, 1.16, 0.22],
  [5.72, 0.16, 1.07, 0.21],
  [6, 0.075, 1.02, 0.2],
  [6.36, 0.21, 1.04, 0.255],
  [6.75, 0.135, 1.22, 0.27],
  [7, 0.14, 1.24, 0.26],
  [7.2, 0.13, 1.36, 0.17],
  [7.48, 0.185, 1.29, 0.325],
  [7.92, 0.17, 1.24, 0.375],
  [8.16, 0.12, 1.04, 0.32],
  [8.35, 0.16, 1.21, 0.34],
  [8.53, 0.12, 1.1, 0.34],
  [8.72, 0.11, 1.12, 0.37],
  [8.88, 0.29, 1.06, 0.31],
  [9, 0.145, 1.13, 0.26],
  [9.18, 0.065, 1.15, 0.27],
  [9.42, 0.14, 1.22, 0.25],
  [9.6, 0.055, 1.14, 0.26],
  [9.76, 0.09, 1.15, 0.26],
  [10, 0.135, 1.21, 0.25],
];
function solid(color: number) {
  return new MeshStandardMaterial({ color, roughness: 0.72 });
}
function box(
  parent: Group,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
) {
  const m = new Mesh(new BoxGeometry(w, h, d), solid(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function gloveProp() {
  const g = new Group(),
    mat = solid(0xd8eee2);
  function pad(x: number, y: number, rx: number, ry: number, angle = 0) {
    const m = new Mesh(new SphereGeometry(1, 12, 8), mat);
    m.scale.set(rx, ry, 0.014);
    m.position.set(x, y, 0);
    m.rotation.z = angle;
    g.add(m);
  }
  pad(0, 0, 0.043, 0.054);
  for (let i = 0; i < 4; i++)
    pad((i - 1.5) * 0.019, 0.052, 0.011, 0.04 - Math.abs(i - 1.4) * 0.006);
  pad(-0.04, 0.009, 0.013, 0.032, 0.7);
  return g;
}
export function createProcedure(source: Object3D) {
  const scene = new Group(),
    stage = new Group(),
    actor = clinician(source),
    helper = clinician(source, true),
    cloth = gown();
  scene.add(stage);
  stage.add(actor.root, cloth.root);
  scene.add(helper.root);
  // A low trolley is moved clear once the gown has been lifted.
  const trolley = new Group();
  scene.add(trolley);
  box(trolley, 0.62, 0.023, 0.32, 0xbacbc9, 0, 0.924, 0.48);
  for (const x of [-0.265, 0.265])
    for (const z of [0.36, 0.6]) box(trolley, 0.018, 0.88, 0.018, 0x94a5a8, x, 0.47, z);
  const bin = new Group();
  bin.position.set(0.42, 0, 0.395);
  scene.add(bin);
  const binBody = new Mesh(new CylinderGeometry(0.185, 0.145, 0.7, 40, 1, true), solid(0x93675e));
  binBody.material.side = DoubleSide;
  binBody.position.y = 0.35;
  bin.add(binBody);
  const inside = new Mesh(new CylinderGeometry(0.166, 0.13, 0.18, 40), solid(0x493d40));
  inside.position.y = 0.42;
  bin.add(inside);
  const rim = new Mesh(new CylinderGeometry(0.194, 0.194, 0.033, 40, 1, true), solid(0xb79f94));
  rim.position.y = 0.7;
  rim.material.side = DoubleSide;
  bin.add(rim);
  const towel = box(stage, 0.19, 0.017, 0.15, 0xf4f2da, 0, 1.17, 0.29);
  const looseGlove = gloveProp();
  stage.add(looseGlove);
  const hotspots: Record<string, Vector3> = {};
  function draw(t: number) {
    const turn = ramp(t, 5.3, 5.85) * Math.PI * 1.7;
    // Rotate the garment with its wearer; finish the turn before starting removal.
    stage.rotation.y = turn + (Math.PI * 2 - Math.PI * 1.7) * ramp(t, 5.85, 6);
    const moving = ramp(t, 2.95, 3.3) * (1 - ramp(t, 6.75, 7.2));
    helper.root.visible = moving > 0.001;
    helper.root.position.set(0.04 + 0.84 * (1 - moving), 0, -0.55);
    helper.root.rotation.y = -0.1;
    const left = path(reach, t),
      right = left.clone();
    right.x *= -1;
    const rubbing = t < 0.95 || t > 9.73 ? Math.sin(t * 33) * 0.03 : 0;
    left.y += rubbing;
    right.y -= rubbing;
    if (t > 4 && t < 5) {
      const catchCuff = Math.sin(2 * Math.PI * (t - 4));
      left.x -= 0.07 * Math.max(0, catchCuff);
      right.x += 0.07 * Math.max(0, -catchCuff);
    }
    if (t > 5 && t < 5.76) right.x = Math.max(-0.12, right.x);
    if (t > 8.55 && t < 9) {
      const carry = ramp(t, 8.55, 8.86) * (1 - ramp(t, 8.86, 9));
      right.x += 0.34 * carry;
    }
    const wrists = [left, right];
    const gloves = [
      ramp(t, 4.13, 4.46) * (1 - ramp(t, 9.1, 9.3)),
      ramp(t, 4.55, 4.87) * (1 - ramp(t, 9.44, 9.65)),
    ];
    actor.gloves.forEach((g, i) => {
      g.visible = gloves[i]! > 0.48;
    });
    const extended =
      ramp(t, 1.01, 1.31) * (1 - ramp(t, 2.98, 3.31)) +
      ramp(t, 7.18, 7.68) * (1 - ramp(t, 8.64, 9));
    actor.handState.value.set(
      ...([0, 1].map((i) => (gloves[i]! > 0.48 ? 1 : t > 2.53 && t < 5 ? -1 : 0)) as [
        number,
        number,
      ]),
      0,
    );
    const limbs = wrists.map((p, i) => {
      const sign = i === 0 ? 1 : -1;
      const finger = v(
        -sign * (0.36 + 0.23 * (1 - extended)),
        0.61 - 0.69 * extended,
        0.6 + 0.31 * extended,
      );
      return (i === 0 ? actor.left : actor.right)(p, finger);
    });
    const closure = ramp(t, 3.23, 3.9) * (1 - ramp(t, 6.28, 6.84));
    Object.assign(hotspots, cloth.update(t, limbs, closure, gloves, wrists));
    // The assistant brings both hands together at the neck, then reaches down to the waist.
    if (helper.root.visible) {
      const waist = ramp(t, 3.46, 3.7) * (1 - ramp(t, 6.47, 6.7));
      const tying = Math.sin(t * 27) * 0.018;
      const transfer = ramp(t, 5.08, 5.34) * (1 - ramp(t, 5.63, 5.85));
      for (const [i, arm] of [helper.left, helper.right].entries()) {
        const sign = i === 0 ? 1 : -1;
        const anchor = v(sign * (0.048 + tying), 1.35 - 0.34 * waist, -0.175).lerp(
          v(0.36, 1.17, 0.08),
          transfer,
        );
        arm(helper.root.worldToLocal(scene.localToWorld(anchor)), v(-sign * 0.2, 0.12, 0.9));
      }
    }
    trolley.position.x = -1.4 * ramp(t, 1.68, 2.08);
    trolley.visible = t < 2.09;
    bin.visible = t > 7.83;
    bin.scale.setScalar(Math.max(0.001, ramp(t, 7.83, 8.02)));
    towel.visible = t < 0.88;
    towel.position.copy(left).lerp(right, 0.5);
    towel.position.y += 0.043;
    towel.rotation.z = 0.45 * Math.sin(t * 11);
    looseGlove.visible =
      (t >= 4.08 && t < 4.44) || (t >= 4.52 && t < 4.86) || (t >= 9.18 && t < 9.74);
    const hand = t < 4.5 || t > 9.45 ? limbs[0]! : limbs[1]!;
    looseGlove.position.copy(hand.tip);
    looseGlove.position.y += 0.025;
    looseGlove.rotation.set(0.75, 0.25, Math.sin(t * 9) * 0.42);
    if (t > 9.58) looseGlove.position.lerp(v(0.42, 0.59, 0.395), ramp(t, 9.58, 9.74));
    looseGlove.scale.setScalar(t > 9.18 ? 0.72 : 1);
    return hotspots;
  }
  draw(0);
  return {
    scene,
    draw,
    dispose() {
      actor.dispose();
      helper.dispose();
      for (const root of [cloth.root, trolley, bin, towel, looseGlove])
        root.traverse((o) => {
          if (o instanceof Mesh) {
            o.geometry.dispose();
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
          }
        });
    },
  };
}
