import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export type PoseDelegate = 'GPU' | 'CPU';

export function preferredDelegate(env: {
  userAgent: string;
  maxTouchPoints: number;
  search: string;
}): PoseDelegate {
  const override = new URLSearchParams(env.search).get('delegado');
  if (override === 'cpu') return 'CPU';
  if (override === 'gpu') return 'GPU';
  return /iPhone|iPad|iPod/i.test(env.userAgent) ||
    (/Macintosh/i.test(env.userAgent) && env.maxTouchPoints > 1)
    ? 'CPU'
    : 'GPU';
}

// Runtime and model are self-hosted (scripts/prepare-mediapipe.ts): the AR page only talks to its
// own origin and camera frames never leave the browser.
const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/pose_landmarker_lite.task';

export async function createPoseLandmarker(
  preferred: PoseDelegate,
  moduleWorker = false,
): Promise<{
  landmarker: PoseLandmarker;
  delegate: PoseDelegate;
}> {
  // Module workers need the ESM glue: importScripts throws and MediaPipe uses import().
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH, moduleWorker);
  const create = (delegate: PoseDelegate) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  try {
    return { landmarker: await create(preferred), delegate: preferred };
  } catch {
    // Either delegate may be unavailable on a particular device.
    const fallback = preferred === 'GPU' ? 'CPU' : 'GPU';
    return { landmarker: await create(fallback), delegate: fallback };
  }
}
