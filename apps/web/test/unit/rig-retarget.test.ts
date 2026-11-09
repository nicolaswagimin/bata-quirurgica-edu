import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  aimBone,
  bodyTargets,
  torsoQuaternion,
  toThree,
  type WorldPoint,
} from '../../src/ar/rig-retarget.ts';

/** Standing person facing the camera, MediaPipe world axes (y down, z away), hip-centred. */
function standing(): WorldPoint[] {
  const w: WorldPoint[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  const set = (i: number, x: number, y: number, z = 0) => {
    w[i] = { x, y, z, visibility: 1 };
  };
  // MediaPipe 11 = wearer's left, which appears at +x in the raw (unmirrored) camera image.
  set(11, 0.19, -0.5);
  set(12, -0.19, -0.5);
  set(13, 0.22, -0.22);
  set(14, -0.22, -0.22);
  set(15, 0.22, 0.05);
  set(16, -0.22, 0.05);
  set(23, 0.1, 0);
  set(24, -0.1, 0);
  return w;
}

describe('rig-retarget', () => {
  it('convierte a ejes de three: y arriba y hacia la cámara es +z', () => {
    const p = toThree({ x: 0.1, y: -0.5, z: 0 }, [0, 0, 2]);
    expect(p.toArray()).toEqual([0.1, 0.5, -2]);
  });

  it('el torso de frente: izquierda +x, arriba +y, adelante hacia la cámara (+z)', () => {
    const b = bodyTargets(standing(), [0, 0, 2]);
    if (!b) throw new Error('sin torso');
    expect(b.left.x).toBeCloseTo(1);
    expect(b.up.y).toBeCloseTo(1);
    expect(b.forward.z).toBeCloseTo(1);
    expect(b.shoulderWidth).toBeCloseTo(0.38);
    const q = torsoQuaternion(b);
    expect(q.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
  });

  it('sin hombros visibles no hay objetivos', () => {
    const w = standing();
    w[11] = { x: 0, y: 0, z: 0, visibility: 0 };
    expect(bodyTargets(w, [0, 0, 2])).toBeNull();
  });

  it('aimBone apunta el hueso al objetivo respetando al padre', () => {
    const parent = new THREE.Bone();
    parent.rotation.z = 0.4;
    const bone = new THREE.Bone();
    bone.position.set(0, 1, 0);
    parent.add(bone);
    const child = new THREE.Vector3(0, 1, 0);
    const target = new THREE.Vector3(3, 0, 0);
    aimBone(bone, child, target);
    const head = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
    const tip = child.clone().applyMatrix4(bone.matrixWorld);
    const dir = tip.sub(head).normalize();
    const want = target.clone().sub(head).normalize();
    expect(dir.distanceTo(want)).toBeLessThan(1e-6);
  });
});
