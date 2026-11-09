// Per-frame coordinator of the realistic AR gown (phase 3): webcam FOV calibration, per-frame
// camera translation, secondary motion (spring bones, or the optional XPBD skirt proxy), light
// from the camera brightness and the automatic fallback to the 2.5D gown when the fps drop.
import * as THREE from 'three';
import { FovCalibrator, type ImagePoint, solveTranslation } from './camera-fov.ts';
import { GownFallback, type GownQuality } from './gown-fallback.ts';
import { GownRigRenderer } from './gown-rig.ts';
import {
  aimBone,
  type BodyTargets,
  bodyTargets,
  toThree,
  type WorldPoint,
} from './rig-retarget.ts';
import {
  type Capsule,
  capsulesFromLandmarks,
  SpringBones,
  type SpringChainSpec,
} from './spring-bones.ts';
import { createClothGrid, measureBudget, XpbdCloth } from './xpbd-cloth.ts';

/** Spring chains: bone names in order, plus the length of the last segment (model metres). */
const CHAINS: readonly { id: string; bones: string[]; tail: number; stiffness: number }[] = [
  { id: 'hem.F', bones: ['hem.F.1', 'hem.F.2'], tail: 0.25, stiffness: 0.08 },
  { id: 'hem.B', bones: ['hem.B.1', 'hem.B.2'], tail: 0.25, stiffness: 0.08 },
  { id: 'hem.L', bones: ['hem.L.1', 'hem.L.2'], tail: 0.25, stiffness: 0.08 },
  { id: 'hem.R', bones: ['hem.R.1', 'hem.R.2'], tail: 0.25, stiffness: 0.08 },
  { id: 'sleeve.L', bones: ['sleeve.L'], tail: 0.15, stiffness: 0.25 },
  { id: 'sleeve.R', bones: ['sleeve.R'], tail: 0.15, stiffness: 0.25 },
  { id: 'tie.L', bones: ['tie.L'], tail: 0.2, stiffness: 0.04 },
  { id: 'tie.R', bones: ['tie.R'], tail: 0.2, stiffness: 0.04 },
];
/** The XPBD proxy is only kept if one step costs less than this on the device. */
const XPBD_BUDGET_MS = 4;
/** Stop feeding the calibrator once it has been ready this long: it costs CPU every few frames. */
const CALIBRATION_FREEZE_MS = 3000;

export interface RigFrame {
  world: readonly WorldPoint[] | null;
  image: readonly ImagePoint[];
  size: { width: number; height: number };
  /** The gown is worn in the game scene (otherwise nothing is drawn). */
  worn: boolean;
  now: number;
  fps: number;
}

type Joints = { chain: (typeof CHAINS)[number]; bones: THREE.Bone[]; points: THREE.Vector3[] };

export class GownRigDriver {
  private readonly renderer: GownRigRenderer;
  private calibrator = new FovCalibrator();
  private readyAt: number | null = null;
  private readonly fallback: GownFallback;
  private springs: SpringBones | null = null;
  private cloth: XpbdCloth | null = null;
  private lastNow = 0;
  private calibratedSize = '';
  private springScale = 0;
  private xpbdChecked = false;
  /** Gap (s) after which the secondary motion restarts from rest instead of carrying momentum. */
  private static readonly RESET_GAP = 0.25;

  constructor(
    canvas: HTMLCanvasElement,
    fabricHex: string,
    private readonly reducedMotion: boolean,
    xpbd: boolean,
  ) {
    this.renderer = new GownRigRenderer(canvas, fabricHex);
    this.fallback = new GownFallback(xpbd && !reducedMotion ? 'xpbd' : 'springs');
  }

  get quality(): GownQuality {
    return this.fallback.quality;
  }

  /** The 3D gown is in charge (loaded or still loading); false means draw the 2.5D gown. */
  get active(): boolean {
    return !this.renderer.failed && this.fallback.quality !== '2d';
  }

