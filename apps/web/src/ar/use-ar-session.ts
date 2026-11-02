// Camera + MediaPipe loop of the AR mirror. Everything runs in the browser: frames go from the
// <video> to the pose model and the canvas, and are never uploaded.
import { DONNING_STEP_IDS } from '@bata/shared/schemas';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { drawGown, gownGeometry } from './gown-overlay.ts';
import { computeGownAnchor, FpsMonitor, type Landmark } from './overlay-math.ts';
import { createPoseLandmarker, type PoseDelegate } from './pose.ts';
import {
  bodyFrame,
  detectViolations,
  LandmarkSmoother,
  type Violation,
  ViolationTracker,
} from './posture.ts';
import { drawPostureGuides } from './posture-overlay.ts';
import { PracticeSession, type PracticeView } from './practice.ts';

export type ArStatus = 'loading' | 'detecting' | 'found' | 'camera-error' | 'model-error';

const FPS_REFRESH_MS = 500;

// Test hook: `vite build --mode e2e` + `?simularFpsBajo=1` forces the slow-device notice.
function forcedLowFps(): boolean {
  return (
    import.meta.env.MODE === 'e2e' &&
    new URLSearchParams(window.location.search).get('simularFpsBajo') === '1'
  );
}

// Test hook: `vite build --mode e2e` + `?simularPracticaCompleta=1` finishes the practice at once.
function forcedPracticeDone(): boolean {
  return (
    import.meta.env.MODE === 'e2e' &&
    new URLSearchParams(window.location.search).get('simularPracticaCompleta') === '1'
  );
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
}

function sameView(a: PracticeView | null, b: PracticeView): boolean {
  return (
    !!a &&
    a.stepIndex === b.stepIndex &&
    a.hint === b.hint &&
    a.done === b.done &&
    Math.abs(a.hold - b.hold) < 0.05
  );
}

export function useArSession(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const [status, setStatus] = useState<ArStatus>('loading');
  const [delegate, setDelegate] = useState<PoseDelegate | null>(null);
  const [fps, setFps] = useState(0);
  const [lowPerformance, setLowPerformance] = useState(forcedLowFps);
  const [hasAnchor, setHasAnchor] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [practice, setPractice] = useState<PracticeView | null>(null);
  const sessionRef = useRef<PracticeSession | null>(null);
  // Bumped on every start so the practice panel remounts with a fresh submission.
  const [practiceRun, setPracticeRun] = useState(0);

  const startPractice = useCallback(() => {
    setPracticeRun((n) => n + 1);
    if (forcedPracticeDone()) {
      // Test hook: the fake camera shows no person, so jump straight to a finished sequence.
      sessionRef.current = null;
      setPractice({
        stepIndex: 6,
        hold: 0,
        hint: '',
        completedIds: [...DONNING_STEP_IDS],
        done: true,
      });
      return;
    }
    sessionRef.current = new PracticeSession();
    setPractice(sessionRef.current.update(null, new Set(), performance.now()));
  }, []);
  const stopPractice = useCallback(() => {
    sessionRef.current = null;
    setPractice(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: PoseLandmarker | null = null;
    let frameId = 0;

    async function start() {
      const cameraPromise = navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      const modelPromise = createPoseLandmarker();
      // Avoid an unhandled rejection if the camera fails first.
      modelPromise.catch(() => undefined);
      try {
        stream = await cameraPromise;
      } catch {
        if (!cancelled) setStatus('camera-error');
        modelPromise.then(({ landmarker: l }) => l.close()).catch(() => undefined);
        return;
      }
      if (cancelled) return stopTracks(stream);
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      try {
        const created = await modelPromise;
        landmarker = created.landmarker;
        if (cancelled) return;
        setDelegate(created.delegate);
      } catch {
        if (!cancelled) setStatus('model-error');
        return;
      }
      setStatus('detecting');
      loop(video, landmarker);
    }

    function loop(video: HTMLVideoElement, poseLandmarker: PoseLandmarker) {
      const monitor = new FpsMonitor();
      const smoother = new LandmarkSmoother();
      const tracker = new ViolationTracker();
      const colors = {
        gown: token('primary'),
        line: token('bg'),
        danger: token('danger'),
      };
      const forceLow = forcedLowFps();
      let lastVideoTime = -1;
      let nextDetectAt = 0;
      let lastFpsUpdate = 0;
      let found = false;
      let anchored = false;
      let violationKey = '';
      let lastView: PracticeView | null = null;

      const tick = () => {
        if (cancelled) return;
        const now = performance.now();
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now >= nextDetectAt) {
          lastVideoTime = video.currentTime;
          const result = poseLandmarker.detectForVideo(video, now);
          // Detection blocks the main thread; on slow devices wait as long as it took so the page
          // stays responsive (at most ~50% of the time spent detecting).
          nextDetectAt = performance.now() + (performance.now() - now);
          const raw = result.landmarks[0] ?? [];
          const landmarks = smoother.smooth(raw);
          const canvas = canvasRef.current;
          const size = { width: video.videoWidth, height: video.videoHeight };
          const body = bodyFrame(landmarks, size);
          if (!body) tracker.reset();
          const active = tracker.update(body ? detectViolations(body) : new Set(), now);
          const hasGown = draw(canvas, landmarks, body, active, colors);

          const key = [...active].sort().join(',');
          if (key !== violationKey) {
            violationKey = key;
            setViolations(key ? (key.split(',') as Violation[]) : []);
          }
          const session = sessionRef.current;
          if (session) {
            const view = session.update(body, active, now);
            if (!sameView(lastView, view)) {
              lastView = view;
              setPractice(view);
            }
          } else {
            lastView = null;
          }
          if (hasGown !== anchored) {
            anchored = hasGown;
            setHasAnchor(hasGown);
          }
          const stats = monitor.record(now);
          if (raw.length > 0 !== found) {
            found = raw.length > 0;
            setStatus(found ? 'found' : 'detecting');
          }
          if (now - lastFpsUpdate >= FPS_REFRESH_MS) {
            lastFpsUpdate = now;
            setFps(Math.round(stats.fps));
            setLowPerformance(forceLow || stats.lowPerformance);
          }
        }
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    }

    // Returns whether the gown could be anchored to this frame.
    function draw(
      canvas: HTMLCanvasElement | null,
      landmarks: readonly Landmark[],
      body: ReturnType<typeof bodyFrame>,
      active: ReadonlySet<Violation>,
      colors: { gown: string; line: string; danger: string },
    ): boolean {
      const video = videoRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !video) return false;
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const anchor = computeGownAnchor(landmarks, canvas);
      drawGown(ctx, gownGeometry(anchor), colors.gown);
      drawPostureGuides(ctx, body, active, colors);
      return anchor !== null;
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      stopTracks(stream);
      landmarker?.close();
    };
  }, [videoRef, canvasRef]);

  return {
    status,
    delegate,
    fps,
    lowPerformance,
    hasAnchor,
    violations,
    practice,
    practiceRun,
    startPractice,
    stopPractice,
  };
}

function stopTracks(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}
