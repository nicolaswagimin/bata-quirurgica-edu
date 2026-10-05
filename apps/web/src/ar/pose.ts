import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export type PoseDelegate = 'GPU' | 'CPU';

// Runtime and model are self-hosted (scripts/prepare-mediapipe.ts): the AR page only talks to its
// own origin and camera frames never leave the browser.
const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/pose_landmarker_lite.task';

export async function createPoseLandmarker(): Promise<{
  landmarker: PoseLandmarker;
  delegate: PoseDelegate;
}> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const create = (delegate: PoseDelegate) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  try {
    return { landmarker: await create('GPU'), delegate: 'GPU' };
  } catch {
    // Headless Chromium and some phones have no usable WebGL: fall back to CPU.
    return { landmarker: await create('CPU'), delegate: 'CPU' };
  }
}
