// biome-ignore-all lint/style/noNonNullAssertion: Validated mesh dimensions and bounded numeric loops guarantee indices.
export type Point3 = { x: number; y: number; z: number };
export type Capsule = { a: Point3; b: Point3; radius: number };
export type ClothMesh = {
  positions: Float32Array;
  indices: Uint32Array;
  pinned: Uint8Array;
  uvs?: Float32Array;
};
export type ClothOptions = {
  compliance: number;
  bendCompliance: number;
  /** Exponential velocity decay rate, in inverse seconds. */
  damping: number;
  gravity: number;
  substeps?: number;
  iterations?: number;
};

export function createClothGrid(opts: {
  rows: number;
  cols: number;
  width: number;
  height: number;
  origin: Point3;
  pinnedRow0?: boolean;
}): ClothMesh & { uvs: Float32Array } {
  const { rows, cols, width, height, origin } = opts;
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2)
    throw new RangeError('Grid needs at least two rows and columns');
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);
  const pinned = new Uint8Array(rows * cols);
  const indices = new Uint32Array((rows - 1) * (cols - 1) * 6);
  let t = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      positions.set(
        [origin.x + (c / (cols - 1) - 0.5) * width, origin.y + (r / (rows - 1)) * height, origin.z],
        i * 3,
      );
      uvs.set([c / (cols - 1), r / (rows - 1)], i * 2);
      pinned[i] = r === 0 && opts.pinnedRow0 !== false ? 1 : 0;
      if (r < rows - 1 && c < cols - 1) {
        indices.set([i, i + cols, i + 1, i + 1, i + cols, i + cols + 1], t);
        t += 6;
      }
    }
  }
  return { positions, indices, pinned, uvs };
}

/** Copies caller-owned geometry; topology and rest lengths are captured by the solver. */
export function clothFromMesh(
  positions: Float32Array,
  indices: Uint32Array,
  pinned: Uint8Array,
): ClothMesh {
  if (positions.length % 3 || indices.length % 3 || pinned.length !== positions.length / 3)
    throw new RangeError('Invalid cloth mesh dimensions');
  for (const value of positions)
    if (!Number.isFinite(value)) throw new RangeError('Invalid position');
  for (const index of indices)
    if (index >= pinned.length) throw new RangeError('Invalid vertex index');
  return { positions: positions.slice(), indices: indices.slice(), pinned: pinned.slice() };
}

export class XpbdCloth {
  readonly positions: Float32Array;
  readonly stats = { lastStepMs: 0 };
  private readonly rest: Float32Array;
  private readonly previous: Float32Array;
  private readonly velocity: Float32Array;
  private readonly targets: Float32Array;
  private readonly weights: Float32Array;
  private readonly pairs: Uint32Array;
  private readonly lengths: Float32Array;
  private readonly lambdas: Float32Array;
  private readonly edgeCount: number;
  private readonly substeps: number;
  private readonly iterations: number;

