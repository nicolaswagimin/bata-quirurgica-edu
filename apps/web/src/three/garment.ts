import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Vector3,
} from 'three';
import { type Limb, v } from './clinician.ts';

export const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
export const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
type Surface = (u: number, h: number) => Vector3;

function surface(name: string, rows: number, cols: number, color: number, lined = false) {
  const geo = new BufferGeometry(),
    positions = new BufferAttribute(new Float32Array((rows + 1) * (cols + 1) * 3), 3).setUsage(
      DynamicDrawUsage,
    );
  geo.setAttribute('position', positions);
  const ix: number[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c,
        b = a + cols + 1;
      ix.push(a, a + 1, b, b, a + 1, b + 1);
    }
  geo.setIndex(ix);
  const outer = new MeshStandardMaterial({
      color,
      roughness: 0.89,
      side: DoubleSide,
    }),
    mesh = new Mesh(geo, outer);
  mesh.name = name;
  mesh.frustumCulled = false;
  if (lined) {
    outer.side = 0;
    const lining = new Mesh(
      geo,
      new MeshStandardMaterial({
        color: 0xa5d4cf,
        roughness: 0.95,
        side: BackSide,
      }),
    );
    lining.frustumCulled = false;
    mesh.add(lining);
  }
  function draw(fn: Surface) {
    let i = 0;
    for (let r = 0; r <= rows; r++)
      for (let c = 0; c <= cols; c++) {
        const p = fn(c / cols, r / rows);
        positions.setXYZ(i++, p.x, p.y, p.z);
      }
    positions.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return { mesh, draw };
}

export function gown() {
  const root = new Group();
  const body = surface('Paños y forro', 19, 48, 0x439ca4, true),
    neck = surface('Ribete del cuello', 1, 48, 0x2a606d),
    hem = surface('Dobladillo', 1, 48, 0x408b96);
  root.add(body.mesh, neck.mesh, hem.mesh);
  const sleeves = [1, -1].map(() => ({
    cloth: surface('Manga', 14, 18, 0x459da6),
    cuff: surface('Puño tejido', 6, 18, 0x366c76),
  }));
  for (const s of sleeves) root.add(s.cloth.mesh, s.cuff.mesh);
  const ties = [0, 1, 2, 3, 4].map(() => surface('Cinta', 1, 20, 0xc9e9de));
  root.add(...ties.map((t) => t.mesh));
  function update(t: number, limbs: Limb[], closure: number, gloves: number[], hands: Vector3[]) {
    // The same panel goes from a folded pack to a hanging gown, around the body, and into the bin.
    const lift = ramp(t, 1.08, 1.75),
      wear = ramp(t, 2.05, 2.96) * (1 - ramp(t, 7.04, 7.94));
    const roll = ramp(t, 8.02, 8.7),
      drop = ramp(t, 8.71, 8.98);
    const sleeveFit = ramp(t, 2.03, 2.6) * (1 - ramp(t, 7.38, 7.94));
    const topY = mix(0.975, 1.43, lift) - 0.16 * ramp(t, 7.23, 7.99);
    const away = mix(0.45, 0.42, lift) * (1 - wear);
    const width = (u: number) =>
      0.219 + 0.092 * (1 - u) ** 1.65 - 0.028 * Math.exp(-((u - 0.52) ** 2) / 0.014);
    const panel: Surface = (u, h) => {
      const a = (u - 0.5) * (Math.PI * 2 - mix(1.26, 0.1, closure));
      const flare = width(h),
        neckline = ramp(h, 0.932, 1),
        fold = 0.009 * Math.cos(12 * a + 0.7 * h) + 0.004 * Math.sin(21 * a - 1.5 * h);
      const spread = mix(0.69, 1, lift);
      const x = Math.sin(a) * (mix(flare, 0.094, neckline) + fold) * spread;
      const height = mix(0.065, 1.08, lift),
        y = topY - (1 - h) * height + 0.022 * Math.abs(Math.sin(a)) * Math.sin(Math.PI * h);
      const z =
        away +
        (Math.cos(a) * (mix(0.18 + 0.058 * (1 - h), 0.094, neckline) + fold) + 0.035) *
          mix(0.66, 1, wear) +
        0.008 * Math.sin(7 * a + 4 * h) * (1 - wear);
      const point = v(x, y, z + 0.075 * Math.sin(Math.PI * wear) * (h - 0.45));
      // Roll the outside into a spiral from hem to neckline; the lighter lining faces out.
      const angle = 2 * Math.PI * (1.6 * h + 0.16);
      // The hem travels upwards around a horizontal axis while the unrolled top stays in hand.
      const rolledLength = Math.max(0, roll - h);
      const coil = (rolledLength * height) / 0.054;
      if (rolledLength > 0) {
        const centerY = topY - (1 - roll) * height;
        point.y = centerY - 0.054 * Math.sin(coil);
        point.z += 0.054 * (1 - Math.cos(coil));
      }
      const packed = v(
        0.15 * Math.sin(a),
        1.115 + 0.052 * Math.cos(angle),
        0.39 + 0.057 * Math.sin(angle) + 0.018 * Math.cos(a),
      );
      point.lerp(packed, smooth((roll - 0.55) / 0.45));
      point.x += 0.38 * drop;
      point.y -= 0.58 * drop;
      return point;
    };
    body.draw(panel);
    const edging = (u: number, h: number) => {
      const p = panel(u, h);
      p.x *= 1.008;
      p.z += 0.0018 * Math.cos((u - 0.5) * Math.PI * 2);
      p.y += 0.001;
      return p;
    };
    neck.draw((u, h) => edging(u, 0.975 + 0.025 * h));
    hem.draw((u, h) => edging(u, 0.012 * h));
    for (const [i, limb] of limbs.entries()) {
      const sign = i === 0 ? 1 : -1,
        s = sleeves[i]!,
        shoulder = panel(sign === 1 ? 0.77 : 0.23, 0.935);
      const hanging = v(sign * 0.19, topY - 0.54 * lift - 0.01, away + 0.035),
        folded = v(sign * 0.14, 0.973, 0.47);
      hanging.lerp(folded, 1 - lift);
      const wrist = limb.wrist,
        tip = limb.tip;
      const covered = (1 - gloves[i]!) * ramp(t, 2, 2.7);
      const end = wrist
        .clone()
        .lerp(tip, covered * 1.2)
        .lerp(hanging, 1 - sleeveFit);
      const elbow = limb.elbow.clone().lerp(shoulder.clone().lerp(hanging, 0.51), 1 - wear);
      const cap = shoulder
        .clone()
        .lerp(limb.shoulder.clone().add(v(-sign * 0.035, 0.056, -0.007)), wear);
      const upper = shoulder
        .clone()
        .lerp(limb.shoulder.clone().add(v(sign * 0.01, 0.003, 0)), wear);
      const fore = elbow.clone().lerp(wrist.clone().lerp(hanging, 1 - sleeveFit), 0.55);
      const controls = [
        cap,
        upper,
        elbow,
        fore,
        fore.clone().lerp(wrist.clone().lerp(end, 1 - covered), 0.8),
        end,
      ];
      // Shape the sleeve around the actual elbow and wrist, including the change of direction at the hand.
      function centre(h: number) {
        const k = h * 5,
          i = Math.min(4, Math.floor(k)),
          u = k - i,
          p0 = controls[Math.max(0, i - 1)]!,
          p1 = controls[i]!,
          p2 = controls[i + 1]!,
          p3 = controls[Math.min(5, i + 2)]!;
        return p1
          .clone()
          .multiplyScalar(2 * u ** 3 - 3 * u * u + 1)
          .addScaledVector(p2, -2 * u ** 3 + 3 * u * u)
          .addScaledVector(p2.clone().sub(p0), 0.5 * (u ** 3 - 2 * u * u + u))
          .addScaledVector(p3.clone().sub(p1), 0.5 * (u ** 3 - u * u));
      }
      const frames = new Map<number, { origin: Vector3; cross: Vector3; across: Vector3 }>();
      function frame(h: number) {
        const cached = frames.get(h);
        if (cached) return cached;
        const origin = centre(h);
        const axis = centre(Math.min(1, h + 0.002))
          .sub(centre(Math.max(0, h - 0.002)))
          .normalize();
        if (axis.lengthSq() < 0.5) axis.copy(end).sub(elbow).normalize();
        const cross = v(0, 0, 1).cross(axis);
        if (cross.lengthSq() < 0.002) cross.copy(v(1, 0, 0).cross(axis));
        cross.normalize();
        const across = axis.clone().cross(cross);
        const result = { origin, cross, across };
        frames.set(h, result);
        return result;
      }
      const sleeve: Surface = (u, h) => {
        const { origin, cross, across } = frame(h);
        const p = origin.clone();
        const a = 2 * Math.PI * u,
          r =
            (0.071 + 0.019 * Math.sin(Math.PI * h) - 0.016 * h + 0.016 * covered * h) *
            (0.2 + 0.8 * ramp(h, 0, 0.115)) *
            (1 - 0.84 * covered * ramp(h, 0.93, 1)) *
            (1 + 0.055 * Math.cos(9 * a + 8 * h) + 0.042 * Math.cos(22 * h)) *
            (1 - 0.24 * ramp(h, 0.77, 0.85));
        p.addScaledVector(cross, r * Math.cos(a)).addScaledVector(across, r * Math.sin(a));
        p.lerp(
          v(sign * (0.14 - 0.11 * h), 1.11 + 0.05 * Math.sin(a), 0.39 + 0.05 * Math.cos(a)),
          roll,
        );
        p.x += 0.41 * drop;
        p.y -= 0.57 * drop;
        return p;
      };
      s.cloth.draw(sleeve);
      s.cuff.draw((u, h) => {
        const end = sleeve(u, 0.81 + 0.19 * h),
          mid = sleeve((u + 0.5) % 1, 0.81 + 0.19 * h);
        return end.addScaledVector(end.clone().sub(mid), 0.025 + 0.012 * Math.cos(h * 25));
      });
    }
    ties.forEach((tie, i) => {
      const front = i === 4,
        sign = i % 2 === 0 ? 1 : -1,
        height = i < 2 ? 0.954 : 0.625;
      const base = front ? panel(0.5, 0.62) : panel(sign === 1 ? 0.99 : 0.01, height);
      const tieProgress = front ? ramp(t, 5, 5.96) * (1 - ramp(t, 6.05, 6.34)) : closure;
      tie.mesh.visible = wear > 0.12 && (!front || t > 5);
      tie.draw((u, h) => {
        const p = base.clone(),
          a = u * 2 * Math.PI;
        p.x += sign * (0.09 * Math.sin(a) * tieProgress + 0.14 * u * (1 - tieProgress));
        p.y -= 0.15 * u * (1 - tieProgress) + 0.026 * (1 - Math.cos(a)) * tieProgress;
        p.z += (front ? 1 : -1) * 0.024 * Math.sin(Math.PI * u);
        if (front && t > 5 && t < 5.75)
          p.lerp(hands[0]!, u * ramp(t, 5.02, 5.25) * (1 - ramp(t, 5.52, 5.75)));
        p.y += (h - 0.5) * 0.011;
        return p;
      });
    });
    return {
      cuello: panel(0.5, 0.998),
      'cierre-posterior': panel(0.99, 0.62),
      'zona-esteril': panel(0.5, 0.76),
      mangas: limbs[0]!.elbow,
      punos: limbs[1]!.wrist,
    };
  }
  return { root, update };
}
