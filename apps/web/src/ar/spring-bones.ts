// biome-ignore-all lint/style/noNonNullAssertion: Indices are bounded by matching chain lengths or explicit test fixtures.
/** Metres in camera space: x right, y down, z away from the camera. */
export type Vec3 = { x: number; y: number; z: number };
export interface Capsule {
  a: Vec3;
  b: Vec3;
  radius: number;
}
export interface SpringChainSpec {
  id: string;
  restLengths: number[];
  /** Pull toward the animated direction per 1/120 s step, in [0, 1]. */
  stiffness: number;
  /** Fraction of velocity removed per step, in [0, 1]. */
  damping: number;
  /** Acceleration in m/s²; positive y points down. */
  gravity: number;
  /** Additional exponential velocity attenuation in s⁻¹ (default 0). */
  dragFactor?: number;
  radius: number;
}
export interface SpringInput {
  dt: number;
  roots: Record<string, Vec3>;
  restDirections: Record<string, Vec3[]>;
  capsules: Capsule[];
  reducedMotion?: boolean;
}
export type Quaternion = Vec3 & { w: number };
const STEP = 1 / 120;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const add = (a: Vec3, b: Vec3, scale = 1): Vec3 => ({
  x: a.x + b.x * scale,
  y: a.y + b.y * scale,
  z: a.z + b.z * scale,
});
const unit = (v: Vec3): Vec3 =>
  length(v) > 1e-12 ? add({ x: 0, y: 0, z: 0 }, v, 1 / length(v)) : { x: 0, y: 1, z: 0 };

function collide(p: Vec3, capsules: Capsule[], radius: number): boolean {
  let changed = false;
  for (const c of capsules) {
    const axis = sub(c.b, c.a);
    const t = Math.max(0, Math.min(1, dot(sub(p, c.a), axis) / (dot(axis, axis) || 1)));
    const closest = add(c.a, axis, t);
    const delta = sub(p, closest);
    const distance = length(delta);
    const limit = c.radius + radius;
    if (distance < limit - 1e-10) {
      // On the axis choose a deterministic perpendicular, including zero-length capsules.
      const normal =
        distance > 1e-12
          ? unit(delta)
          : unit(
              Math.abs(axis.x) < Math.abs(axis.y)
                ? { x: 0, y: -axis.z, z: axis.y }
                : { x: -axis.z, y: 0, z: axis.x },
            );
      Object.assign(p, add(closest, normal, limit + 1e-9));
      changed = true;
    }
  }
  return changed;
}

interface State {
  points: Vec3[];
  previous: Vec3[];
  root: Vec3;
}
/** Fixed-step Verlet solver. Returned arrays are snapshots owned by the caller.
 * Roots stay pinned, even inside a capsule. For impossible constraints (e.g. a
 * segment enclosed by a body), collision clearance takes priority over length.
 * Missing poses discard that chain's history. Excess accumulated time is dropped.
 */
export class SpringBones {
  private readonly chains: SpringChainSpec[];
  private states = new Map<string, State>();
  private accumulator = 0;
  constructor(chains: SpringChainSpec[]) {
    const ids = new Set<string>();
    for (const c of chains) {
      if (
        ids.has(c.id) ||
        ![c.stiffness, c.damping].every((v) => Number.isFinite(v) && v >= 0 && v <= 1) ||
        ![c.radius, c.dragFactor ?? 0, ...c.restLengths].every(
          (v) => Number.isFinite(v) && v >= 0,
        ) ||
        !Number.isFinite(c.gravity)
      )
        throw new RangeError('Invalid spring chain');
      ids.add(c.id);
    }
    this.chains = chains.map((c) => ({ ...c, restLengths: [...c.restLengths] }));
  }
  reset(): void {
    this.states.clear();
    this.accumulator = 0;
  }
  update(input: SpringInput): Record<string, Vec3[]> {
    const spike = !Number.isFinite(input.dt) || input.dt > 0.1;
    if (spike) this.reset();
    this.accumulator = Math.min(4 * STEP, this.accumulator + (spike ? 0 : Math.max(0, input.dt)));
    const steps = Math.floor((this.accumulator + 1e-12) / STEP);
    this.accumulator = Math.max(0, this.accumulator - steps * STEP);
    const output: Record<string, Vec3[]> = {};
    for (const spec of this.chains) {
      const root = input.roots[spec.id];
      const directions = input.restDirections[spec.id];
      if (!root || !directions || directions.length !== spec.restLengths.length) {
        this.states.delete(spec.id);
        continue;
      }
      const rest = [{ ...root }];
      for (let i = 0; i < directions.length; i++)
        rest.push(add(rest[i]!, unit(directions[i]!), spec.restLengths[i]!));
      let state = this.states.get(spec.id);
      const fresh = !state || length(sub(root, state.root)) > 0.5 || input.reducedMotion;
      if (fresh) {
        state = { points: rest, previous: rest.map((p) => ({ ...p })), root: { ...root } };
        this.states.set(spec.id, state);
      }
      if (!state) continue;
      const points = state.points;
      points[0] = { ...root };
      for (let step = 0; step < (fresh ? 0 : steps); step++) {
        for (let i = 1; i < points.length; i++) {
          const p = points[i]!;
          const velocity = sub(p, state.previous[i]!);
          state.previous[i] = { ...p };
          const next = add(
            p,
            velocity,
            (1 - spec.damping) * Math.exp(-(spec.dragFactor ?? 0) * STEP),
          );
          next.y += spec.gravity * STEP * STEP;
          const target = add(points[i - 1]!, unit(directions[i - 1]!), spec.restLengths[i - 1]!);
          points[i] = add(next, sub(target, next), spec.stiffness);
        }
        this.constrain(points, spec, directions, input.capsules);
      }
      this.constrain(points, spec, directions, input.capsules, !!input.reducedMotion);
      if (fresh) state.previous = points.map((p) => ({ ...p }));
      state.root = { ...root };
      output[spec.id] = points.map((p) => ({ ...p }));
    }
    return output;
  }
  private constrain(
    points: Vec3[],
    spec: SpringChainSpec,
    directions: Vec3[],
    capsules: Capsule[],
    reduced = false,
  ): void {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < points.length; i++) {
        const p = points[i]!;
        const parent = points[i - 1]!;
        if (!reduced) {
          // Local alternating projections converge near a capsule/length intersection.
          for (let attempt = 0; attempt < 32; attempt++) {
            const delta = sub(p, parent);
            Object.assign(
              p,
              add(
                parent,
                length(delta) > 1e-12 ? unit(delta) : unit(directions[i - 1]!),
                spec.restLengths[i - 1]!,
              ),
            );
            if (!collide(p, capsules, spec.radius)) break;
          }
        } else collide(p, capsules, spec.radius);
      }
    }
  }
}