  setLuma(luma: number) {
    this.renderer.setLuma(luma);
  }

  /** Returns true when the 3D gown was drawn this frame. */
  frame(input: RigFrame): boolean {
    if (this.renderer.failed) this.fallback.fail();
    const quality = this.fallback.update(input.fps, input.now);
    const elapsed = this.lastNow ? (input.now - this.lastNow) / 1000 : 0;
    this.lastNow = input.now;
    if (quality === '2d' || !input.world || !input.worn) {
      this.resetSecondary();
      this.renderer.render(null, input.size.width, input.size.height);
      return false;
    }
    // A long gap (tab hidden, pose lost) restarts the cloth from rest: no stale momentum.
    if (elapsed > GownRigDriver.RESET_GAP) this.resetSecondary();
    const dt = elapsed > 0 && elapsed <= GownRigDriver.RESET_GAP ? elapsed : 1 / 30;
    // A new camera resolution changes the focal length in pixels: calibrate again.
    const sizeKey = `${input.size.width}x${input.size.height}`;
    if (sizeKey !== this.calibratedSize) {
      this.calibratedSize = sizeKey;
      this.calibrator = new FovCalibrator();
      this.readyAt = null;
    }
    if (this.readyAt === null || input.now - this.readyAt < CALIBRATION_FREEZE_MS) {
      this.calibrator.add(input.world, input.image, input.size, input.now);
      if (this.calibrator.ready) this.readyAt ??= input.now;
    }
    const { f } = this.calibrator.result;
    this.renderer.setFov(2 * Math.atan(input.size.height / 2 / f));
    const solved = solveTranslation(input.world, input.image, input.size, f);
    const body = solved ? bodyTargets(input.world, solved.t) : null;
    const t = solved?.t ?? [0, 0, 2];
    const capsules = capsulesFromLandmarks([...input.world]).map((c) => ({
      a: toThree(c.a, t),
      b: toThree(c.b, t),
      radius: c.radius,
    }));
    const drawn = this.renderer.render(body, input.size.width, input.size.height, (bones, b) =>
      this.secondary(bones, b, capsules, dt, quality),
    );
    if (drawn) this.lastDrawn = true;
    return drawn;
  }

