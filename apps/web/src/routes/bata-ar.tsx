import { BataPasosSchema } from '@bata/shared/schemas';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import pasosJson from '../../../../content/protocolos/bata-pasos.json';
import { drawGown, gownGeometry } from '../ar/gown-overlay.ts';
import { computeGownAnchor, FpsMonitor, type Landmark } from '../ar/overlay-math.ts';
import { createPoseLandmarker, type PoseDelegate } from '../ar/pose.ts';

const { hotspots } = BataPasosSchema.parse(pasosJson);

type Status = 'loading' | 'detecting' | 'found' | 'camera-error' | 'model-error';

const STATUS_TEXT: Record<Status, string> = {
  loading: 'Cargando modelo',
  detecting: 'Detectando',
  found: 'Pose encontrada',
  'camera-error': 'Cámara no disponible',
  'model-error': 'Modelo no disponible',
};

const FPS_REFRESH_MS = 500;

// Test hook: `vite build --mode e2e` + `?simularFpsBajo=1` forces the slow-device notice.
function forcedLowFps(): boolean {
  return (
    import.meta.env.MODE === 'e2e' &&
    new URLSearchParams(window.location.search).get('simularFpsBajo') === '1'
  );
}

export default function BataArPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [delegate, setDelegate] = useState<PoseDelegate | null>(null);
  const [fps, setFps] = useState(0);
  const [lowPerformance, setLowPerformance] = useState(forcedLowFps);
  const [hasAnchor, setHasAnchor] = useState(false);
  const [hotspotId, setHotspotId] = useState<string | null>(null);
  const selectedHotspot = hotspots.find((h) => h.id === hotspotId);

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
      const color = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
      const forceLow = forcedLowFps();
      let lastVideoTime = -1;
      let nextDetectAt = 0;
      let lastFpsUpdate = 0;
      let found = false;
      let anchored = false;

      const tick = () => {
        if (cancelled) return;
        const now = performance.now();
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now >= nextDetectAt) {
          lastVideoTime = video.currentTime;
          const result = poseLandmarker.detectForVideo(video, now);
          // Detection blocks the main thread; on slow devices wait as long as it took so the page
          // stays responsive (at most ~50% of the time spent detecting).
          nextDetectAt = performance.now() + (performance.now() - now);
          const landmarks = result.landmarks[0] ?? [];
          const hasGown = draw(video, landmarks, color);
          if (hasGown !== anchored) {
            anchored = hasGown;
            setHasAnchor(hasGown);
          }
          const stats = monitor.record(now);
          if (landmarks.length > 0 !== found) {
            found = landmarks.length > 0;
            setStatus(found ? 'found' : 'detecting');
          }
          if (now - lastFpsUpdate >= FPS_REFRESH_MS) {
            lastFpsUpdate = now;
            setFps(Math.round(stats.fps));
            setLowPerformance(forceLow || stats.lowPerformance);
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    // Returns whether the gown could be anchored to this frame.
    function draw(video: HTMLVideoElement, landmarks: readonly Landmark[], color: string): boolean {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return false;
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const anchor = computeGownAnchor(landmarks, canvas);
      drawGown(ctx, gownGeometry(anchor), color);
      return anchor !== null;
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

      {!cameraError && !hasAnchor && (
        <p className="text-ink">Colócate de frente a la cámara, con hombros y caderas visibles</p>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Zonas de la bata</h2>
        <div className="flex flex-wrap gap-2">
          {hotspots.map((h) => (
            <button
              key={h.id}
              type="button"
              aria-pressed={h.id === hotspotId}
              onClick={() => setHotspotId(h.id === hotspotId ? null : h.id)}
              className="min-h-11 rounded-pill border border-border bg-bg px-4 font-medium text-ink hover:bg-primary-soft aria-pressed:bg-primary-soft"
            >
              {h.label}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="text-sm text-ink">
          {selectedHotspot?.description}
        </p>
      </div>

      <Link to="/bata-espacio" className="inline-block font-medium text-primary underline">
        Ver en tu espacio
      </Link>

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
        <p role="status" className="text-sm text-ink">
          Tu dispositivo va lento con la cámara.{' '}
          <Link to="/bata-3d" className="font-medium text-primary underline">
            Prueba el modo 3D
          </Link>
        </p>
      )}
    </section>
  );
}

function stopTracks(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}
