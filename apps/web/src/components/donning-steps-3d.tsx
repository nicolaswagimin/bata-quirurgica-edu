import { useState } from 'react';
import { donningV2 } from '../three/donning-v2.ts';
import { StepModelViewer } from '../three/step-model-viewer.tsx';

const buttonClass =
  'pressable min-h-11 rounded-pill bg-primary px-4 font-bold text-bg hover:bg-primary-strong disabled:opacity-50';

export function DonningSteps3d() {
  const [index, setIndex] = useState(0);
  const step = donningV2.steps[index];
  if (!step) return null;

  return (
    <section aria-labelledby="donning-3d-title" className="flex flex-col gap-4">
      <h2 id="donning-3d-title" className="text-2xl font-extrabold text-ink">
        Colocación paso a paso en 3D
      </h2>
      <p className="text-sm text-muted">{donningV2.reviewNote}</p>
      <ol aria-label="Colocación paso a paso en 3D" className="grid gap-2 sm:grid-cols-2">
        {donningV2.steps.map((item, i) => (
          <li key={item.n}>
            <button
              type="button"
              aria-current={i === index ? 'step' : undefined}
              onClick={() => setIndex(i)}
              className={`min-h-11 w-full rounded-card px-3 py-2 text-left text-sm ${
                i === index ? 'bg-primary-soft font-bold text-ink' : 'text-ink hover:bg-surface'
              }`}
            >
              {item.n}. {item.title}
            </button>
          </li>
        ))}
      </ol>
      <StepModelViewer key={step.modelUrl} modelUrl={step.modelUrl} title={step.title} />
      <h3 aria-live="polite" data-testid="paso-3d-actual" className="text-lg font-extrabold">
        Paso {step.n} de {donningV2.steps.length}: {step.title}
      </h3>
      <p>{step.action}</p>
      <p className="text-sm text-muted">Qué observar: {step.look}</p>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Retroceder un paso en colocación 3D"
          className={buttonClass}
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          aria-label="Avanzar un paso en colocación 3D"
          className={buttonClass}
          disabled={index === donningV2.steps.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