  private secondary(
    bones: ReadonlyMap<string, THREE.Bone>,
    body: BodyTargets,
    capsules: Capsule[],
    dt: number,
    quality: GownQuality,
  ) {
    const scale = body.shoulderWidth / 0.38;
    const chains = CHAINS.flatMap((chain): Joints[] => {
      const list = chain.bones.map((name) => bones.get(name));
      if (list.some((bone) => !bone)) return [];
      const ok = list as THREE.Bone[];
      const points = ok.map((bone) => new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld));
      const last = ok[ok.length - 1] as THREE.Bone;
      points.push(new THREE.Vector3(0, chain.tail, 0).applyMatrix4(last.matrixWorld));
      return [{ chain, bones: ok, points }];
    });
    if (quality === 'xpbd') this.clothTargets(chains, body, capsules, dt, scale);
    // Rest lengths are in scaled world metres: rebuild the chains when the body scale moves > 5 %.
    if (!this.springs || Math.abs(scale / this.springScale - 1) > 0.05) {
      this.springs = new SpringBones(chains.map((j) => this.spec(j)));
      this.springScale = scale;
    }
    const result = this.springs.update({
      dt,
      roots: Object.fromEntries(chains.map((j) => [j.chain.id, j.points[0] as THREE.Vector3])),
      restDirections: Object.fromEntries(
        chains.map((j) => [
          j.chain.id,
          j.points.slice(1).map((p, i) =>
            p
              .clone()
              .sub(j.points[i] as THREE.Vector3)
              .normalize(),
          ),
        ]),
      ),
      capsules,
      reducedMotion: this.reducedMotion,
    });
    for (const joints of chains) {
      const simulated = result[joints.chain.id];
      if (!simulated) continue;
      joints.bones.forEach((bone, i) => {
        const next = simulated[i + 1];
        const child = joints.bones[i + 1];
        const local = child ? child.position : new THREE.Vector3(0, joints.chain.tail, 0);
        if (next) aimBone(bone, local, new THREE.Vector3(next.x, next.y, next.z));
      });
    }
  }

  private spec(j: Joints): SpringChainSpec {
    const lengths = j.points.slice(1).map((p, i) => p.distanceTo(j.points[i] as THREE.Vector3));
    return {
      id: j.chain.id,
      restLengths: lengths,
      stiffness: j.chain.stiffness,
      damping: 0.12,
      // three.js is y-up, the spring module's +y is down: gravity points to −y here.
      gravity: -9.8,
      radius: 0.02,
    };
  }

  /**
   * Optional XPBD: a cylindrical skirt proxy pinned at the waist is simulated as cloth and the hem
   * chains are steered towards its front/back/left/right columns (the springs then smooth them).
   */
  private clothTargets(
    chains: Joints[],
    body: BodyTargets,
    capsules: Capsule[],
    dt: number,
    scale: number,
  ) {
    const rows = 6;
    const cols = 16;
    const radius = 0.2 * scale;
    const height = 0.7 * scale;
    const ring = (row: number, out: Float32Array) => {
      for (let c = 0; c < cols; c++) {
        const a = (c / cols) * Math.PI * 2;
        const p = body.hipMid
          .clone()
          .addScaledVector(body.left, Math.sin(a) * radius)
          .addScaledVector(body.forward, Math.cos(a) * radius)
          .addScaledVector(body.up, -row * (height / (rows - 1)));
        out.set([p.x, p.y, p.z], (row * cols + c) * 3);
      }
    };
    if (!this.cloth) {
      if (this.xpbdChecked && this.fallback.quality !== 'xpbd') return;
      const grid = createClothGrid({
        rows,
        cols,
        width: 1,
        height: 1,
        origin: { x: 0, y: 0, z: 0 },
        pinnedRow0: true,
      });
      for (let r = 0; r < rows; r++) ring(r, grid.positions);
      this.cloth = new XpbdCloth(grid, {
        compliance: 1e-6,
        bendCompliance: 1e-3,
        damping: 1.5,
        gravity: -9.8,
      });
      if (!this.xpbdChecked) {
        this.xpbdChecked = true;
        if (measureBudget(this.cloth, 30).avgMs > XPBD_BUDGET_MS) {
          this.fallback.downgrade(); // not fast enough on this device: springs only
          this.cloth = null;
          return;
        }
      }
      this.cloth.reset(grid.positions);
    }
    const pinned = new Float32Array(this.cloth.positions.length);
    ring(0, pinned);
    this.cloth.setPinned(pinned);
    this.cloth.step(dt, capsules);
    const pos = this.cloth.positions;
    const column = {
      'hem.F': 0,
      'hem.L': cols / 4,
      'hem.B': cols / 2,
      'hem.R': (3 * cols) / 4,
    } as const;
    for (const j of chains) {
      const c = column[j.chain.id as keyof typeof column];
      if (c === undefined) continue;
      j.points.forEach((p, i) => {
        if (i === 0) return;
        const row = Math.min(rows - 1, Math.round((i / (j.points.length - 1)) * (rows - 1)));
        const k = (row * cols + c) * 3;
        p.set(pos[k] ?? p.x, pos[k + 1] ?? p.y, pos[k + 2] ?? p.z);
      });
    }
  }

  private resetSecondary() {
    this.springs?.reset();
    this.cloth = null; // rebuilt from the current waist ring on the next xpbd frame
  }

  /** True once the GLB has loaded and been drawn at least once (for QA and e2e). */
  get drawnOnce(): boolean {
    return this.renderer.ready && this.lastDrawn;
  }
  private lastDrawn = false;

  dispose() {
    this.renderer.dispose();
  }
}
