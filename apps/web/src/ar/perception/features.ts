// MediaPipe Pose landmarks → features normalizadas al torso (contrato en @bata/shared/perception).
// Puro: sin DOM ni MediaPipe. El extractor fija un sistema de referencia por frame (origen en el
// punto medio de los hombros, `x` a lo largo de la línea de hombros, `y` hacia las caderas y escala
// = ancho de hombros), así que la posición, el tamaño y la rotación del cuerpo no contaminan el
// modelo. Las manos quedan reservadas para MediaPipe Hands.
import {
  type Angles,
  BODY_POINTS,
  type BodyPoint,
  type FeatureFrame,
  type FeaturePoint,
  type Torso,
  type Velocity,
} from '@bata/shared/perception';
import type { FrameSize, Landmark } from '../overlay-math.ts';

/** Índice de MediaPipe Pose para cada punto del contrato. */
export const BODY_POINT_INDEX: Record<BodyPoint, number> = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

const MIN_VISIBILITY = 0.5;
const MIN_DT_MS = 16;
const MAX_DT_MS = 500;
const DEFAULT_DT_MS = 66;

type Vec = { x: number; y: number };

const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
const len = (a: Vec): number => Math.hypot(a.x, a.y);
const scaleVec = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function visible(landmark: Landmark | undefined): landmark is Landmark {
  return !!landmark && (landmark.visibility ?? 0) >= MIN_VISIBILITY;
}

function toPixels(landmark: Landmark, size: FrameSize): Vec {
  return { x: landmark.x * size.width, y: landmark.y * size.height };
}

function angleBetween(from: Vec, to: Vec): number {
  const denominator = len(from) * len(to);
  if (denominator < 1e-6) return -1;
  return Math.acos(Math.max(-1, Math.min(1, dot(from, to) / denominator)));
}

/** Ángulo en el codo; `-1` cuando falta un punto. */
function elbowAngle(shoulder: Vec | null, elbow: Vec | null, wrist: Vec | null): number {
  if (!shoulder || !elbow || !wrist) return -1;
  return angleBetween(sub(shoulder, elbow), sub(wrist, elbow));
}

/** Ángulo en el hombro entre el torso y el brazo; `-1` cuando falta un punto. */
function shoulderAngle(hip: Vec | null, shoulder: Vec | null, elbow: Vec | null): number {
  if (!hip || !shoulder || !elbow) return -1;
  return angleBetween(sub(hip, shoulder), sub(elbow, shoulder));
}

function secondsBetween(dtMs: number | undefined): number {
  if (dtMs === undefined || !Number.isFinite(dtMs)) return DEFAULT_DT_MS / 1000;
  return Math.min(MAX_DT_MS, Math.max(MIN_DT_MS, dtMs)) / 1000;
}

export type ExtractInput = {
  landmarks: readonly Landmark[];
  size: FrameSize;
  /** Milisegundos desde el inicio de la toma. */
  t: number;
  /** Milisegundos desde el frame anterior; se usa para las velocidades. */
  dtMs?: number;
  previous?: FeatureFrame | null;
};

/**
 * Extrae un frame de features o devuelve null si no hay torso: hombros y caderas deben verse y el
 * ancho de hombros tiene que ser positivo.
 */
export function extractFeatures(input: ExtractInput): FeatureFrame | null {
  const { landmarks, size, t } = input;
  const leftShoulder = landmarks[BODY_POINT_INDEX.leftShoulder];
  const rightShoulder = landmarks[BODY_POINT_INDEX.rightShoulder];
  const leftHip = landmarks[BODY_POINT_INDEX.leftHip];
  const rightHip = landmarks[BODY_POINT_INDEX.rightHip];
  if (!visible(leftShoulder) || !visible(rightShoulder) || !visible(leftHip) || !visible(rightHip)) {
    return null;
  }

  const L = toPixels(leftShoulder, size);
  const R = toPixels(rightShoulder, size);
  const LH = toPixels(leftHip, size);
  const RH = toPixels(rightHip, size);

  const shoulderWidth = Math.hypot(L.x - R.x, L.y - R.y);
  if (shoulderWidth < 1) return null;
  const shoulderMid = mid(L, R);
  const hipMid = mid(LH, RH);
  const across = scaleVec(sub(L, R), 1 / shoulderWidth);

  const downRaw = sub(hipMid, shoulderMid);
  const torsoHeight = len(downRaw);
  if (torsoHeight < 1) return null;
  // Ortogonaliza el eje del torso contra la línea de hombros: el marco no se deforma al girar.
  const downOrtho = sub(downRaw, scaleVec(across, dot(downRaw, across)));
  const downLen = len(downOrtho);
  if (downLen < 1) return null;
  const down = scaleVec(downOrtho, 1 / downLen);

  const project = (point: Vec): Vec => {
    const d = sub(point, shoulderMid);
    return { x: dot(d, across) / shoulderWidth, y: dot(d, down) / shoulderWidth };
  };

  const points: FeaturePoint[] = BODY_POINTS.map((name) => {
    const landmark = landmarks[BODY_POINT_INDEX[name]];
    if (!visible(landmark)) return { x: 0, y: 0, z: 0, visibility: 0 };
    const q = project(toPixels(landmark, size));
    return {
      x: q.x,
      y: q.y,
      z: ((landmark.z ?? 0) * size.width) / shoulderWidth,
      visibility: Math.min(1, Math.max(0, landmark.visibility ?? 0)),
    };
  });

  const at = (name: BodyPoint): Vec | null => {
    const landmark = landmarks[BODY_POINT_INDEX[name]];
    return visible(landmark) ? project(toPixels(landmark, size)) : null;
  };

  const angles: Angles = {
    leftElbow: elbowAngle(at('leftShoulder'), at('leftElbow'), at('leftWrist')),
    rightElbow: elbowAngle(at('rightShoulder'), at('rightElbow'), at('rightWrist')),
    leftShoulder: shoulderAngle(at('leftHip'), at('leftShoulder'), at('leftElbow')),
    rightShoulder: shoulderAngle(at('rightHip'), at('rightShoulder'), at('rightElbow')),
    torsoTilt: Math.atan2(downRaw.x, downRaw.y),
  };

  const dt = secondsBetween(input.dtMs);
  const velocities: Velocity[] = points.map((point, i) => {
    const before = input.previous?.points[i];
    if (!before || point.visibility === 0) return { x: 0, y: 0 };
    return { x: (point.x - before.x) / dt, y: (point.y - before.y) / dt };
  });

  const torso: Torso = {
    centerX: (shoulderMid.x + hipMid.x) / 2,
    centerY: (shoulderMid.y + hipMid.y) / 2,
    shoulderWidth,
    torsoHeight,
    angleRad: Math.atan2(L.y - R.y, L.x - R.x),
  };

  return { t, points, velocities, angles, torso, hands: [] };
}
