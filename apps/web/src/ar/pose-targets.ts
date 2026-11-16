import type { PracticeKind } from '@bata/shared/schemas';
import { type BodyFrame, dist, type Vec } from './posture.ts';

export interface TorsoPoint {
  side: number;
  depth: number;
}
export type Joint = 'leftWrist' | 'rightWrist' | 'leftElbow' | 'rightElbow';
export type TargetPose = Record<Joint, TorsoPoint>;
export const JOINT_OK_DISTANCE = 0.2;
export const JOINT_NEAR_DISTANCE = 0.5;

const JOINTS: Joint[] = ['leftWrist', 'rightWrist', 'leftElbow', 'rightElbow'];

/** Targets describe image geometry; forward depth and motion are checked separately by the engine. */
export function targetPose(kind: PracticeKind): TargetPose | null {
  if (kind === 'turn') return null;
  let wristSide = 0.3;
  let wristDepth = 0.38;
  let elbowSide = 0.62;
  let elbowDepth = 0.45;
  switch (kind) {
    case 'mask':
      wristSide = 0.15;
      wristDepth = -0.38;
      elbowDepth = 0.12;
      break;
    case 'neck':
      wristSide = 0.25;
      wristDepth = -0.12;
      elbowDepth = 0.22;
      break;
    case 'unfold':
      wristSide = 0.6;
      wristDepth = 0;
      elbowSide = 0.7;
      elbowDepth = 0.18;
      break;
    case 'sleeves':
      wristSide = 0.55;
      wristDepth = 0.15;
      elbowSide = 0.55;
      elbowDepth = 0.22;
      break;
    case 'friction':
    case 'gloves':
      wristSide = 0.15;
      break;
  }
  return {
    leftWrist: { side: wristSide, depth: wristDepth },
    rightWrist: { side: -wristSide, depth: wristDepth },
    leftElbow: { side: elbowSide, depth: elbowDepth },
    rightElbow: { side: -elbowSide, depth: elbowDepth },
  };
}

export function toImage(body: BodyFrame, p: TorsoPoint): Vec {
  return {
    x:
      body.shoulderMid.x +
      body.across.x * p.side * body.shoulderWidth +
      body.down.x * p.depth * body.torsoHeight,
    y:
      body.shoulderMid.y +
      body.across.y * p.side * body.shoulderWidth +
      body.down.y * p.depth * body.torsoHeight,
  };
}

export interface GhostSkeleton {
  points: Record<Joint | 'head' | 'leftShoulder' | 'rightShoulder' | 'leftHip' | 'rightHip', Vec>;
  bones: [Vec, Vec][];
  headRadius: number;
  limbWidth: number;
}

export function ghostSkeleton(body: BodyFrame, kind: PracticeKind): GhostSkeleton | null {
  const pose = targetPose(kind);
  if (!pose) return null;
  // BodyFrame retains only hipMid, so hip width is estimated around the user's hip centre.
  const hip = (side: number): Vec => ({
    x: body.hipMid.x + body.across.x * body.shoulderWidth * side,
    y: body.hipMid.y + body.across.y * body.shoulderWidth * side,
  });
  const points: GhostSkeleton['points'] = {
    head: toImage(body, { side: 0, depth: -0.4 }),
    leftShoulder: body.left.shoulder,
    rightShoulder: body.right.shoulder,
    leftHip: hip(0.4),
    rightHip: hip(-0.4),
    leftWrist: toImage(body, pose.leftWrist),
    rightWrist: toImage(body, pose.rightWrist),
    leftElbow: toImage(body, pose.leftElbow),
    rightElbow: toImage(body, pose.rightElbow),
  };
  const p = points;
  return {
    points,
    bones: [
      [p.leftShoulder, p.rightShoulder],
      [p.leftShoulder, p.leftElbow],
      [p.leftElbow, p.leftWrist],
      [p.rightShoulder, p.rightElbow],
      [p.rightElbow, p.rightWrist],
      [p.leftShoulder, p.leftHip],
      [p.rightShoulder, p.rightHip],
      [p.leftHip, p.rightHip],
    ],
    headRadius: body.shoulderWidth * 0.18,
    limbWidth: body.shoulderWidth * 0.08,
  };
}

export interface JointStatus {
  joint: Joint;
  current: Vec;
  target: Vec;
  distance: number;
  status: 'ok' | 'near' | 'far';
  arrow: Vec | null;
  /** Pixel displacement projected onto the torso axes, for mirror-independent hints. */
  torsoDelta: TorsoPoint;
  currentSide: number;
}

export function jointStatus(body: BodyFrame, kind: PracticeKind): JointStatus[] {
  const pose = targetPose(kind);
  if (!pose) return [];
  return JOINTS.flatMap((joint): JointStatus[] => {
    const limb = joint.startsWith('left') ? body.left : body.right;
    const current = joint.endsWith('Wrist') ? limb.wrist : limb.elbow;
    if (!current) return [];
    const target = toImage(body, pose[joint]);
    const length = dist(current, target);
    const distance = length / body.shoulderWidth;
    const status =
      distance <= JOINT_OK_DISTANCE ? 'ok' : distance <= JOINT_NEAR_DISTANCE ? 'near' : 'far';
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    return [
      {
        joint,
        current,
        target,
        distance,
        status,
        arrow: status === 'ok' ? null : { x: dx / length, y: dy / length },
        torsoDelta: {
          side: dx * body.across.x + dy * body.across.y,
          depth: dx * body.down.x + dy * body.down.y,
        },
        currentSide:
          ((current.x - body.shoulderMid.x) * body.across.x +
            (current.y - body.shoulderMid.y) * body.across.y) /
          body.shoulderWidth,
      },
    ];
  });
}

export function jointHint(statuses: readonly JointStatus[]): string | null {
  const worst = [...statuses]
    .filter((s) => s.status !== 'ok')
    .sort(
      (a, b) =>
        b.distance - a.distance ||
        Number(b.joint.endsWith('Wrist')) - Number(a.joint.endsWith('Wrist')),
    )[0];
  if (!worst) return null;
  const wrist = worst.joint.endsWith('Wrist');
  const left = worst.joint.startsWith('left');
  const name = wrist
    ? `la muñeca ${left ? 'izquierda' : 'derecha'}`
    : `el codo ${left ? 'izquierdo' : 'derecho'}`;
  const { side, depth } = worst.torsoDelta;
  if (Math.abs(depth) >= Math.abs(side)) return `${depth < 0 ? 'Sube' : 'Baja'} ${name}`;
  const inward = side * worst.currentSide < 0;
  return inward ? `Acerca ${name} al cuerpo` : `Separa ${name} del cuerpo`;
}
