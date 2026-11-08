import { BataPasosSchema } from '@bata/shared/schemas';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import pasosJson from '../../../../content/protocolos/bata-pasos.json';
import { QUALITY_HINTS } from '../ar/camera-quality.ts';
import { type ArStatus, useArGame } from '../ar/use-ar-game.ts';
import { ArBodyGuide } from '../components/ar-body-guide.tsx';
import { ArHoverButton, ArTargetsContext } from '../components/ar-hover-button.tsx';
import { ArCountdown, ArInstruction, ArStepProgress, ArWarnings } from '../components/ar-hud.tsx';
import { ArResults } from '../components/ar-results.tsx';
import { Pictogram } from '../components/pictogram.tsx';

const { hotspots, juegoAr } = BataPasosSchema.parse(pasosJson);
const steps = [...juegoAr].sort((a, b) => a.order - b.order);

const STATUS_TEXT: Record<ArStatus, string> = {
  loading: 'Cargando modelo',
  detecting: 'Detectando',
  found: 'Pose encontrada',
  'camera-error': 'Cámara no disponible',
  'model-error': 'Modelo no disponible',
};

const GUIDE = 'Colócate de frente a la cámara, con hombros y caderas visibles';
const chip = 'rounded-pill bg-ink/60 px-3 py-1.5 text-xs font-bold text-bg backdrop-blur-sm';

/** Short label for the quality chip; the score is only shown in the tooltip of the hint. */
function qualityLabel(score: number): string {
  if (score >= 80) return 'buena';
  return score >= 55 ? 'regular' : 'baja';
}