export interface Landmark extends Vec3 {
  visibility?: number;
}
export interface CapsuleOptions {
  visibilityThreshold?: number;
  referenceShoulderWidth?: number;
}
/** Body capsules scaled by shoulder width / 0.38 m; absent visibility means visible.
 * Without both visible shoulders scale defaults to 1. Incomplete limbs are skipped.
 */
export function capsulesFromLandmarks(world: Landmark[], opts: CapsuleOptions = {}): Capsule[] {
  const visible = (i: number) => {
    const p = world[i];
    return p &&
      (p.visibility ?? 1) >= (opts.visibilityThreshold ?? 0.5) &&
      [p.x, p.y, p.z].every(Number.isFinite)
      ? p
      : undefined;
  };
  const left = visible(11),
    right = visible(12);
  const reference = opts.referenceShoulderWidth ?? 0.38;
  if (!(reference > 0) || !Number.isFinite(reference))
    throw new RangeError('Invalid shoulder reference');
  const scale = left && right ? length(sub(left, right)) / reference : 1;
  const result: Capsule[] = [];
  const hipLeft = visible(23),
    hipRight = visible(24);
  if (left && right && hipLeft && hipRight)
    result.push({
      a: add(left, sub(right, left), 0.5),
      b: add(hipLeft, sub(hipRight, hipLeft), 0.5),
      radius: 0.13 * scale,
    });
  for (const [a, b, r] of [
    [11, 13, 0.05],
    [12, 14, 0.05],
    [13, 15, 0.04],
    [14, 16, 0.04],
    [23, 25, 0.08],
    [24, 26, 0.08],
    [25, 27, 0.055],
    [26, 28, 0.055],
  ] as const) {
    const start = visible(a),
      end = visible(b);
    if (start && end)
      result.push({
        a: { x: start.x, y: start.y, z: start.z },
        b: { x: end.x, y: end.y, z: end.z },
        radius: r * scale,
      });
  }
  return result;
}
/** Shortest-arc rotations between corresponding joint-position segments.
 * Degenerate segments produce identity; opposite vectors use a stable orthogonal axis.
 */
export function segmentRotations(rest: Vec3[], simulated: Vec3[]): Quaternion[] {
  if (rest.length !== simulated.length) throw new RangeError('Joint counts must match');
  return rest.slice(1).map((end, i) => {
    const a = sub(end, rest[i]!),
      b = sub(simulated[i + 1]!, simulated[i]!);
    if (length(a) < 1e-12 || length(b) < 1e-12) return { x: 0, y: 0, z: 0, w: 1 };
    const u = unit(a),
      v = unit(b);
    const w = 1 + Math.max(-1, Math.min(1, dot(u, v)));
    if (w < 1e-10) {
      const axis = unit(
        Math.abs(u.x) < 0.9 ? { x: 0, y: u.z, z: -u.y } : { x: -u.z, y: 0, z: u.x },
      );
      return { ...axis, w: 0 };
    }
    const cross = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    const norm = Math.hypot(length(cross), w);
    return { x: cross.x / norm, y: cross.y / norm, z: cross.z / norm, w: w / norm };
  });
}
