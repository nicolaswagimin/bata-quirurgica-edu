import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { Landmark } from './overlay-math.ts';
import { createPoseLandmarker, type PoseDelegate } from './pose.ts';
import { shouldFallbackToCpu } from './pose-performance.ts';
import type { WorldPoint } from './rig-retarget.ts';

export type PoseFrameResult = {
  landmarks: Landmark[];
  worldLandmarks: WorldPoint[] | null;
  detectMs: number;
};
export interface PoseDetector {
  readonly mode: 'worker' | 'main';
  readonly delegate: PoseDelegate;
  /** True while a frame is in flight. */
  readonly busy: boolean;
  submit(video: HTMLVideoElement, now: number): void;
  take(): PoseFrameResult | null;
  onDelegateChange?: (delegate: PoseDelegate) => void;
  onError?: () => void;
  close(): void;
}
export type WorkerReply =
  | { type: 'ready' | 'delegate'; delegate: PoseDelegate }
  | ({ type: 'result'; timestamp: number } & PoseFrameResult)
  | { type: 'error'; message: string }
  | { type: 'skipped' | 'slow' };
export type WorkerRequest =
  | { type: 'init'; delegate: PoseDelegate }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }
  | { type: 'close' };
export interface PoseWorkerPort {
  postMessage(message: WorkerRequest, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

export function forceMainPose(search: string): boolean {
  return new URLSearchParams(search).get('modoPose') === 'main';
}

async function createMainDetector(preferred: PoseDelegate): Promise<PoseDetector> {
  let model = await createPoseLandmarker(preferred);
  let closed = false;
  let replacing = false;
  let attempted = false;
  let nextDetectAt = 0;
  let result: PoseFrameResult | null = null;
  const durations: number[] = [];
  const detector: PoseDetector = {
    mode: 'main',
    get delegate() {
      return model.delegate;
    },
    get busy() {
      return closed || replacing || performance.now() < nextDetectAt;
    },
    submit(video, now) {
      if (detector.busy) return;
      const start = performance.now();
      let pose: PoseLandmarkerResult;
      try {
        pose = model.landmarker.detectForVideo(video, now);
      } catch {
        detector.close();
        detector.onError?.();
        return;
      }
      const end = performance.now();
      const detectMs = end - start;
      nextDetectAt = end + detectMs;
      result = {
        landmarks: pose.landmarks[0] ?? [],
        worldLandmarks: pose.worldLandmarks[0] ?? null,
        detectMs,
      };
      if (durations.length < 8 || detectMs > 1000) durations.push(detectMs);
      if (!attempted && shouldFallbackToCpu(durations, model.delegate)) {
        attempted = replacing = true;
        model.landmarker.close();
        void createPoseLandmarker('CPU')
          .then((replacement) => {
            if (closed) return replacement.landmarker.close();
            model = replacement;
            replacing = false;
            detector.onDelegateChange?.(model.delegate);
          })
          .catch(() => {
            closed = true;
            detector.onError?.();
          });
      }
    },
    take() {
      const value = result;
      result = null;
      return value;
    },
    close() {
      if (!closed && !replacing) model.landmarker.close();
      closed = true;
      result = null;
    },
  };
  return detector;
}

/** Injectable browser boundary keeps lifecycle and timeout decisions testable without DOM. */
export async function createWorkerDetector(
  preferred: PoseDelegate,
  makeWorker: () => PoseWorkerPort,
  bitmapFrom: (video: HTMLVideoElement) => Promise<ImageBitmap>,
  mainFrom: (delegate: PoseDelegate) => Promise<PoseDetector> = createMainDetector,
): Promise<PoseDetector> {
  let mode: 'worker' | 'main' = 'worker';
  let delegate = preferred;
  let busy = true;
  let closed = false;
  let worker: PoseWorkerPort | null = null;
  let restarted = false;
  let result: PoseFrameResult | null = null;
  let main: PoseDetector | null = null;
  let timer: ReturnType<typeof setTimeout>;
  let resolveReady: (detector: PoseDetector) => void;
  let rejectReady: (error: unknown) => void;
  const ready = new Promise<PoseDetector>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  function changeDelegate(value: PoseDelegate) {
    delegate = value;
    detector.onDelegateChange?.(value);
  }
  function stopWorker() {
    clearTimeout(timer);
    const previous = worker;
    worker = null;
    previous?.terminate();
  }
  function fallback(reason: 'error' | 'timeout') {
    if (closed || mode === 'main') return;
    busy = true;
    result = null;
    stopWorker();
    if (reason === 'timeout' && delegate === 'GPU' && !restarted) {
      restarted = true;
      startWorker('CPU');
      return;
    }
    mode = 'main';
    void mainFrom(reason === 'timeout' ? 'CPU' : delegate)
      .then((replacement) => {
        if (closed) return replacement.close();
        main = replacement;
        main.onDelegateChange = changeDelegate;
        main.onError = () => detector.onError?.();
        changeDelegate(main.delegate);
        busy = false;
        resolveReady(detector);
      })
      .catch((error: unknown) => {
        closed = true;
        rejectReady(error);
        detector.onError?.();
      });
  }
  const detector: PoseDetector = {
    get mode() {
      return mode;
    },
    get delegate() {
      return delegate;
    },
    get busy() {
      return closed || (main ? main.busy : busy);
    },
    submit(video, now) {
      if (detector.busy) return;
      if (main) return main.submit(video, now);
      busy = true;
      const activeWorker = worker;
      timer = setTimeout(() => fallback('timeout'), 5000);
      // Frames only reach a same-origin worker in this browser; nothing is uploaded.
      void bitmapFrom(video)
        .then((bitmap) => {
          if (closed || mode !== 'worker' || worker !== activeWorker) return bitmap.close();
          try {
            activeWorker?.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
          } catch {
            bitmap.close();
            fallback('error');
          }
        })
        .catch(() => {
          if (worker === activeWorker) fallback('error');
        });
    },
    take() {
      if (closed) return null;
      if (main) return main.take();
      const value = result;
      result = null;
      return value;
    },
    close() {
      closed = true;
      stopWorker();
      result = null;
      main?.close();
    },
  };
  function startWorker(preferred: PoseDelegate) {
    delegate = preferred;
    try {
      const activeWorker = makeWorker();
      worker = activeWorker;
      const isActive = () => !closed && mode === 'worker' && worker === activeWorker;
      activeWorker.onmessage = ({ data }) => {
        if (!isActive()) return;
        if (data.type === 'error') return fallback('error');
        // The worker's GPU is too slow: same path as a timeout (fresh CPU worker).
        if (data.type === 'slow') return fallback('timeout');
        if (data.type === 'delegate') return changeDelegate(data.delegate);
        clearTimeout(timer);
        busy = false;
        if (data.type === 'ready') {
          changeDelegate(data.delegate);
          resolveReady(detector);
        }
        if (data.type === 'result') result = data;
      };
      activeWorker.onerror = () => {
        if (isActive()) fallback('error');
      };
      timer = setTimeout(() => fallback('timeout'), 20_000);
      activeWorker.postMessage({ type: 'init', delegate: preferred });
    } catch {
      fallback('error');
    }
  }
  startWorker(preferred);
  return ready;
}

export async function createPoseDetector(preferred: PoseDelegate): Promise<PoseDetector> {
  if (
    forceMainPose(globalThis.location?.search ?? '') ||
    typeof Worker === 'undefined' ||
    typeof createImageBitmap === 'undefined' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return createMainDetector(preferred);
  }
  return createWorkerDetector(
    preferred,
    () => new Worker(new URL('./pose-worker.ts', import.meta.url), { type: 'module' }),
    (video) => createImageBitmap(video),
  );
}
