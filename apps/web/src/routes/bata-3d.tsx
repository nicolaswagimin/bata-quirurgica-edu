import { BataPasosSchema } from '@bata/shared/schemas';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import pasosJson from '../../../../content/protocolos/bata-pasos.json';
import { DonningSteps3d } from '../components/donning-steps-3d.tsx';
import { pageTitle } from '../components/ui-classes.ts';
import { chapterAt, parseChapters, toFilmTime, toModelTime } from '../three/chapters.ts';
import { Mannequin } from '../three/mannequin.tsx';
import { ModelBoundary } from '../three/model-boundary.tsx';
import chaptersVtt from '../three/procedimiento-ppe-capitulos.vtt?raw';
import chaptersUrl from '../three/procedimiento-ppe-capitulos.vtt?url';
import { ProcedureViewer } from '../three/procedure-viewer.tsx';
import { buildTimeline, type TimelineMode } from '../three/steps.ts';

const pasos = BataPasosSchema.parse(pasosJson);
const timelines = {
  donning: buildTimeline(pasos, 'donning'),
  doffing: buildTimeline(pasos, 'doffing'),
};
const TABS: { mode: TimelineMode; label: string }[] = [
  { mode: 'donning', label: 'Colocación' },
  { mode: 'doffing', label: 'Retiro' },
];

// One chapter per step (donning, then doffing): the VTT is the single source of the film timings.
const chapters = parseChapters(chaptersVtt);
const total = chapters[chapters.length - 1]!.end;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION).matches);
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION);
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

const buttonClass =
  'pressable min-h-11 rounded-pill bg-bg px-4 font-bold text-primary ring-2 ring-primary ring-inset hover:bg-primary-soft disabled:opacity-50';

