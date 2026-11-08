import {
  Bone,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Quaternion,
  SkinnedMesh,
  Vector3,
} from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const v = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
const position = (object: Object3D) => object.getWorldPosition(v());
const orientation = (object: Object3D) => object.getWorldQuaternion(new Quaternion());

function aim(bone: Bone, current: Vector3, desired: Vector3) {
  const change = new Quaternion().setFromUnitVectors(current.normalize(), desired.normalize());
  bone.quaternion.copy(
    orientation(bone.parent!).invert().multiply(change).multiply(orientation(bone)),
  );
  bone.updateWorldMatrix(false, true);
}

export function clinician(template: Object3D, assistant = false) {
  const model = clone(template);
  const root = new Group();
  root.add(model);
  const handState = { value: v(0, 0, 0) };
  const personal: MeshStandardMaterial[] = [];
  model.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const material = (m: MeshStandardMaterial) => {
      const c = m.clone();
      personal.push(c);
      if (/eyebrow|eyelash|mouth_protection/i.test(c.name)) c.alphaTest = 0.5;
      c.transparent = false;
      c.depthWrite = true;
      if (assistant && /shirt|pants|cap-fabric/i.test(c.name)) c.color.copy(new Color('#56638a'));
      if (!assistant && /^Human\.(body|fingernails)$/.test(c.name)) {
        c.onBeforeCompile = (shader) => {
          shader.uniforms.handState = handState;
          shader.vertexShader =
            'varying vec3 bindPoint;\n' +
            shader.vertexShader.replace(
              '#include <begin_vertex>',
              '#include <begin_vertex>\nbindPoint=position;',
            );
          shader.fragmentShader =
            'varying vec3 bindPoint; uniform vec3 handState;\n' +
            shader.fragmentShader.replace(
              '#include <color_fragment>',
              `#include <color_fragment>
            if(abs(bindPoint.x)>.085 && bindPoint.z>.16 && bindPoint.y>1.145){
              float state=bindPoint.x>0.?handState.x:handState.y;
              if(state<-.5) discard;
              if(state>.5) diffuseColor.rgb=vec3(.70,.86,.77);
            }`,
            );
        };
      }
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(material) : material(o.material);
    o.frustumCulled = false;
  });
  function bone(name: string) {
    let found: Bone | undefined;
    model.traverse((o) => {
      if (o instanceof Bone && (o.userData.name === name || o.name === name.replaceAll('.', '')))
        found = o;
    });
    if (!found) throw new Error('Falta el hueso ' + name);
    return found;
  }
  function arm(side: string, sign: number) {
    const upper = bone('upperarm01.' + side),
      lower = bone('lowerarm01.' + side),
      wrist = bone('wrist.' + side),
      knuckle = bone('finger3-1.' + side);
    const initial = [upper, lower, wrist].map((b) => b.quaternion.clone());
    const l1 = position(upper).distanceTo(position(lower)),
      l2 = position(lower).distanceTo(position(wrist));
    const wristRest = orientation(wrist);
    const palm = position(knuckle).sub(position(wrist)).normalize();
    return (destination: Vector3, fingers: Vector3) => {
      [upper, lower, wrist].forEach((b, i) => {
        b.quaternion.copy(initial[i]!);
      });
      const target = root.localToWorld(destination.clone()),
        a = position(upper),
        axis = target.clone().sub(a).normalize();
      const d = Math.min(
        l1 + l2 - 0.001,
        Math.max(Math.abs(l1 - l2) + 0.001, a.distanceTo(target)),
      );
      const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
      const pole = v(sign * 0.62, -1, -0.34).applyQuaternion(orientation(root));
      pole.addScaledVector(axis, -pole.dot(axis)).normalize();
      const elbow = a
        .clone()
        .addScaledVector(axis, along)
        .addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
      aim(upper, position(lower).sub(a), elbow.sub(a));
      const b = position(lower);
      aim(lower, position(wrist).sub(b), a.addScaledVector(axis, d).sub(b));
      const hand = new Quaternion()
        .setFromUnitVectors(palm, fingers.clone().normalize())
        .multiply(wristRest);
      wrist.quaternion.copy(
        orientation(wrist.parent!).invert().multiply(orientation(root)).multiply(hand),
      );
      wrist.updateWorldMatrix(false, true);
      return {
        shoulder: root.worldToLocal(position(upper)),
        elbow: root.worldToLocal(position(lower)),
        wrist: root.worldToLocal(position(wrist)),
        tip: root.worldToLocal(position(knuckle)).lerp(root.worldToLocal(position(wrist)), -0.91),
      };
    };
  }
  const left = arm('L', 1),
    right = arm('R', -1);
  // Copy the hand triangles with their original skin weights. The latex follows every finger.
  const gloves = [new Group(), new Group()];
  if (!assistant) {
    const bodyMeshes: SkinnedMesh[] = [];
    model.traverse((o) => {
      if (
        o instanceof SkinnedMesh &&
        !Array.isArray(o.material) &&
        o.material.name === 'Human.body'
      )
        bodyMeshes.push(o);
    });
    for (const m of bodyMeshes) {
      const geo = m.geometry,
        pos = geo.getAttribute('position'),
        idx = geo.index;
      if (!idx) continue;
      const wristY = 1.2;
      for (const [i, sign] of [1, -1].entries()) {
        const triangles: number[] = [];
        for (let k = 0; k < idx.count; k += 3) {
          const indices = [idx.getX(k), idx.getX(k + 1), idx.getX(k + 2)];
          if (
            indices.every(
              (id) =>
                pos.getX(id) * sign > 0.09 && pos.getZ(id) > 0.16 && pos.getY(id) > wristY - 0.042,
            )
          )
            triangles.push(...indices);
        }
        if (!triangles.length) continue;
        const skin = geo.clone();
        skin.setIndex(triangles);
        const p = skin.getAttribute('position'),
          n = skin.getAttribute('normal');
        for (let id = 0; id < p.count; id++)
          p.setXYZ(
            id,
            p.getX(id) + 0.004 * n.getX(id),
            p.getY(id) + 0.004 * n.getY(id),
            p.getZ(id) + 0.004 * n.getZ(id),
          );
        const latex = new MeshStandardMaterial({
          color: 0xd8eee2,
          roughness: 0.47,
        });
        const g = new SkinnedMesh(skin, latex);
        g.bind(m.skeleton, m.bindMatrix);
        g.frustumCulled = false;
        gloves[i]!.add(g);
      }
    }
    model.add(...gloves);
  }
  return {
    root,
    left,
    right,
    gloves,
    handState,
    dispose() {
      for (const m of personal) m.dispose();
      model.traverse((o) => {
        if (o instanceof SkinnedMesh) o.skeleton.dispose();
      });
      for (const g of gloves)
        g.traverse((o) => {
          if (o instanceof Mesh) {
            o.geometry.dispose();
            o.material.dispose();
          }
        });
    },
  };
}

export type Limb = ReturnType<ReturnType<typeof clinician>['left']>;
