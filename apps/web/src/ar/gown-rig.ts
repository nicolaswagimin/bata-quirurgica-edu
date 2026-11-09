// Realistic AR gown (phase 3): the Blender pipeline's gown, exported with a simplified skeleton
// (tools/bata-3d/AR_RIG.md), rendered with a perspective camera calibrated to the webcam and
// driven by MediaPipe world landmarks. Hands are drawn in front of the gown with depth-only
// occluders. The secondary motion (spring bones or the optional XPBD proxy) is applied by the
// caller through `secondary`. If WebGL or the model fails, `failed` turns true and the caller
// falls back to the 2.5D gown.
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  createNonwovenMaterial,
  easeLights,
  type LightLevels,
  lightForLuma,
} from './nonwoven-material.ts';
import { aimBone, type BodyTargets, torsoQuaternion } from './rig-retarget.ts';

export const GOWN_RIG_URL = '/models/bata-ar-rig.glb';
/** Bone names of the AR rig contract (tools/bata-3d/AR_RIG.md). */
export const RIG_BONES = [
  'root',
  'spine',
  'chest',
  'neck',
  'shoulder.L',
  'upperarm.L',
  'forearm.L',
  'hand.L',
  'sleeve.L',
  'shoulder.R',
  'upperarm.R',
  'forearm.R',
  'hand.R',
  'sleeve.R',
  'hem.F.1',
  'hem.F.2',
  'hem.B.1',
  'hem.B.2',
  'hem.L.1',
  'hem.L.2',
  'hem.R.1',
  'hem.R.2',
  'tie.L',
  'tie.R',
] as const;
const DRACO_PATH = '/draco/';

/** Bones the retargeting aims, in hierarchy order, with the target joint each one points at. */
const AIMS: readonly [bone: string, child: string, target: keyof BodyTargets][] = [
  ['spine', 'chest', 'shoulderMid'],
  ['shoulder.L', 'upperarm.L', 'shoulderL'],
  ['upperarm.L', 'forearm.L', 'elbowL'],
  ['forearm.L', 'hand.L', 'wristL'],
  ['shoulder.R', 'upperarm.R', 'shoulderR'],
  ['upperarm.R', 'forearm.R', 'elbowR'],
  ['forearm.R', 'hand.R', 'wristR'],
];

export type SecondaryStep = (bones: ReadonlyMap<string, THREE.Bone>, body: BodyTargets) => void;

