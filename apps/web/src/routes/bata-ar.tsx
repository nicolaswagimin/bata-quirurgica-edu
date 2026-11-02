import { BataPasosSchema } from '@bata/shared/schemas';
import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import pasosJson from '../../../../content/protocolos/bata-pasos.json';
import { type ArStatus, useArSession } from '../ar/use-ar-session.ts';
import { ArAlerts } from '../components/ar-alerts.tsx';
import { ArPracticePanel } from '../components/ar-practice-panel.tsx';
import { buttonPrimary } from '../components/ui-classes.ts';

const { hotspots, donning } = BataPasosSchema.parse(pasosJson);
const steps = [...donning].sort((a, b) => a.order - b.order);

const STATUS_TEXT: Record<ArStatus, string> = {
  loading: 'Cargando modelo',
  detecting: 'Detectando',
  found: 'Pose encontrada',
  'camera-error': 'Cámara no disponible',
  'model-error': 'Modelo no disponible',
};

export default function BataArPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hotspotId, setHotspotId] = useState<string | null>(null);
  const selectedHotspot = hotspots.find((h) => h.id === hotspotId);
  const {
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
  } = useArSession(videoRef, canvasRef);

  const cameraError = status === 'camera-error';

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-balance text-ink">
        AR espejo
      </h1>
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
        <div role="alert" className="rounded-card bg-surface p-6">
          <p className="font-medium text-ink">No pudimos acceder a la cámara</p>
          <p className="mt-1 text-sm text-muted">
            Revisa los permisos del navegador o explora la bata sin cámara.
          </p>
          <Link to="/bata-3d" className="mt-3 inline-block font-medium text-primary underline">
            Ver la bata en 3D
          </Link>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-card bg-surface shadow-sheet">
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

      {!cameraError && status !== 'loading' && status !== 'model-error' ? (
        <>
          <ArAlerts violations={violations} />
          {practice ? (
            <ArPracticePanel
              key={practiceRun}
              steps={steps}
              view={practice}
              onRestart={startPractice}
              onExit={stopPractice}
            />
          ) : (
            <div className="flex flex-col items-start gap-2 rounded-card bg-surface p-5">
              <h2 className="text-lg font-extrabold">Práctica guiada</h2>
              <p className="text-sm text-muted">
                Recorre los 6 pasos de colocación frente a la cámara. Cada paso se valida con tu
                postura y suma XP una vez al día al completarlos todos.
              </p>
              <button type="button" onClick={startPractice} className={buttonPrimary}>
                Empezar práctica guiada
              </button>
            </div>
          )}
        </>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-lg font-extrabold text-ink">Zonas de la bata</h2>
        <div className="flex flex-wrap gap-2">
          {hotspots.map((h) => (
            <button
              key={h.id}
              type="button"
              aria-pressed={h.id === hotspotId}
              onClick={() => setHotspotId(h.id === hotspotId ? null : h.id)}
              className="pressable min-h-11 rounded-pill bg-bg px-4 font-bold text-primary ring-2 ring-primary ring-inset hover:bg-primary-soft aria-pressed:bg-primary aria-pressed:text-bg"
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