export default function Bata3dPage() {
  const reducedMotion = usePrefersReducedMotion();
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(!reducedMotion);
  const [interactive, setInteractive] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  function seek(seconds: number) {
    if (video.current) video.current.currentTime = seconds;
    setTime(seconds);
  }
  useEffect(() => {
    const player = video.current;
    if (interactive || !player) return;
    if (playing)
      void player.play().catch(() => {
        if (player.paused) setPlaying(false);
      });
    else player.pause();
  }, [playing, interactive]);
  const chapter = chapterAt(chapters, time);
  const mode: TimelineMode = chapter < timelines.donning.length ? 'donning' : 'doffing';
  const index = mode === 'donning' ? chapter : chapter - timelines.donning.length;
  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);
  function selectStep(phase: TimelineMode, i: number) {
    const target = chapters[(phase === 'doffing' ? timelines.donning.length : 0) + i];
    if (target) seek(target.start);
  }
  const [hotspotId, setHotspotId] = useState<string | null>(null);
  const [shownModel, setShownModel] = useState('');

  const steps = timelines[mode];
  const step = steps[index] ?? steps[0];
  const tabLabel = TABS.find((t) => t.mode === mode)?.label ?? '';
  const stepHotspotIds = useMemo(() => new Set(step?.hotspotIds), [step]);
  const activeHotspot = pasos.hotspots.find((h) => h.id === hotspotId) ?? null;

  if (!step) return null;

  const mannequin = (
    <Mannequin
      label={`Maniquí 3D con la bata quirúrgica. ${tabLabel}, paso ${index + 1}: ${step.title}`}
      progress={step.progress}
      animate={!reducedMotion}
      hotspotIds={step.hotspotIds}
      activeHotspotId={hotspotId}
    />
  );

  const selectMode = (next: TimelineMode) => {
    selectStep(next, 0);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className={pageTitle}>Modo 3D: bata quirúrgica</h1>
      <p className="text-sm text-muted">{pasos.reviewNote}</p>

      <div role="tablist" aria-label="Fase" className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={mode === tab.mode}
            onClick={() => selectMode(tab.mode)}
            className={`min-h-11 rounded-pill px-4 font-bold ${
              mode === tab.mode
                ? 'bg-primary text-bg'
                : 'bg-bg text-primary ring-2 ring-primary ring-inset hover:bg-primary-soft'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div
          data-testid="bata-3d"
          data-animate={reducedMotion ? 'false' : 'true'}
          data-model={shownModel}
          className="overflow-hidden rounded-card bg-surface shadow-sheet"
        >
          {interactive ? (
            <ModelBoundary fallback={mannequin}>
              <ProcedureViewer
                label={`Procedimiento 3D. ${tabLabel}, paso ${index + 1}: ${step.title}`}
                time={toModelTime(chapters, time)}
                playing={playing && time < total}
                onTime={(seconds) => setTime(toFilmTime(chapters, seconds))}
                hotspotIds={step.hotspotIds}
                activeHotspotId={hotspotId}
                onShown={setShownModel}
              />
            </ModelBoundary>
          ) : (
            <video
              ref={video}
              muted
              playsInline
              preload="auto"
              className="h-96 w-full bg-surface object-contain sm:h-[32rem]"
              aria-label="Demostración de colocación y retiro"
              src="/videos/procedimiento-ppe.mp4"
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime = time;
              }}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onEnded={() => {
                setTime(total);
                setPlaying(false);
              }}
            >
              <track
                kind="captions"
                src="/videos/procedimiento-ppe.vtt"
                srcLang="es"
                label="Español"
                default
              />
              <track kind="chapters" src={chaptersUrl} srcLang="es" label="Pasos" />
            </video>
          )}
          <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                if (time >= total) {
                  seek(0);
                  setPlaying(true);
                } else setPlaying(!playing);
              }}
            >
              {time >= total ? 'Repetir procedimiento' : playing ? 'Pausar' : 'Reproducir'}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setInteractive(!interactive)}
            >
              {interactive ? 'Ver demostración' : 'Explorar en 3D'}
            </button>
            <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm text-muted">
              Recorrer el procedimiento
              <input
                type="range"
                min={0}
                max={total}
                step={0.1}
                value={time}
                aria-valuetext={`${Math.floor(time)} segundos, ${tabLabel}, paso ${index + 1}`}
                onChange={(e) => {
                  setPlaying(false);
                  seek(Number(e.target.value));
                }}
              />
            </label>
            <span className="font-mono text-sm tabular-nums">
              {Math.floor(time)} / {total} s
            </span>
          </div>
        </div>

        <section aria-labelledby="pasos-titulo" className="flex flex-col gap-3">
          <h2 id="pasos-titulo" className="text-lg font-extrabold">
            Pasos
          </h2>
          <ol aria-label={tabLabel} className="flex flex-col gap-1">
            {steps.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={i === index ? 'step' : undefined}
                  onClick={() => selectStep(mode, i)}
                  className={`min-h-11 w-full rounded-card px-3 py-2 text-left text-sm ${
                    i === index ? 'bg-primary-soft font-bold' : 'hover:bg-surface'
                  }`}
                >
                  {s.order}. {s.title}
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="grid gap-4 rounded-card bg-surface p-4">
        <div className="flex flex-col gap-2">
          <p aria-live="polite" data-testid="paso-actual" className="text-lg font-extrabold">
            Paso {index + 1} de {steps.length}: {step.title}
          </p>
          <p>{step.description}</p>
          <p className="text-sm text-muted">
            Fuente: {step.source.org}, {step.source.title} ({step.source.year})
            {step.source.section ? ` · ${step.source.section}` : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={index === 0}
              onClick={() => selectStep(mode, index - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={index === steps.length - 1}
              onClick={() => selectStep(mode, index + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      <section aria-labelledby="zonas-titulo" className="flex flex-col gap-2">
        <h2 id="zonas-titulo" className="text-lg font-extrabold">
          Zonas de la bata
        </h2>
        <div className="flex flex-wrap gap-2">
          {pasos.hotspots.map((h) => (
            <button
              key={h.id}
              type="button"
              aria-expanded={hotspotId === h.id}
              aria-controls="zona-descripcion"
              onClick={() => setHotspotId(hotspotId === h.id ? null : h.id)}
              className={`min-h-11 rounded-pill border px-4 text-sm font-bold ${
                hotspotId === h.id
                  ? 'border-primary bg-primary-soft text-ink'
                  : 'border-muted bg-bg text-ink hover:bg-primary-soft'
              } ${stepHotspotIds.has(h.id) ? 'underline' : ''}`}
            >
              {h.label}
            </button>
          ))}
        </div>
        <p id="zona-descripcion" aria-live="polite" className="min-h-6">
          {activeHotspot ? `${activeHotspot.label}: ${activeHotspot.description}` : ''}
        </p>
      </section>

      <p className="text-sm text-muted">
        Ver{' '}
        <Link to="/creditos" className="text-primary underline hover:text-primary-strong">
          créditos
        </Link>
        .
      </p>
      <DonningSteps3d />
    </div>
  );
}