  constructor(
    mesh: ClothMesh,
    private readonly opts: ClothOptions,
  ) {
    const owned = clothFromMesh(mesh.positions, mesh.indices, mesh.pinned);
    for (const value of [opts.compliance, opts.bendCompliance, opts.damping])
      if (!Number.isFinite(value) || value < 0) throw new RangeError('Invalid solver option');
    this.substeps = opts.substeps ?? 8;
    this.iterations = opts.iterations ?? 1;
    if (
      !Number.isFinite(opts.gravity) ||
      !Number.isInteger(this.substeps) ||
      this.substeps < 1 ||
      !Number.isInteger(this.iterations) ||
      this.iterations < 1
    )
      throw new RangeError('Invalid solver option');
    this.positions = owned.positions;
    this.rest = this.positions.slice();
    this.previous = this.positions.slice();
    this.targets = this.positions.slice();
    this.velocity = new Float32Array(this.positions.length);
    this.weights = Float32Array.from(owned.pinned, (p) => (p ? 0 : 1));
    const edges = new Map<string, [number, number, number]>();
    const stretch: number[] = [],
      bend: number[] = [];
    for (let t = 0; t < owned.indices.length; t += 3) {
      for (let j = 0; j < 3; j++) {
        const a = owned.indices[t + j]!,
          b = owned.indices[t + ((j + 1) % 3)]!;
        const opposite = owned.indices[t + ((j + 2) % 3)]!;
        if (a === b) continue;
        const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
        const edge = edges.get(key);
        if (edge) {
          if (edge[2]! !== opposite) bend.push(edge[2]!, opposite);
        } else {
          edges.set(key, [a, b, opposite]);
          stretch.push(a, b);
        }
      }
    }
    this.edgeCount = stretch.length / 2;
    this.pairs = new Uint32Array([...stretch, ...bend]);
    this.lengths = new Float32Array(this.pairs.length / 2);
    this.lambdas = new Float32Array(this.lengths.length);
    for (let k = 0; k < this.lengths.length; k++) {
      const a = this.pairs[k * 2]! * 3,
        b = this.pairs[k * 2 + 1]! * 3;
      this.lengths[k]! = Math.hypot(
        this.rest[a]! - this.rest[b]!,
        this.rest[a + 1]! - this.rest[b + 1]!,
        this.rest[a + 2]! - this.rest[b + 2]!,
      );
    }
  }

  /** Full n*3 buffer. Jumps exceeding 0.5 m translate the cloth and clear momentum. */
  setPinned(targetPositions: Float32Array): void {
    if (targetPositions.length !== this.positions.length)
      throw new RangeError('Invalid target size');
    let dx = 0,
      dy = 0,
      dz = 0,
      count = 0,
      teleport = false;
    for (let i = 0; i < this.weights.length; i++) {
      if (this.weights[i]!) continue;
      const p = i * 3;
      for (let d = 0; d < 3; d++)
        if (!Number.isFinite(targetPositions[p + d]!)) throw new RangeError('Invalid pin target');
      const x = targetPositions[p]! - this.targets[p]!;
      const y = targetPositions[p + 1]! - this.targets[p + 1]!;
      const z = targetPositions[p + 2]! - this.targets[p + 2]!;
      teleport ||= x * x + y * y + z * z > 0.25;
      dx += x;
      dy += y;
      dz += z;
      count++;
    }
    if (teleport && count) {
      for (let p = 0; p < this.positions.length; p += 3) {
        this.positions[p]! += dx / count;
        this.positions[p + 1]! += dy / count;
        this.positions[p + 2]! += dz / count;
      }
      this.velocity.fill(0);
    }
    for (let i = 0; i < this.weights.length; i++) {
      if (this.weights[i]!) continue;
      for (let d = 0; d < 3; d++) {
        const p = i * 3 + d;
        this.positions[p]! = this.targets[p]! = targetPositions[p]!;
        this.velocity[p]! = 0;
      }
    }
  }

  reset(positions?: Float32Array): void {
    const source = positions ?? this.rest;
    if (source.length !== this.positions.length) throw new RangeError('Invalid reset size');
    for (const value of source)
      if (!Number.isFinite(value)) throw new RangeError('Invalid reset position');
    this.positions.set(source);
    this.targets.set(source);
    this.previous.set(source);
    this.velocity.fill(0);
    this.lambdas.fill(0);
    this.stats.lastStepMs = 0;
  }

