/** Camera-aligned metres: x right, y down, z away from the camera. */
export type WorldPoint = { x: number; y: number; z: number; visibility?: number };
export type ImagePoint = { x: number; y: number; visibility?: number };
export type FrameSize = { width: number; height: number };
export type FovSample = { world: readonly WorldPoint[]; image: readonly ImagePoint[] };
type Translation = [number, number, number];
const stable = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const rad = Math.PI / 180;
const validSize = (s: FrameSize) =>
  Number.isFinite(s.width + s.height) && s.width > 0 && s.height > 0;
function points(world: readonly WorldPoint[], image: readonly ImagePoint[], threshold = 0.6) {
  return stable.flatMap((i) => {
    const w = world[i];
    const p = image[i];
    return w &&
      p &&
      (w.visibility ?? 1) >= threshold &&
      (p.visibility ?? 1) >= threshold &&
      [w.x, w.y, w.z, p.x, p.y].every(Number.isFinite)
      ? [{ w, p }]
      : [];
  });
}

/** RMS Euclidean pixel error over the same stable, visible joints used by the solver. */
export function projectionCheck(
  world: readonly WorldPoint[],
  image: readonly ImagePoint[],
  size: FrameSize,
  f: number,
  t: Translation,
  minVisibility = 0.6,
): number {
  const pairs = points(world, image, minVisibility);
  if (
    !validSize(size) ||
    !Number.isFinite(f) ||
    f <= 0 ||
    !t.every(Number.isFinite) ||
    !pairs.length
  )
    return Number.POSITIVE_INFINITY;
  let error = 0;
  for (const { w, p } of pairs) {
    const depth = w.z + t[2];
    if (depth <= 0) return Number.POSITIVE_INFINITY;
    error +=
      ((f * (w.x + t[0])) / depth + size.width / 2 - p.x * size.width) ** 2 +
      ((f * (w.y + t[1])) / depth + size.height / 2 - p.y * size.height) ** 2;
  }
  return Math.sqrt(error / pairs.length);
}

/** Linear least squares with the x/y intercepts eliminated by centering. */
export function solveTranslation(
  world: readonly WorldPoint[],
  image: readonly ImagePoint[],
  size: FrameSize,
  f: number,
  minVisibility = 0.6,
): { t: Translation; rms: number } | null {
  const pairs = points(world, image, minVisibility);
  if (!validSize(size) || !Number.isFinite(f) || f <= 0 || pairs.length < 6) return null;
  const rows = pairs.map(({ w, p }) => {
    const a = ((p.x - 0.5) * size.width) / f;
    const c = ((p.y - 0.5) * size.height) / f;
    return [a, c, a * w.z - w.x, c * w.z - w.y] as const;
  });
  const mean = [0, 1, 2, 3].map((i) => rows.reduce((s, r) => s + (r[i] ?? 0), 0) / rows.length);
  const [a = 0, c = 0, b = 0, d = 0] = mean;
  let numerator = 0;
  let denominator = 0;
  for (const r of rows) {
    numerator -= (r[0] - a) * (r[2] - b) + (r[1] - c) * (r[3] - d);
    denominator += (r[0] - a) ** 2 + (r[1] - c) ** 2;
  }
  if (denominator < 1e-10) return null;
  const z = numerator / denominator;
  const t: Translation = [b + a * z, d + c * z, z];
  const rms = projectionCheck(world, image, size, f, t, minVisibility);
  return z > 0.2 && Number.isFinite(rms) ? { t, rms } : null;
}

/** Trim the worst 20% of frames, keeping a corrupted frame from selecting the lens. */
export function estimateFocal(
  samples: readonly FovSample[],
  size: FrameSize,
): { f: number; fovY: number; fovX: number; rms: number } | null {
  if (!validSize(size) || samples.length < 3) return null;
  const usable = samples.filter(({ world, image }) => {
    const pairs = points(world, image);
    const zs = pairs.map(({ w }) => w.z);
    // Planar poses cannot distinguish focal length from distance.
    return pairs.length >= 6 && Math.max(...zs) - Math.min(...zs) > 0.03;
  });
  if (usable.length < 3) return null;
  const score = (angle: number) => {
    const f = size.width / (2 * Math.tan(angle / 2));
    const errors = usable
      .map(
        ({ world, image }) =>
          solveTranslation(world, image, size, f)?.rms ?? Number.POSITIVE_INFINITY,
      )
      .sort((a, b) => a - b);
    const kept = errors.slice(0, Math.max(3, Math.ceil(errors.length * 0.8)));
    return Math.sqrt(kept.reduce((s, e) => s + e * e, 0) / kept.length);
  };
  let best = 63 * rad;
  let rms = Number.POSITIVE_INFINITY;
  let low = 40 * rad;
  let high = 100 * rad;
  for (let pass = 0; pass < 4; pass++) {
    const step = (high - low) / 30;
    for (let i = 0; i <= 30; i++) {
      const angle = low + i * step;
      const error = score(angle);
      if (error < rms) {
        best = angle;
        rms = error;
      }
    }
    low = Math.max(40 * rad, best - step);
    high = Math.min(100 * rad, best + step);
  }
  if (!Number.isFinite(rms)) return null;
  const f = size.width / (2 * Math.tan(best / 2));
  return { f, fovX: best, fovY: 2 * Math.atan(size.height / (2 * f)), rms };
}

