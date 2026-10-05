import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ANCHOR_LANDMARKS, FpsMonitor, type Landmark, MIN_VISIBILITY } from '../ar/overlay-math.ts';
import { createPoseLandmarker, type PoseDelegate } from '../ar/pose.ts';

type Status = 'loading' | 'detecting' | 'found' | 'camera-error' | 'model-error';

const STATUS_TEXT: Record<Status, string> = {
  loading: 'Cargando modelo',
  detecting: 'Detectando',
  found: 'Pose encontrada',
  'camera-error': 'Cámara no disponible',
  'model-error': 'Modelo no disponible',
};

const POINT_RADIUS = 8;
const FPS_REFRESH_MS = 500;

export default function BataArPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [delegate, setDelegate] = useState<PoseDelegate | null>(null);
  const [fps, setFps] = useState(0);
  const [lowPerformance, setLowPerformance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: PoseLandmarker | null = null;
    let frame = 0;

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
      const color = getComputedStyle(document.documentElement).getPropertyValue('--color-xp');
      let lastVideoTime = -1;
      let lastFpsUpdate = 0;
      let found = false;

      const tick = () => {
        if (cancelled) return;
        const now = performance.now();
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const result = poseLandmarker.detectForVideo(video, now);
          const landmarks = result.landmarks[0] ?? [];
          draw(video, landmarks, color);
          const stats = monitor.record(now);
          if (landmarks.length > 0 !== found) {
            found = landmarks.length > 0;
            setStatus(found ? 'found' : 'detecting');
          }
          if (now - lastFpsUpdate >= FPS_REFRESH_MS) {
            lastFpsUpdate = now;
            setFps(Math.round(stats.fps));
            setLowPerformance(stats.lowPerformance);
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    function draw(video: HTMLVideoElement, landmarks: readonly Landmark[], color: string) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;
      for (const index of ANCHOR_LANDMARKS) {
        const point = landmarks[index];
        if (!point || (point.visibility ?? 0) < MIN_VISIBILITY) continue;
        ctx.beginPath();
        ctx.arc(point.x * canvas.width, point.y * canvas.height, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stopTracks(stream);
      landmarker?.close();
    };
  }, []);

  const cameraError = status === 'camera-error';

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-ink">AR espejo</h1>
      <p className="text-muted">
        La imagen de tu cámara se procesa solo en este dispositivo y nunca se envía a internet.
      </p>

      <p
        data-testid="ar-status"
        aria-live="polite"
        className="inline-block rounded-pill bg-primary-soft px-3 py-1 text-sm font-medium text-ink"
      >
        {STATUS_TEXT[status]}
      </p>

      {cameraError ? (
        <div role="alert" className="rounded-card border border-border bg-surface p-6">
          <p className="font-medium text-ink">No pudimos acceder a la cámara</p>
          <p className="mt-1 text-sm text-muted">
            Revisa los permisos del navegador o explora la bata sin cámara.
          </p>
          <Link to="/bata-3d" className="mt-3 inline-block font-medium text-primary underline">
            Ver la bata en 3D
          </Link>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-card border border-border bg-surface">
          <video
            ref={videoRef}
            playsInline
            muted
            className="block w-full -scale-x-100"
            aria-label="Vista de tu cámara en modo espejo"
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
          />
        </div>
      )}

      {status === 'model-error' && (
        <p role="alert" className="text-danger">
          No pudimos cargar el modelo de detección. Recarga la página para intentarlo de nuevo.
        </p>
      )}

      {delegate && (
        <p className="text-sm text-muted">
          {fps} FPS · procesamiento en {delegate}
        </p>
      )}
      {lowPerformance && (
        <p className="text-sm text-ink">
          Tu dispositivo va lento para el espejo AR. Prueba el{' '}
          <Link to="/bata-3d" className="font-medium text-primary underline">
            modo 3D
          </Link>
          .
        </p>
      )}
    </section>
  );
}

function stopTracks(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}