export class GownRigRenderer {
  failed = false;
  ready = false;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 20);
  private readonly root = new THREE.Group();
  private readonly bones = new Map<string, THREE.Bone>();
  private readonly rest = new Map<string, THREE.Quaternion>();
  private modelShoulderWidth = 0.38;
  private readonly hemi = new THREE.HemisphereLight(0xffffff, 0x4a5a66, 2);
  private readonly key = new THREE.DirectionalLight(0xffffff, 3);
  private readonly fill = new THREE.DirectionalLight(0xdcecff, 1);
  private lights: LightLevels = lightForLuma(120);
  private targetLights: LightLevels = lightForLuma(120);
  private readonly occluders: THREE.Mesh[] = [];
  private width = 0;
  private height = 0;
  private disposed = false;
  private draco: DRACOLoader | null = null;
  private readonly textures: THREE.Texture[] = [];

  constructor(canvas: HTMLCanvasElement, fabricHex: string, url = GOWN_RIG_URL) {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      this.failed = true;
      return;
    }
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.key.position.set(0.6, 1.2, 1.5);
    this.fill.position.set(-1, 0.4, 1);
    this.scene.add(this.hemi, this.key, this.fill, this.root);
    this.root.visible = false;
    this.addOccluders();
    // A lost WebGL context draws nothing: mark it failed so the 2.5D gown takes over.
    canvas.addEventListener('webglcontextlost', () => {
      this.failed = true;
    });
    this.draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
    new GLTFLoader().setDRACOLoader(this.draco).load(
      url,
      (gltf) => {
        if (this.disposed) {
          disposeTree(gltf.scene);
          return;
        }
        this.onLoaded(gltf.scene, fabricHex);
      },
      undefined,
      () => {
        this.failed = true;
      },
    );
  }

  private onLoaded(model: THREE.Object3D, fabricHex: string) {
    const fabric = createNonwovenMaterial(fabricHex);
    for (const texture of [fabric.map, fabric.normalMap]) if (texture) this.textures.push(texture);
    model.traverse((obj) => {
      // GLTFLoader sanitizes node names (it drops the dots of `upperarm.L`): map back to the
      // contract names of tools/bata-3d/AR_RIG.md.
      if (obj instanceof THREE.Bone) {
        const contract = RIG_BONES.find(
          (name) => THREE.PropertyBinding.sanitizeNodeName(name) === obj.name,
        );
        if (contract) this.bones.set(contract, obj);
      }
      if (obj instanceof THREE.SkinnedMesh) {
        obj.frustumCulled = false;
        // The gown body takes the generated non-woven fabric; trims and ties keep their colour.
        if (/gown/i.test(obj.name)) obj.material = fabric;
      }
    });
    const missing = AIMS.flatMap(([b, c]) => [b, c]).filter((name) => !this.bones.has(name));
    const upL = this.bones.get('upperarm.L');
    const upR = this.bones.get('upperarm.R');
    if (missing.length > 0 || !upL || !upR) {
      this.failed = true;
      return;
    }
    model.updateMatrixWorld(true);
    const a = new THREE.Vector3().setFromMatrixPosition(upL.matrixWorld);
    const b = new THREE.Vector3().setFromMatrixPosition(upR.matrixWorld);
    this.modelShoulderWidth = a.distanceTo(b) || 0.38;
    for (const [name, bone] of this.bones) this.rest.set(name, bone.quaternion.clone());
    // The model's origin is Blender's floor; shift it so the root bone (hip centre) sits at the
    // group's origin, which render() places on the player's hips.
    const rootBone = this.bones.get('root');
    if (rootBone)
      model.position.sub(new THREE.Vector3().setFromMatrixPosition(rootBone.matrixWorld));
    this.root.add(model);
    this.ready = true;
  }

  /** Depth-only spheres at the hands: the video hands show in front of the gown. */
  private addOccluders() {
    const material = new THREE.MeshBasicMaterial({ colorWrite: false });
    for (let i = 0; i < 2; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
      mesh.renderOrder = -1;
      mesh.visible = false;
      this.occluders.push(mesh);
      this.scene.add(mesh);
    }
  }

  setFov(fovY: number) {
    const deg = THREE.MathUtils.radToDeg(fovY);
    if (Math.abs(deg - this.camera.fov) > 0.05) {
      this.camera.fov = deg;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Camera image brightness (0..255): the light rig eases towards it. */
  setLuma(luma: number) {
    this.targetLights = lightForLuma(luma);
  }

  /** Draws the gown on `body` (or clears when null). Returns false if nothing was drawn. */
  render(body: BodyTargets | null, width: number, height: number, secondary?: SecondaryStep) {
    const renderer = this.renderer;
    if (!renderer || this.failed) return false;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (!this.ready || !body) {
      renderer.clear();
      return false;
    }
    this.lights = easeLights(this.lights, this.targetLights);
    this.hemi.intensity = this.lights.hemisphere;
    this.key.intensity = this.lights.key;
    this.fill.intensity = this.lights.fill;
    renderer.toneMappingExposure = this.lights.exposure;

    this.root.visible = true;
    this.root.position.copy(body.hipMid);
    this.root.quaternion.copy(torsoQuaternion(body));
    this.root.scale.setScalar(body.shoulderWidth / this.modelShoulderWidth);
    for (const [name, q] of this.rest) this.bones.get(name)?.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
    for (const [boneName, childName, target] of AIMS) {
      const bone = this.bones.get(boneName);
      const child = this.bones.get(childName);
      const point = body[target];
      if (bone && child && point instanceof THREE.Vector3) aimBone(bone, child.position, point);
    }
    secondary?.(this.bones, body);
    this.placeOccluders(body);
    renderer.render(this.scene, this.camera);
    return true;
  }

  private placeOccluders(body: BodyTargets) {
    const radius = body.shoulderWidth * 0.2;
    [body.wristL, body.wristR].forEach((wrist, i) => {
      const mesh = this.occluders[i];
      if (!mesh) return;
      // The hand sits a little past the wrist, along the forearm.
      const elbow = i === 0 ? body.elbowL : body.elbowR;
      const hand = wrist.clone().add(wrist.clone().sub(elbow).multiplyScalar(0.35));
      mesh.position.copy(hand);
      mesh.scale.setScalar(radius);
      mesh.visible = true;
    });
  }

  dispose() {
    this.disposed = true;
    disposeTree(this.scene);
    for (const texture of this.textures) texture.dispose();
    this.draco?.dispose();
    this.renderer?.dispose();
  }
}

/** Frees geometries, materials and their textures under `root`. */
function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of materials) {
      for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
      m.dispose();
    }
  });
}