export type FovOptions = {
  capacity?: number;
  estimateEvery?: number;
  minFrames?: number;
  maxRms?: number;
  minIntervalMs?: number;
};
const median = (values: number[]) =>
  values.sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 63 * rad;
export class FovCalibrator {
  private samples: FovSample[] = [];
  private angles: number[] = [];
  private size: FrameSize = { width: 1, height: 1 };
  private lastTime = Number.NEGATIVE_INFINITY;
  private kept = 0;
  private rms = Number.POSITIVE_INFINITY;
  private options: Required<FovOptions>;
  constructor(opts: FovOptions = {}) {
    this.options = {
      capacity: 60,
      estimateEvery: 5,
      minFrames: 20,
      maxRms: 4,
      minIntervalMs: 80,
      ...opts,
    };
    for (const key of ['capacity', 'estimateEvery', 'minFrames'] as const) {
      this.options[key] = Math.max(key === 'capacity' ? 20 : 1, Math.floor(this.options[key]) || 1);
    }
    this.options.minFrames = Math.max(20, this.options.minFrames);
  }
  add(
    world: readonly WorldPoint[],
    image: readonly ImagePoint[],
    size: FrameSize,
    now: number,
  ): void {
    if (!validSize(size) || !Number.isFinite(now)) return;
    if (size.width !== this.size.width || size.height !== this.size.height) {
      this.samples = [];
      this.angles = [];
      this.kept = 0;
      this.rms = Number.POSITIVE_INFINITY;
      this.lastTime = Number.NEGATIVE_INFINITY;
      this.size = { ...size };
    }
    if (
      now - this.lastTime < this.options.minIntervalMs ||
      !solveTranslation(world, image, size, this.result.f)
    )
      return;
    const previous = this.samples.at(-1);
    if (previous) {
      const shared = stable.filter(
        (i) => world[i] && image[i] && previous.world[i] && previous.image[i],
      );
      const motion = shared.reduce((sum, i) => {
        const w = world[i];
        const p = image[i];
        const oldW = previous.world[i];
        const oldP = previous.image[i];
        return (
          sum +
          (w && p && oldW && oldP
            ? (p.x - oldP.x) ** 2 + (p.y - oldP.y) ** 2 + (w.z - oldW.z) ** 2
            : 0)
        );
      }, 0);
      if (!shared.length || Math.sqrt(motion / shared.length) < 0.008) return;
    }
    this.samples.push({ world: world.map((p) => ({ ...p })), image: image.map((p) => ({ ...p })) });
    if (this.samples.length > this.options.capacity) this.samples.shift();
    this.lastTime = now;
    this.kept++;
    if (this.kept % this.options.estimateEvery !== 0) return;
    const estimate = estimateFocal(this.samples, size);
    if (estimate) {
      this.rms = estimate.rms;
      this.angles.push(estimate.fovX);
      if (this.angles.length > 5) this.angles.shift();
    }
  }
  get ready(): boolean {
    return (
      this.samples.length >= this.options.minFrames &&
      this.angles.length > 0 &&
      this.rms < this.options.maxRms
    );
  }
  get result() {
    // Until ready, use the documented typical phone front-camera horizontal FOV.
    const fovX = this.ready ? median([...this.angles]) : 63 * rad;
    const f = this.size.width / (2 * Math.tan(fovX / 2));
    const confidence = this.angles.length
      ? Math.min(1, this.samples.length / this.options.minFrames) *
        Math.max(0, 1 - this.rms / this.options.maxRms)
      : 0;
    return {
      fovX,
      fovY: 2 * Math.atan(this.size.height / (2 * f)),
      f,
      confidence,
      frames: this.samples.length,
    };
  }
}

/** Flat fallback only: focal length is unobservable from this manufactured geometry. */
export function approxWorldFromImage(
  image: readonly ImagePoint[],
  size: FrameSize,
  shoulderWidthM = 0.38,
): WorldPoint[] {
  const left = image[11];
  const right = image[12];
  const hipL = image[23];
  const hipR = image[24];
  if (
    !validSize(size) ||
    !left ||
    !right ||
    !hipL ||
    !hipR ||
    !Number.isFinite(shoulderWidthM) ||
    shoulderWidthM <= 0
  )
    return [];
  const width = Math.hypot((left.x - right.x) * size.width, (left.y - right.y) * size.height);
  if (!Number.isFinite(width) || width < 1e-6 || !image.every((p) => Number.isFinite(p.x + p.y)))
    return [];
  const cx = (hipL.x + hipR.x) / 2;
  const cy = (hipL.y + hipR.y) / 2;
  return image.map((p) => ({
    x: ((p.x - cx) * size.width * shoulderWidthM) / width,
    y: ((p.y - cy) * size.height * shoulderWidthM) / width,
    z: 0,
    visibility: p.visibility ?? 1,
  }));
}
