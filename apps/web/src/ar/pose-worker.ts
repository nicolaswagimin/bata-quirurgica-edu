import { createPoseLandmarker } from './pose.ts';
import type { WorkerReply, WorkerRequest } from './pose-detector.ts';
import { shouldFallbackToCpu } from './pose-performance.ts';

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<WorkerRequest>) => void;
  postMessage: (message: WorkerReply) => void;
};
let model: Awaited<ReturnType<typeof createPoseLandmarker>> | null = null;
let busy = false;
let closed = false;
let reported = false;
const durations: number[] = [];
const fail = (error: unknown) => scope.postMessage({ type: 'error', message: String(error) });

scope.onmessage = ({ data }) => {
  if (data.type === 'close') {
    closed = true;
    model?.landmarker.close();
    model = null;
    return;
  }
  if (data.type === 'init') {
    if (busy || model || closed) return;
    busy = true;
    void createPoseLandmarker(data.delegate, true)
      .then(async (loaded) => {
        if (closed) return loaded.landmarker.close();
        model = loaded;
        // Warm cold shaders under the 20 s init deadline, before the 5 s frame deadline.
        // This synthetic canvas contains no camera data.
        const warmup = new OffscreenCanvas(640, 480);
        warmup.getContext('2d')?.fillRect(0, 0, 640, 480);
        const start = performance.now();
        loaded.landmarker.detectForVideo(warmup, 0);
        durations.push(performance.now() - start);
        if (closed || reportSlow()) return;
        busy = false;
        scope.postMessage({ type: 'ready', delegate: loaded.delegate });
      })
      .catch(fail);
    return;
  }
  if (busy || closed || !model) {
    data.bitmap.close();
    scope.postMessage({ type: 'skipped' });
    return;
  }
  busy = true;
  void detect(data);
};

function detect(data: Extract<WorkerRequest, { type: 'frame' }>) {
  try {
    if (!model) return;
    const start = performance.now();
    const pose = model.landmarker.detectForVideo(data.bitmap, data.timestamp);
    const detectMs = performance.now() - start;
    const plain = ({
      x,
      y,
      z,
      visibility,
    }: {
      x: number;
      y: number;
      z: number;
      visibility: number;
    }) => ({ x, y, z, visibility });
    const result: WorkerReply = {
      type: 'result',
      timestamp: data.timestamp,
      detectMs,
      landmarks: (pose.landmarks[0] ?? []).map(plain),
      worldLandmarks: pose.worldLandmarks[0]?.map(plain) ?? null,
    };
    if (durations.length < 8 || detectMs > 1000) durations.push(detectMs);
    if (closed) return;
    scope.postMessage(result);
    reportSlow();
  } catch (error) {
    fail(error);
  } finally {
    data.bitmap.close();
    busy = false;
  }
}

/**
 * A slow GPU is reported instead of replaced here: a module worker cannot build a second
 * landmarker (the cached ESM glue does not re-register its factory), so the client starts a
 * fresh CPU worker.
 */
function reportSlow(): boolean {
  if (!model || reported || !shouldFallbackToCpu(durations, model.delegate)) return false;
  reported = true;
  scope.postMessage({ type: 'slow' });
  return true;
}
