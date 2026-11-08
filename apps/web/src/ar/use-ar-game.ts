// The AR mirror game loop. Everything runs in the browser: frames go from the <video> to the pose
// model and the canvas and are never uploaded. React state only changes when something visible
// changes; per-frame values (dwell rings, drawing) bypass React.
import type { ArGameStep, PracticeKind } from '@bata/shared/schemas';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArTargetRegistry } from '../components/ar-hover-button.tsx';
import { ArRenderer, readArColors } from './ar-render.ts';
import { BodyHold } from './body-hold.ts';
import { bootCameraAndPose, stopTracks } from './camera-pose.ts';
import {
  assessQuality,
  type FrameSample,
  type QualityReport,
  SAMPLE_HEIGHT,
  SAMPLE_WIDTH,
  sampleFrame,
  TrackQuality,
} from './camera-quality.ts';
import { e2eFlag, simulatedPoseVariant } from './e2e-hooks.ts';
import { ArFeedback } from './feedback-audio.ts';
import { type FramingAdvice, framingAdvice } from './framing-advice.ts';
import { type FlowView, fullBodyInFrame, GameFlow } from './game-flow.ts';
import {
  type GameInput,
  GameSession,
  type GameView,
  INITIAL_SCENE,
  type Scene,
} from './game-steps.ts';
import { doneView, sameView } from './game-view.ts';
import { Gown3DRenderer } from './gown-3d.ts';
import { GownSprings } from './gown-motion.ts';
import { DwellTracker } from './hover-targets.ts';
import { FpsMonitor, type FrameSize, type Landmark } from './overlay-math.ts';
import type { PoseDelegate } from './pose.ts';
import {
  bodyFrame,
  detectViolations,
  LandmarkSmoother,
  type Violation,
  ViolationTracker,
} from './posture.ts';
import { type AssistView, PracticeAssist, readAssistColors } from './practice-assist.ts';
import { pressTargets, type TargetMap } from './press-targets.ts';
import { syntheticPose } from './synthetic-pose.ts';

/** Called with the raw pose of every processed frame; used by the dev-only capture mode. */
export type ArFrameHook = (landmarks: readonly Landmark[], size: FrameSize, now: number) => void;

export type PracticeStepLike = { id: string };
export type PracticeSessionLike = {
  update(input: GameInput): GameView;
  skip?(now: number, stepId?: string): void;
};

export type ArGameOptions<S extends PracticeStepLike = PracticeStepLike> = {
  onFrame?: ArFrameHook;
  /** Replaces the default v1 GameSession; `?practica=v2` passes PracticeSessionV2. */
  createSession?: (steps: readonly S[], reducedMotion: boolean) => PracticeSessionLike;
  /** `?bata=vivo`: springs the hem and sleeves with the torso's acceleration. */
  gownMotion?: boolean;
  /** `?bata=3d`: canvas WebGL for the skinned gown. */
  gown3d?: { canvas: RefObject<HTMLCanvasElement | null> };
  /** Phase 2 aids (ghost, joint colours, hold ring, progressive help): the kind of each step. */
  assist?: { kinds: readonly PracticeKind[] };
};

const NO_ASSIST: AssistView = { level: 0, hint: null, announce: false };

export type ArStatus = 'loading' | 'detecting' | 'found' | 'camera-error' | 'model-error';