export default function BataArPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const hotspotRef = useRef<string | null>(null);
  const [hotspotId, setHotspotId] = useState<string | null>(null);
  hotspotRef.current = hotspotId;
  const navigate = useNavigate();
  const game = useArGame(videoRef, canvasRef, stageRef, hotspotRef, steps);
  const { flow, practice, status, quality } = game;
  const phase = flow.phase;
  // Pose and speed already have their own guidance; the hint is for camera problems only.
  const cameraHint =
    quality?.primary && quality.primary !== 'pose' && quality.primary !== 'lento'
      ? QUALITY_HINTS[quality.primary]
      : null;
  const current = practice && !practice.done ? steps[practice.stepIndex] : null;

  const instruction =
    phase === 'ready'
      ? 'Apoya el celular a la altura de la cintura y aléjate unos 2 metros'
      : phase === 'framing'
        ? 'Aléjate hasta que se vea tu cuerpo'
        : phase === 'countdown'
          ? '¡Listo! Quédate ahí'
          : phase === 'done'
            ? '¡Bata colocada!'
            : (practice?.hint ?? 'Prepárate');

  // Voice reads what changes meaning: phase prompts, each new step and every new warning.
  const spoken =
    phase === 'playing'
      ? current
        ? `Paso ${current.order}. ${current.instruction}`
        : ''
      : instruction;
  useEffect(() => {
    game.feedback.say(spoken);
  }, [spoken, game.feedback]);
  const warning = game.violations[0];
  useEffect(() => {
    if (warning)
      game.feedback.say(
        warning === 'bajo-cintura' ? 'Manos arriba de la cintura' : 'Cuidado, zona no estéril',
      );
  }, [warning, game.feedback]);

  const cameraError = status === 'camera-error';

  return (
    <ArTargetsContext.Provider value={game.registry}>
      <section
        ref={stageRef}
        aria-label="AR espejo"
        className="fixed inset-0 z-[70] overflow-hidden bg-ink text-bg"
      >
        <h1 className="sr-only">AR espejo</h1>
        {cameraError ? (
          <div role="alert" className="grid h-full place-items-center p-6">
            <div className="max-w-sm rounded-card bg-bg p-6 text-ink">
              <p className="text-lg font-extrabold">No pudimos acceder a la cámara</p>
              <p className="mt-1 text-sm text-muted">
                Revisa los permisos del navegador o explora la bata sin cámara.
              </p>
              <Link to="/bata-3d" className="mt-3 inline-block font-bold text-primary underline">
                Ver la bata en 3D
              </Link>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 size-full -scale-x-100 object-cover"
              aria-label="Vista de tu cámara en modo espejo"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 size-full -scale-x-100 object-cover"
            />
          </>
        )}

        {!cameraError && (phase === 'framing' || phase === 'countdown') ? (
          <ArBodyGuide fitted={game.inFrame} />
        ) : null}

        {/* Top: status, steps and toggles only, so the head and body stay clear. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3 md:gap-3 md:p-5">
          <div className="flex w-full items-start justify-between gap-2">
            <div className="flex flex-col items-start gap-1.5">
              <p data-testid="ar-status" aria-live="polite" className={chip}>
                {STATUS_TEXT[status]}
              </p>
              {game.delegate ? (
                <p className={chip}>
                  {game.fps} FPS
                  <span className="hidden md:inline">
                    {' '}
                    · procesamiento en {game.delegate} · dibujo {game.drawMs} ms
                  </span>
                </p>
              ) : null}
              {quality ? (
                <p data-testid="ar-quality" className={chip}>
                  Cámara {qualityLabel(quality.score)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="pointer-events-auto flex gap-2">
                <ArHoverButton
                  id="voz"
                  size="sm"
                  tone="quiet"
                  label={game.voice ? 'Voz: sí' : 'Voz: no'}
                  onActivate={() => game.setVoice(!game.voice)}
                />
                <ArHoverButton
                  id="salir"
                  size="sm"
                  tone="quiet"
                  label="Salir"
                  icon={<Pictogram name="arrow" className="size-5 rotate-180" />}
                  onActivate={() => void navigate({ to: '/' })}
                />
              </div>
              {practice && phase === 'playing' ? (
                <div className="hidden landscape:block">
                  <ArStepProgress steps={steps} view={practice} vertical />
                </div>
              ) : null}
            </div>
          </div>
          {practice && phase === 'playing' ? (
            <div className="landscape:hidden">
              <ArStepProgress steps={steps} view={practice} />
            </div>
          ) : null}
        </div>

        {/* Centre: countdown and results only */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center landscape:pt-24 landscape:pr-4 landscape:pb-4 landscape:pl-[36%]">
          {phase === 'countdown' ? <ArCountdown seconds={flow.secondsLeft} /> : null}
          {phase === 'done' ? <ArResults key={game.run} errors={game.errors} /> : null}
        </div>

        {/* Bottom: the actions of the current phase */}
        {/* Landscape: a left column, so the centred body stays clear. */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] landscape:right-auto landscape:w-[38%] landscape:items-start landscape:md:w-[34%]">
          {phase === 'playing' ? <ArWarnings violations={game.violations} /> : null}
          {cameraHint && !game.lowPerformance && phase !== 'done' ? (
            <p
              role="status"
              className="max-w-md rounded-card bg-ink/70 px-4 py-2 text-center text-sm font-bold text-bg backdrop-blur-sm"
            >
              {cameraHint}
            </p>
          ) : null}
          {/* Instruction low, over the legs: the head stays visible for the mask. */}
          {phase !== 'done' ? (
            <ArInstruction
              text={instruction}
              sub={!game.hasAnchor && !cameraError ? GUIDE : null}
            />
          ) : null}
          {game.lowPerformance && phase !== 'done' ? (
            <p
              role="status"
              className="rounded-card bg-bg px-4 py-2 text-sm font-bold text-ink landscape:text-xs"
            >
              Tu dispositivo va lento con la cámara.{' '}
              <Link to="/bata-3d" className="text-primary underline">
                Prueba el modo 3D
              </Link>
            </p>
          ) : null}
          {status === 'model-error' ? (
            <p role="alert" className="rounded-card bg-bg px-4 py-2 font-bold text-danger">
              No pudimos cargar el modelo de detección. Recarga la página para intentarlo de nuevo.
            </p>
          ) : null}
          {phase === 'ready' && !cameraError ? (
            <>
              <ArHoverButton id="comenzar" label="Comenzar" onActivate={game.start} />
              <div className="flex flex-col items-center gap-3 landscape:fixed landscape:right-4 landscape:bottom-4 landscape:w-[34%] landscape:items-end">
                <div className="flex max-w-2xl flex-wrap justify-center gap-2 landscape:justify-end">
                  {hotspots.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      aria-pressed={h.id === hotspotId}
                      onClick={() => setHotspotId(h.id === hotspotId ? null : h.id)}
                      className="pressable min-h-11 rounded-pill bg-ink/60 px-4 text-sm font-bold text-bg ring-2 ring-bg/70 backdrop-blur-sm aria-pressed:bg-bg aria-pressed:text-ink"
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
                <p
                  aria-live="polite"
                  className="max-w-xl text-center text-sm font-bold text-bg empty:hidden landscape:text-right"
                >
                  {hotspots.find((h) => h.id === hotspotId)?.description}
                </p>
                <p className="max-w-xl text-center text-xs text-bg/85 landscape:text-right">
                  La imagen de tu cámara se procesa solo en este dispositivo y nunca se envía a
                  internet. Secuencia didáctica pendiente de validación por el director de tesis.{' '}
                  <Link to="/bata-espacio" className="font-bold underline">
                    Ver en tu espacio
                  </Link>
                </p>
              </div>
            </>
          ) : null}
          {phase === 'done' ? (
            <div className="flex gap-4">
              <ArHoverButton id="repetir" label="Jugar de nuevo" onActivate={game.start} />
              <ArHoverButton id="terminar" tone="quiet" label="Terminar" onActivate={game.stop} />
            </div>
          ) : null}
        </div>
      </section>
    </ArTargetsContext.Provider>
  );
}
