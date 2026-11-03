// The AR mirror game loop. Everything runs in the browser: frames go from the <video> to the pose
// model and the canvas and are never uploaded. React state only changes when something visible
// changes; per-frame values (dwell rings, drawing) bypass React.
import { DONNING_STEP_IDS } from '@bata/shared/schemas';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArTargetRegistry } from '../components/ar-hover-button.tsx';
import { ArRenderer, readArColors } from './ar-render.ts';
import { bootCameraAndPose, stopTracks } from './camera-pose.ts';
import { e2eFlag, simulatedPoseVariant } from './e2e-hooks.ts';
import { ArFeedback } from './feedback-audio.ts';
import { type FlowView, fullBodyInFrame, GameFlow } from './game-flow.ts';
import { DwellTracker } from './hover-targets.ts';
import { computeGownAnchor, FpsMonitor } from './overlay-math.ts';
import type { PoseDelegate } from './pose.ts';
import {
  bodyFrame,
  detectViolations,
  LandmarkSmoother,
  type Violation,
  ViolationTracker,
} from './posture.ts';
import { PracticeSession, type PracticeView } from './practice.ts';
import { pressTargets, type TargetMap } from './press-targets.ts';
import { syntheticPose } from './synthetic-pose.ts';

export type ArStatus = 'loading' | 'detecting' | 'found' | 'camera-error' | 'model-error';

const FPS_REFRESH_MS = 500;

function sameView(a: PracticeView | null, b: PracticeView): boolean {
  return (
    !!a &&
    a.stepIndex === b.stepIndex &&
    a.hint === b.hint &&
    a.done === b.done &&
    Math.abs(a.hold - b.hold) < 0.05
  );
}

const DONE_VIEW: PracticeView = {
  stepIndex: DONNING_STEP_IDS.length,
  hold: 0,
  hint: '',
  completedIds: [...DONNING_STEP_IDS],
  done: true,
};