const FPS_REFRESH_MS = 500;
const FRAME_SAMPLE_MS = 700;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useArGame<S extends PracticeStepLike>(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  hotspotRef: RefObject<string | null>,
  steps: readonly S[],
  options: ArGameOptions<S> = {},
) {
  // Refs keep the hook out of the effect dependencies: passing new callbacks never restarts the
  // camera and the pose model.
  const onFrameRef = useRef(options.onFrame);
  onFrameRef.current = options.onFrame;
  const createSessionRef = useRef(options.createSession);
  createSessionRef.current = options.createSession;
  const gownMotionRef = useRef(options.gownMotion);
  gownMotionRef.current = options.gownMotion;
  const gown3dRef = useRef(options.gown3d);
  gown3dRef.current = options.gown3d;
  const assistRef = useRef(options.assist);
  assistRef.current = options.assist;
  const [assist, setAssist] = useState<AssistView>(NO_ASSIST);
  const [framing, setFraming] = useState<FramingAdvice | null>(null);
  const [status, setStatus] = useState<ArStatus>('loading');
  const [delegate, setDelegate] = useState<PoseDelegate | null>(null);
  const [fps, setFps] = useState(0);
  const [drawMs, setDrawMs] = useState(0);
  const [lowPerformance, setLowPerformance] = useState(() => e2eFlag('simularFpsBajo'));
  const [hasAnchor, setHasAnchor] = useState(false);
  const [inFrame, setInFrame] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [practice, setPractice] = useState<GameView | null>(null);
  const [flow, setFlow] = useState<FlowView>({ phase: 'ready', secondsLeft: 0 });
  const [errors, setErrors] = useState<Partial<Record<Violation, number>>>({});
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [run, setRun] = useState(0);

  const feedback = useMemo(() => new ArFeedback(), []);
  const [voice, setVoiceState] = useState(feedback.voice);
  const [sound, setSoundState] = useState(feedback.sound);
  // v2 waits for the framing advice to be satisfied (head, feet, distance, centred) to count down.
  const [initialFlow] = useState(
    () => new GameFlow(options.assist ? (lm) => framingAdvice(lm).ok : undefined),
  );
  const flowRef = useRef(initialFlow);
  const sessionRef = useRef<PracticeSessionLike | null>(null);
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
    setErrors({});
    sessionRef.current = null;
    setPractice(null);
    setAssist(NO_ASSIST);
    if (e2eFlag('simularPracticaCompleta')) {
      flowRef.current.finish();
      setFlow({ phase: 'done', secondsLeft: 0 });
      setPractice(doneView(steps));
      return;
    }
    flowRef.current.start();
    setFlow({ phase: 'framing', secondsLeft: 0 });
  }, [feedback, steps]);

  /** "Saltar paso" (v2): the current step is left as not completed and earns no XP. */
  const skip = useCallback(
    (stepId: string) => {
      sessionRef.current?.skip?.(performance.now(), stepId);
      feedback.tick();
    },
    [feedback],
  );

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
    let gown3d: Gown3DRenderer | null = null;
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
      const bodyHold = new BodyHold();
      const gownSprings = gownMotionRef.current ? new GownSprings() : null;
      let lastSpringAt = 0;
      const trackQuality = new TrackQuality();
      const canvas = canvasRef.current;
      const colors = readArColors();
      const renderer = canvas ? new ArRenderer(canvas, colors) : null;
      const assistKinds = assistRef.current?.kinds;
      const aids = assistKinds
        ? new PracticeAssist(
            assistKinds,
            readAssistColors(),
            e2eFlag('simularAyudaRapida') ? 10 : 1,
          )
        : null;
      let assistKey = '';
      let framingKey = '';
      const gown3dCanvas = gown3dRef.current?.canvas.current ?? null;
      gown3d = gown3dCanvas ? new Gown3DRenderer(gown3dCanvas, colors) : null;
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = SAMPLE_WIDTH;
      sampleCanvas.height = SAMPLE_HEIGHT;
      const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      let frameSample: FrameSample | null = null;
      let lastSampleAt = 0;
      let lastQualityKey = '';
      const forceLow = e2eFlag('simularFpsBajo');
      // Solo QA: fuerza la bata puesta para revisar la malla 3D sin recorrer la práctica.
      const showcase = e2eFlag('simularBataPuesta');
      const simulate = simulatedPoseVariant();
      let lastVideoTime = -1;
      let nextDetectAt = 0;
      let lastFpsUpdate = 0;
      let found = false;
      let anchored = false;
      let framed = false;
      let violationKey = '';
      let lastView: GameView | null = null;
      let scene: Scene | null = null;
      const still = reducedMotion();
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
          onFrameRef.current?.(raw, size, now);
          const liveBody = bodyFrame(landmarks, size);
          // Brief dropouts keep the last body on screen; the rules still use the live one.
          const renderBody = bodyHold.update(liveBody, now);
          if (!liveBody) tracker.reset();
          const flowState = flowRef.current;
          // Warnings count from game step 2 on (the hands are only "scrubbed" from then).
          const warnings = flowState.phase === 'playing' && (lastView?.warningsOn ?? false);
          const detected = liveBody && warnings ? detectViolations(liveBody) : new Set<Violation>();
          for (const v of lastView?.exempt ?? []) detected.delete(v);
          const active = tracker.update(detected, now);

          // Phases: framing → countdown → playing → done.
          const view = flowState.update(landmarks, now);
          const flowKey = `${view.phase}:${view.secondsLeft}`;
          if (flowKey !== lastFlow) {
            if (view.phase === 'countdown' && view.secondsLeft > 0) feedback.tick();
            lastFlow = flowKey;
            setFlow(view);
          }
          if (view.phase === 'playing' && !sessionRef.current) {
            sessionRef.current = createSessionRef.current
              ? createSessionRef.current(steps, still)
              : // El default solo se usa cuando la página pasa los pasos v1 de `juegoAr`.
                new GameSession(steps as unknown as readonly ArGameStep[], still);
            feedback.success();
          }
          const session = sessionRef.current;
          if (session && view.phase === 'playing') {
            const pv = session.update({ body: liveBody, landmarks, size, violations: active, now });
            scene = pv.scene;
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
            const added = [...active].filter((v) => !violationKey.split(',').includes(v));
            if (added.length > 0) {
              feedback.error();
              setErrors((prev) => {
                const next = { ...prev };
                for (const v of added) next[v] = (next[v] ?? 0) + 1;
                return next;
              });
            }
            violationKey = key;
            setViolations(key ? (key.split(',') as Violation[]) : []);
          }

          // Touch-free buttons: hands over a registered target fill its ring.
          pressTargets(stageRef.current, landmarks, size, targets.current, dwell, now);

          let gownMotion: ReturnType<GownSprings['update']> | null = null;
          if (gownSprings) {
            if (liveBody) gownMotion = gownSprings.update(liveBody, now - lastSpringAt, still);
            else gownSprings.reset();
            lastSpringAt = now;
          }

          const activeScene: Scene | null = showcase
            ? { ...INITIAL_SCENE, gown: 'worn', gownT: 1 }
            : flowState.phase === 'playing' || flowState.phase === 'done'
              ? scene
              : null;
          if (renderer) {
            const ms = renderer.draw(video, renderBody, active, {
              scene: activeScene,
              reducedMotion: still,
              hotspot: hotspotRef.current,
              cursors: !renderBody, // with a body the posture rings already mark the hands
              landmarks,
              gownMotion,
              gown3d: gown3d?.ok ?? false,
            });
            renderMs = renderMs * 0.9 + ms * 0.1;
          }
          gown3d?.render(liveBody, activeScene, gownMotion, video.videoWidth, video.videoHeight);
          if (aids) {
            const playing = flowState.phase === 'playing';
            const ctx = playing && canvas ? canvas.getContext('2d') : null;
            const av = playing ? aids.frame(ctx, liveBody, lastView, now) : NO_ASSIST;
            if (!playing) aids.reset();
            if (av.announce && av.hint) feedback.say(av.hint);
            const key = `${av.level}:${av.hint ?? ''}`;
            if (key !== assistKey) {
              assistKey = key;
              setAssist(av);
            }
            const advice = flowState.phase === 'framing' ? framingAdvice(landmarks) : null;
            if ((advice?.message ?? '') !== framingKey) {
              framingKey = advice?.message ?? '';
              setFraming(advice);
            }
          }
          const hasGown = renderBody !== null;
          if (hasGown !== anchored) {
            anchored = hasGown;
            setHasAnchor(hasGown);
          }
          const full = fullBodyInFrame(landmarks);
          if (full !== framed) {
            framed = full;
            setInFrame(full);
          }
          if (sampleCtx && now - lastSampleAt >= FRAME_SAMPLE_MS) {
            lastSampleAt = now;
            sampleCtx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
            frameSample = sampleFrame(
              sampleCtx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data,
              SAMPLE_WIDTH,
              SAMPLE_HEIGHT,
            );
          }
          const track = trackQuality.update(raw, size, liveBody !== null);
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
            const report = assessQuality({
              frame: frameSample,
              track,
              fps: stats.fps,
              drawMs: renderMs,
            });
            smoother.setAlpha(report.smoothing);
            const qualityKey = `${report.score}:${report.hint ?? ''}:${report.issues.join(',')}`;
            if (qualityKey !== lastQualityKey) {
              lastQualityKey = qualityKey;
              setQuality(report);
            }
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
      gown3d?.dispose();
      stopTracks(stream);
      landmarker?.close();
      feedback.dispose();
    };
  }, [videoRef, canvasRef, stageRef, hotspotRef, feedback, steps]);

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
    assist,
    framing,
    quality,
    run,
    voice,
    sound,
    registry,
    feedback,
    start,
    skip,
    stop,
    setVoice,
    setSound,
  };
}
