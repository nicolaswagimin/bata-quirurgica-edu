// Retargeting from MediaPipe world landmarks to the simplified AR gown skeleton
// (tools/bata-3d/AR_RIG.md). Landmarks arrive in metres, hip-centred, camera-aligned with y down
// and z away from the camera (OpenCV); three.js uses y up and looks down −z, so a point maps to
// (x, −y, −z) after adding the camera translation solved by camera-fov.ts.
import * as THREE from 'three';

export type WorldPoint = { x: number; y: number; z: number; visibility?: number };

/** Camera-space position (three.js axes) of a landmark given the solved translation. */
export function toThree(p: WorldPoint, t: readonly [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(p.x + t[0], -(p.y + t[1]), -(p.z + t[2]));
}

export interface BodyTargets {
  hipMid: THREE.Vector3;
  shoulderMid: THREE.Vector3;
  shoulderL: THREE.Vector3;
  shoulderR: THREE.Vector3;
  elbowL: THREE.Vector3;
  elbowR: THREE.Vector3;
  wristL: THREE.Vector3;
  wristR: THREE.Vector3;
  /** Unit vectors of the torso: wearer's left, up, and forward (towards the camera when facing). */
  left: THREE.Vector3;
  up: THREE.Vector3;
  forward: THREE.Vector3;
  shoulderWidth: number;
}

const visibleEnough = (p: WorldPoint | undefined) => !!p && (p.visibility ?? 1) >= 0.3;

/** Joint targets in camera space; null if the torso is not visible. */
export function bodyTargets(
  world: readonly WorldPoint[],
  t: readonly [number, number, number],
): BodyTargets | null {
  const ids = [11, 12, 13, 14, 15, 16, 23, 24];
  if (![11, 12, 23, 24].every((i) => visibleEnough(world[i]))) return null;
  const [sL, sR, eL, eR, wL, wR, hL, hR] = ids.map((i) => toThree(world[i] as WorldPoint, t)) as [
    THREE.Vector3,
    THREE.Vector3,
    THREE.Vector3,
    THREE.Vector3,
    THREE.Vector3,
    THREE.Vector3,
    THREE.Vector3,
    THREE.Vector3,
  ];
  const hipMid = hL.clone().add(hR).multiplyScalar(0.5);
  const shoulderMid = sL.clone().add(sR).multiplyScalar(0.5);
  const up = shoulderMid.clone().sub(hipMid).normalize();
  // MediaPipe 11 is the wearer's left shoulder.
  const leftRaw = sL.clone().sub(sR);
  const left = leftRaw
    .clone()
    .sub(up.clone().multiplyScalar(leftRaw.dot(up)))
    .normalize();
  const forward = new THREE.Vector3().crossVectors(left, up).normalize();
  return {
    hipMid,
    shoulderMid,
    shoulderL: sL,
    shoulderR: sR,
    elbowL: eL,
    elbowR: eR,
    wristL: wL,
    wristR: wR,
    left,
    up,
    forward,
    shoulderWidth: sL.distanceTo(sR),
  };
}

/** Rotation whose basis is (left, up, forward): the gown model faces +Z with its left on +X. */
export function torsoQuaternion(b: BodyTargets): THREE.Quaternion {
  const m = new THREE.Matrix4().makeBasis(b.left, b.up, b.forward);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpParent = new THREE.Quaternion();

/**
 * Rotates `bone` (in world space) so the direction from its head to `childLocal` (a point in the
 * bone's local space, usually the child's rest position or the tail) points at `target`. The
 * parents' world matrices must be current; the bone's matrixWorld is refreshed afterwards.
 */
export function aimBone(bone: THREE.Object3D, childLocal: THREE.Vector3, target: THREE.Vector3) {
  bone.updateWorldMatrix(true, false);
  const head = tmpA.setFromMatrixPosition(bone.matrixWorld);
  const tip = tmpB.copy(childLocal).applyMatrix4(bone.matrixWorld);
  const current = tip.sub(head).normalize();
  const desired = target.clone().sub(head);
  if (desired.lengthSq() < 1e-10 || current.lengthSq() < 1e-10) return;
  desired.normalize();
  const delta = tmpQ.setFromUnitVectors(current, desired);
  const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
  const newWorld = delta.multiply(worldQ);
  const parentWorld = bone.parent
    ? bone.parent.getWorldQuaternion(tmpParent)
    : tmpParent.identity();
  bone.quaternion.copy(parentWorld.invert().multiply(newWorld));
  bone.updateWorldMatrix(false, true);
}
