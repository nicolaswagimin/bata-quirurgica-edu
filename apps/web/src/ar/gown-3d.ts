// Renderer de la bata 3D sobre el video. El canvas WebGL va debajo del canvas 2D: la malla 3D se
// encarga de la bata puesta y el 2D sigue dibujando máscara, guantes, avisos y cursor. Si el
// navegador no da WebGL, `ok` queda en false y el llamador deja la bata 2.5D.
import * as THREE from 'three';
import type { Scene } from './game-steps.ts';
import { boneTargets, buildGown3D, GOWN3D_BONES, type Gown3DBone } from './gown-3d-mesh.ts';
import type { GownMotion } from './gown-motion.ts';
import type { BodyFrame } from './posture.ts';

export type Gown3DColors = { fabric: string; trim: string };

export class Gown3DRenderer {
  readonly ok: boolean;
  private readonly renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(0, 1, 0, 1, -2000, 2000);
  private readonly group = new THREE.Group();
  private readonly mesh: THREE.SkinnedMesh | null = null;
  private readonly skeleton: THREE.Skeleton | null = null;
  private readonly bones: THREE.Bone[] = [];
  private width = 0;
  private height = 0;

  constructor(canvas: HTMLCanvasElement, colors: Gown3DColors) {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      this.ok = false;
      return;
    }
    this.ok = true;
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const data = buildGown3D();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(data.skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(data.skinWeights, 4));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.computeVertexNormals();

    for (const name of GOWN3D_BONES) {
      const bone = new THREE.Bone();
      const [x, y, z] = data.bind[name];
      bone.position.set(x, y, z);
      this.bones.push(bone);
      this.group.add(bone);
    }
    this.skeleton = new THREE.Skeleton(this.bones);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.fabric),
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.frustumCulled = false;
    this.mesh = mesh;
    this.group.add(mesh);
    this.scene.add(this.group);
    // Bind with the group at the identity: the bones stay in canonical units and the group applies
    // the body transform (position, turn and shoulder width) every frame.
    mesh.bind(this.skeleton);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(320, -420, 900);
    this.scene.add(key, key.target);
    this.camera.position.set(0, 0, 1000);
    this.camera.lookAt(0, 0, 0);
  }

  render(
    body: BodyFrame | null,
    scene: Scene | null,
    motion: GownMotion | null,
    width: number,
    height: number,
  ): void {
    if (!this.ok || !this.renderer || !this.skeleton) return;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.renderer.setSize(w, h, false);
      this.camera.left = 0;
      this.camera.right = w;
      this.camera.top = 0;
      this.camera.bottom = h;
      this.camera.updateProjectionMatrix();
    }
    if (!body || !scene || scene.gown !== 'worn') {
      this.renderer.clear();
      return;
    }

    const across = new THREE.Vector3(body.across.x, body.across.y, 0).normalize();
    const down = new THREE.Vector3(body.down.x, body.down.y, 0).normalize();
    const normal = new THREE.Vector3().crossVectors(across, down).normalize();
    this.group.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(across, down, normal),
    );
    this.group.position.set(body.shoulderMid.x, body.shoulderMid.y, 0);
    this.group.scale.setScalar(body.shoulderWidth);

    const targets = boneTargets(body, motion);
    for (let i = 0; i < this.bones.length; i++) {
      const target = targets[GOWN3D_BONES[i] as Gown3DBone];
      this.bones[i]?.position.set(target[0], target[1], target[2]);
    }
    // Los huesos tienen que estar en world antes de recalcular la piel; si no, la bata va un frame
    // atrás del cuerpo.
    this.group.updateMatrixWorld(true);
    this.skeleton.update();

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      const material = this.mesh.material;
      if (Array.isArray(material))
        material.forEach((entry) => {
          entry.dispose();
        });
      else material.dispose();
    }
    this.renderer?.dispose();
  }
}
