// Panel de captura del AR v2: consentimiento explícito, grabación de ventanas de landmarks y
// descarga en JSON. Solo se monta en desarrollo con `?captura=1`; nunca se sube nada.
import type { CaptureTake } from '@bata/shared/perception';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buttonDanger, buttonPrimary, buttonSecondary } from '../../components/ui-classes.ts';
import { CAPTURE_WINDOW_MS, type CaptureRecorder } from './capture.ts';

export type CaptureStep = { id: string; title: string };

type CapturePanelProps = {
  steps: readonly CaptureStep[];
  /** Paso que se está jugando, si hay partida. */
  currentStepId: string | null;
  recorder: CaptureRecorder;
  takes: readonly CaptureTake[];
  onTake: (take: CaptureTake) => void;
  onClear: () => void;
};

function download(take: CaptureTake): void {
  const blob = new Blob([JSON.stringify(take, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ar-captura-${take.label}-${take.capturedAt.replace(/[:.]/g, '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CapturePanel({
  steps,
  currentStepId,
  recorder,
  takes,
  onTake,
  onClear,
}: CapturePanelProps) {
  const [consented, setConsented] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [label, setLabel] = useState(currentStepId ?? steps[0]?.id ?? '');
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const take = recorder.stop(performance.now());
    setRecording(false);
    if (take) {
      onTake(take);
      setNotice(null);
    } else {
      setNotice('La toma fue demasiado corta. Inténtalo otra vez.');
    }
  }, [recorder, onTake]);

  const start = useCallback(() => {
    if (!label) {
      setNotice('Elige el paso que vas a practicar.');
      return;
    }
    setNotice(null);
    recorder.start(label, performance.now());
    setRecording(true);
    timer.current = window.setTimeout(stop, CAPTURE_WINDOW_MS);
  }, [label, recorder, stop]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  // Sigue el paso de la partida cuando cambia y no se está grabando.
  useEffect(() => {
    if (!recording && currentStepId) setLabel(currentStepId);
  }, [currentStepId, recording]);

  if (!consented) {
    return (
      <aside
        aria-labelledby="captura-titulo"
        className="fixed right-3 bottom-3 z-[80] w-[min(23rem,calc(100vw-1.5rem))] rounded-card bg-bg p-4 text-ink shadow-float"
      >
        <h2 id="captura-titulo" className="text-base font-extrabold">
          Captura de práctica (desarrollo)
        </h2>
        <p className="mt-2 text-sm text-muted">
          Se graban <strong className="text-ink">solo coordenadas del cuerpo</strong> (puntos y
          ángulos). No se guarda video ni imágenes, y nada sale de tu navegador: el archivo se
          descarga a tu equipo cuando lo pidas.
        </p>
        <p className="mt-2 text-sm text-muted">
          Puedes borrar las tomas en cualquier momento con el botón “Borrar tomas”. Al salir de la
          página se descartan.
        </p>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-5 flex-none accent-primary"
          />
          <span>
            Entiendo y acepto que se graben mis coordenadas corporales solo en este dispositivo.
          </span>
        </label>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!accepted}
            onClick={() => setConsented(true)}
            className={buttonPrimary}
          >
            Empezar captura
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-labelledby="captura-titulo"
      className="fixed right-3 bottom-3 z-[80] flex max-h-[70vh] w-[min(23rem,calc(100vw-1.5rem))] flex-col gap-3 overflow-auto rounded-card bg-bg p-4 text-ink shadow-float"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 id="captura-titulo" className="text-base font-extrabold">
          Captura AR v2
        </h2>
        <span className="text-xs font-bold text-primary">Solo desarrollo</span>
      </header>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Paso
        <select
          value={label}
          disabled={recording}
          onChange={(e) => setLabel(e.target.value)}
          className="min-h-11 rounded-card border border-muted bg-bg px-3 text-base text-ink"
        >
          {steps.map((step) => (
            <option key={step.id} value={step.id}>
              {step.title}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <button type="button" onClick={stop} className={buttonDanger}>
            Detener
          </button>
        ) : (
          <button type="button" onClick={start} className={buttonPrimary}>
            Grabar {CAPTURE_WINDOW_MS / 1000} s
          </button>
        )}
        <span className="text-xs text-muted" aria-live="polite">
          {recording ? 'Grabando… muévete como en la práctica real.' : `${takes.length} tomas`}
        </span>
      </div>

      {notice ? (
        <p role="status" className="text-sm font-bold text-danger">
          {notice}
        </p>
      ) : null}

      {takes.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {takes.map((take, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: las tomas solo se añaden y se borran todas
              key={`${take.label}-${take.capturedAt}-${i}`}
              className="flex items-center justify-between gap-2 rounded-card bg-surface px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block font-bold text-ink">{take.label}</span>
                <span className="block text-xs text-muted">
                  {take.frames.length} frames · {(take.durationMs / 1000).toFixed(1)} s
                </span>
              </span>
              <button
                type="button"
                onClick={() => download(take)}
                className={`${buttonSecondary} shrink-0`}
              >
                Descargar
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClear}
          disabled={takes.length === 0}
          className={buttonDanger}
        >
          Borrar tomas
        </button>
        <p className="text-right text-xs text-muted">
          Solo landmarks. Sin video, sin imágenes, sin red.
        </p>
      </div>
    </aside>
  );
}