  step(dt: number, capsules: readonly Capsule[]): void {
    const start = performance.now();
    if (!Number.isFinite(dt) || dt <= 0) return;
    const h = Math.min(dt, 1 / 30) / this.substeps;
    const decay = Math.exp(-this.opts.damping * h);
    const p = this.positions;
    for (let s = 0; s < this.substeps; s++) {
      this.previous.set(p);
      for (let i = 0; i < this.weights.length; i++) {
        if (!this.weights[i]!) continue;
        const k = i * 3;
        this.velocity[k + 1]! += this.opts.gravity * h;
        for (let d = 0; d < 3; d++) p[k + d]! += this.velocity[k + d]! * h;
      }
      this.lambdas.fill(0);
      for (let it = 0; it < this.iterations; it++) {
        for (let c = 0; c < this.lengths.length; c++) {
          const ai = this.pairs[c * 2]!,
            bi = this.pairs[c * 2 + 1]!;
          const a = ai * 3,
            b = bi * 3,
            wa = this.weights[ai]!,
            wb = this.weights[bi]!;
          const x = p[a]! - p[b]!,
            y = p[a + 1]! - p[b + 1]!,
            z = p[a + 2]! - p[b + 2]!;
          const length = Math.sqrt(x * x + y * y + z * z);
          if (!length || !(wa + wb)) continue;
          const alpha =
            (c < this.edgeCount ? this.opts.compliance : this.opts.bendCompliance) / (h * h);
          const dl = (-(length - this.lengths[c]!) - alpha * this.lambdas[c]!) / (wa + wb + alpha);
          this.lambdas[c]! += dl;
          const scale = dl / length;
          p[a]! += wa * scale * x;
          p[a + 1]! += wa * scale * y;
          p[a + 2]! += wa * scale * z;
          p[b]! -= wb * scale * x;
          p[b + 1]! -= wb * scale * y;
          p[b + 2]! -= wb * scale * z;
        }
      }
      this.collide(capsules);
      for (let k = 0; k < p.length; k++)
        this.velocity[k]! = ((p[k]! - this.previous[k]!) / h) * decay;
    }
    this.stats.lastStepMs = performance.now() - start;
  }

  private collide(capsules: readonly Capsule[]): void {
    const p = this.positions;
    for (const { a, b, radius } of capsules) {
      if (!(radius > 0)) continue;
      const x = b.x - a.x,
        y = b.y - a.y,
        z = b.z - a.z;
      const length2 = x * x + y * y + z * z;
      for (let i = 0; i < this.weights.length; i++) {
        if (!this.weights[i]!) continue; // Animated pins take precedence over contacts.
        const k = i * 3;
        const t = length2
          ? Math.max(
              0,
              Math.min(
                1,
                ((p[k]! - a.x) * x + (p[k + 1]! - a.y) * y + (p[k + 2]! - a.z) * z) / length2,
              ),
            )
          : 0;
        let nx = p[k]! - a.x - t * x,
          ny = p[k + 1]! - a.y - t * y,
          nz = p[k + 2]! - a.z - t * z;
        let distance = Math.hypot(nx, ny, nz);
        if (distance >= radius) continue;
        if (distance < 1e-12) {
          // Deterministic perpendicular normal, also valid for a zero-length capsule.
          nx = y || z ? 0 : 1;
          ny = y || z ? -z : 0;
          nz = y || z ? y : 0;
          distance = Math.hypot(nx, ny, nz);
        }
        const scale = (radius + 1e-7) / distance;
        p[k]! = a.x + t * x + nx * scale;
        p[k + 1]! = a.y + t * y + ny * scale;
        p[k + 2]! = a.z + t * z + nz * scale;
      }
    }
  }
}

/** Advances the live cloth at 30 Hz, without contacts; caller decides the fallback threshold. */
export function measureBudget(cloth: XpbdCloth, frames = 120): { avgMs: number; p95Ms: number } {
  if (!Number.isInteger(frames) || frames < 1) throw new RangeError('Invalid frame count');
  const samples = new Float64Array(frames);
  const capsules: Capsule[] = [];
  let total = 0;
  for (let i = 0; i < frames; i++) {
    cloth.step(1 / 30, capsules);
    samples[i]! = cloth.stats.lastStepMs;
    total += samples[i]!;
  }
  samples.sort();
  return { avgMs: total / frames, p95Ms: samples[Math.ceil(frames * 0.95) - 1]! };
}