export function useArGame(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  hotspotRef: RefObject<string | null>,
) {
  const [status, setStatus] = useState<ArStatus>('loading');
  const [delegate, setDelegate] = useState<PoseDelegate | null>(null);
  const [fps, setFps] = useState(0);
  const [drawMs, setDrawMs] = useState(0);
  const [lowPerformance, setLowPerformance] = useState(() => e2eFlag('simularFpsBajo'));
  const [hasAnchor, setHasAnchor] = useState(false);
  const [inFrame, setInFrame] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [practice, setPractice] = useState<PracticeView | null>(null);
  const [flow, setFlow] = useState<FlowView>({ phase: 'ready', secondsLeft: 0 });
  const [errors, setErrors] = useState(0);
  const [run, setRun] = useState(0);

  const feedback = useMemo(() => new ArFeedback(), []);
  const [voice, setVoiceState] = useState(feedback.voice);
  const [sound, setSoundState] = useState(feedback.sound);
  const flowRef = useRef(new GameFlow());
  const sessionRef = useRef<PracticeSession | null>(null);
  const targets = useRef<TargetMap>(new Map());

  const registry = useMemo<ArTargetRegistry>(
    () => ({
      register(id, el, onActivate) {
        targets.current.set(id, { el, onActivate });
        return () => {
          if (targets.current.get(id)?.el === el) targets.current.delete(id);
        };
      },
    }),
    [],
  );

  /** Start or restart: from `ready` the first tap also unlocks audio and voice. */
  const start = useCallback(() => {
    feedback.unlock();
    feedback.tick();
    setRun((n) => n + 1);
    setErrors(0);
    sessionRef.current = null;
    setPractice(null);
    if (e2eFlag('simularPracticaCompleta')) {
      flowRef.current.finish();
      setFlow({ phase: 'done', secondsLeft: 0 });
      setPractice(DONE_VIEW);
      return;
    }
    flowRef.current.start();
    setFlow({ phase: 'framing', secondsLeft: 0 });
  }, [feedback]);

  const stop = useCallback(() => {
    flowRef.current.reset();
    sessionRef.current = null;
    setPractice(null);
    setFlow({ phase: 'ready', secondsLeft: 0 });
  }, []);

  const setVoice = useCallback(
    (on: boolean) => {
      feedback.setVoice(on);
      setVoiceState(on);
    },
    [feedback],
  );
  const setSound = useCallback(
    (on: boolean) => {
      feedback.setSound(on);
      setSoundState(on);
    },
    [feedback],
  );

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: PoseLandmarker | null = null;
    let frameId = 0;

    async function boot() {
      const video = videoRef.current;
      if (!video) return;
      const result = await bootCameraAndPose(video, () => cancelled);
      if (result.kind === 'cancelled') return;
      if (result.kind === 'camera-error') return setStatus('camera-error');
      stream = result.stream;
      if (result.kind === 'model-error') return setStatus('model-error');
      landmarker = result.landmarker;
      setDelegate(result.delegate);
      setStatus('detecting');
      loop(video, result.landmarker);
    }

    function loop(video: HTMLVideoElement, pose: PoseLandmarker) {
      const monitor = new FpsMonitor();
      const smoother = new LandmarkSmoother();
      const tracker = new ViolationTracker();
      const dwell = new DwellTracker();
      const canvas = canvasRef.current;
      const renderer = canvas ? new ArRenderer(canvas, readArColors()) : null;
      const forceLow = e2eFlag('simularFpsBajo');
      const simulate = simulatedPoseVariant();
      let lastVideoTime = -1;
      let nextDetectAt = 0;
      let lastFpsUpdate = 0;
      let found = false;
      let anchored = false;
      let framed = false;
      let violationKey = '';
      let lastView: PracticeView | null = null;
      let lastFlow = '';
      let renderMs = 0;

      const tick = () => {
        if (cancelled) return;
        const now = performance.now();
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now >= nextDetectAt) {
          lastVideoTime = video.currentTime;
          const result = pose.detectForVideo(video, now);
          // Detection blocks the main thread; on slow devices wait as long as it took.
          nextDetectAt = performance.now() + (performance.now() - now);
          const raw = simulate ? syntheticPose(now, simulate) : (result.landmarks[0] ?? []);
          const landmarks = smoother.smooth(raw);
          const size = { width: video.videoWidth, height: video.videoHeight };
          const body = bodyFrame(landmarks, size);
          if (!body) tracker.reset();
          const flowState = flowRef.current;
          const playing = flowState.phase === 'playing';
          const active = tracker.update(body && playing ? detectViolations(body) : new Set(), now);

          // Phases: framing → countdown → playing → done.
          const view = flowState.update(landmarks, now);
          const flowKey = `${view.phase}:${view.secondsLeft}`;
          if (flowKey !== lastFlow) {
            if (view.phase === 'countdown' && view.secondsLeft > 0) feedback.tick();
            lastFlow = flowKey;
            setFlow(view);
          }
          if (view.phase === 'playing' && !sessionRef.current) {
            sessionRef.current = new PracticeSession();
            feedback.success();
          }
          const session = sessionRef.current;
          if (session && view.phase === 'playing') {
            const pv = session.update(body, active, now);
            if (lastView && pv.completedIds.length > lastView.completedIds.length)
              feedback.success();
            if (!sameView(lastView, pv)) {
              lastView = pv;
              setPractice(pv);
            }
            if (pv.done) {
              flowState.finish();
              feedback.fanfare();
              setFlow({ phase: 'done', secondsLeft: 0 });
            }
          }

          const key = [...active].sort().join(',');
          if (key !== violationKey) {
            const added = [...active].some((v) => !violationKey.split(',').includes(v));
            if (added) {
              feedback.error();
              setErrors((n) => n + 1);
            }
            violationKey = key;
            setViolations(key ? (key.split(',') as Violation[]) : []);
          }

          // Touch-free buttons: hands over a registered target fill its ring.
          pressTargets(stageRef.current, landmarks, size, targets.current, dwell, now);

          if (renderer) {
            const ms = renderer.draw(video, body, active, {
              gown: flowState.phase === 'playing' || flowState.phase === 'done',
              hotspot: hotspotRef.current,
              cursors: !body, // with a body the posture rings already mark the hands
              landmarks,
            });
            renderMs = renderMs * 0.9 + ms * 0.1;
          }
          const hasGown = computeGownAnchor(landmarks, size) !== null;
          if (hasGown !== anchored) {
            anchored = hasGown;
            setHasAnchor(hasGown);
          }
          const full = fullBodyInFrame(landmarks);
          if (full !== framed) {
            framed = full;
            setInFrame(full);
          }
          const stats = monitor.record(now);
          if (raw.length > 0 !== found) {
            found = raw.length > 0;
            setStatus(found ? 'found' : 'detecting');
          }
          if (now - lastFpsUpdate >= FPS_REFRESH_MS) {
            lastFpsUpdate = now;
            setFps(Math.round(stats.fps));
            setDrawMs(Math.round(renderMs * 10) / 10);
            setLowPerformance(forceLow || stats.lowPerformance);
          }
        }
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    }

    void boot();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      stopTracks(stream);
      landmarker?.close();
      feedback.dispose();
    };
  }, [videoRef, canvasRef, stageRef, hotspotRef, feedback]);

  return {
    status,
    delegate,
    fps,
    drawMs,
    lowPerformance,
    hasAnchor,
    inFrame,
    violations,
    practice,
    flow,
    errors,
    run,
    voice,
    sound,
    registry,
    feedback,
    start,
    stop,
    setVoice,
    setSound,
  };
}
