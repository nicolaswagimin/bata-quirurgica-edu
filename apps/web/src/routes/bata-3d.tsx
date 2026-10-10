import { BataPasosSchema } from '@bata/shared/schemas';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import pasosJson from '../../../../content/protocolos/bata-pasos.json';
import { Mannequin } from '../three/mannequin.tsx';
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
  'min-h-11 rounded-pill border border-border bg-bg px-4 font-semibold text-ink hover:bg-primary-soft disabled:opacity-50';

export default function Bata3dPage() {
  const reducedMotion = usePrefersReducedMotion();
  const [mode, setMode] = useState<TimelineMode>('donning');
  const [index, setIndex] = useState(0);
  const [hotspotId, setHotspotId] = useState<string | null>(null);

  const steps = timelines[mode];
  const step = steps[index] ?? steps[0];
  const tabLabel = TABS.find((t) => t.mode === mode)?.label ?? '';
  const stepHotspotIds = useMemo(() => new Set(step?.hotspotIds), [step]);
  const activeHotspot = pasos.hotspots.find((h) => h.id === hotspotId) ?? null;

  if (!step) return null;

  const selectMode = (next: TimelineMode) => {
    setMode(next);
    setIndex(0);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Modo 3D: bata quirúrgica</h1>
      <p className="text-sm text-muted">{pasos.reviewNote}</p>

      <div role="tablist" aria-label="Fase" className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={mode === tab.mode}
            onClick={() => selectMode(tab.mode)}
            className={`min-h-11 rounded-pill px-4 font-semibold ${
              mode === tab.mode
                ? 'bg-primary text-bg'
                : 'border border-border bg-bg text-ink hover:bg-primary-soft'
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
          className="overflow-hidden rounded-card border border-border bg-surface"
        >
          <Mannequin
            label={`Maniquí 3D con la bata quirúrgica. ${tabLabel}, paso ${index + 1}: ${step.title}`}
            progress={step.progress}
            animate={!reducedMotion}
            hotspotIds={step.hotspotIds}
            activeHotspotId={hotspotId}
          />
        </div>

        <section aria-labelledby="pasos-titulo" className="flex flex-col gap-3">
          <h2 id="pasos-titulo" className="text-lg font-semibold">
            Pasos
          </h2>
          <ol aria-label={tabLabel} className="flex flex-col gap-1">
            {steps.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={i === index ? 'step' : undefined}
                  onClick={() => setIndex(i)}
                  className={`min-h-11 w-full rounded-card px-3 py-2 text-left text-sm ${
                    i === index ? 'bg-primary-soft font-semibold' : 'hover:bg-surface'
                  }`}
                >
                  {s.order}. {s.title}
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="flex flex-col gap-2 rounded-card bg-surface p-4">
        <p aria-live="polite" data-testid="paso-actual" className="text-lg font-semibold">
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
            onClick={() => setIndex(index - 1)}
          >
            Anterior
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={index === steps.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>

      <section aria-labelledby="zonas-titulo" className="flex flex-col gap-2">
        <h2 id="zonas-titulo" className="text-lg font-semibold">
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
              className={`min-h-11 rounded-pill border px-4 text-sm font-semibold ${
                hotspotId === h.id
                  ? 'border-primary bg-primary-soft text-ink'
                  : 'border-border bg-bg text-ink hover:bg-primary-soft'
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
        Modelo procedural provisional. Ver{' '}
        <Link to="/creditos" className="text-primary underline hover:text-primary-strong">
          créditos
        </Link>
        .
      </p>
    </div>
  );
}
