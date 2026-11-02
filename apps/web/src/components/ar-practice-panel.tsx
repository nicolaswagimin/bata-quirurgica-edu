import { bogotaDate } from '@bata/shared/gamification';
import {
  type BataPasos,
  DONNING_STEP_IDS,
  type PracticeCompleteResponse,
  PracticeCompleteResponseSchema,
} from '@bata/shared/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { PracticeView } from '../ar/practice.ts';
import { ApiError, apiFetch, type Profile } from '../lib/api.ts';
import { useAuth } from '../lib/firebase.tsx';
import { Pictogram } from './pictogram.tsx';
import { buttonPrimary, buttonSecondary } from './ui-classes.ts';

type Step = BataPasos['donning'][number];

function resultText(r: PracticeCompleteResponse): string {
  return r.alreadyCompletedToday
    ? 'Práctica completa. Ya sumaste el XP de práctica de hoy; vuelve mañana por más.'
    : `¡Práctica completa! +${r.xpAwarded} XP`;
}

/** The guided donning practice: ordered steps, the live hint and the hold of the current step. */
export function ArPracticePanel({
  steps,
  view,
  onRestart,
  onExit,
}: {
  steps: readonly Step[];
  view: PracticeView;
  onRestart: () => void;
  onExit: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const submit = useMutation({
    mutationFn: async () =>
      PracticeCompleteResponseSchema.parse(
        await apiFetch<unknown>('/quiz/practice', {
          method: 'POST',
          body: { protocol: 'donning', stepIds: [...DONNING_STEP_IDS] },
        }),
      ),
    onSuccess: async (r) => {
      queryClient.setQueryData<Profile | null>(['me', user?.uid], (old) =>
        old
          ? {
              ...old,
              xp: r.totalXp,
              level: r.level,
              streakDays: r.streakDays,
              lastActiveDate: bogotaDate(new Date()),
            }
          : old,
      );
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const { mutate, isIdle } = submit;
  useEffect(() => {
    if (view.done && isIdle) mutate();
  }, [view.done, isIdle, mutate]);

  const current = steps[view.stepIndex];

  return (
    <section
      aria-labelledby="practica-titulo"
      className="flex flex-col gap-4 rounded-card bg-surface p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="practica-titulo" className="text-lg font-extrabold">
          Práctica guiada: colocación de la bata
        </h2>
        <button type="button" onClick={onExit} className={`${buttonSecondary} min-h-10 text-sm`}>
          Salir de la práctica
        </button>
      </div>
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const done = view.completedIds.includes(step.id);
          const active = i === view.stepIndex && !view.done;
          return (
            <li
              key={step.id}
              aria-current={active ? 'step' : undefined}
              className={`flex items-start gap-3 border-b border-grid py-2 last:border-b-0 ${
                active ? 'font-bold text-ink' : 'text-muted'
              }`}
            >
              <span
                className={`grid size-7 flex-none place-items-center rounded-box border-2 font-mono text-xs font-bold ${
                  done ? 'border-primary bg-primary text-bg' : 'border-primary text-primary'
                }`}
              >
                {done ? <Pictogram name="check" className="size-4" strokeWidth={3} /> : step.order}
              </span>
              <span>
                {step.title}
                <span className="sr-only">{done ? ' (hecho)' : active ? ' (en curso)' : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {!view.done && current ? (
        <div className="flex flex-col gap-2">
          <p aria-live="polite" data-testid="ar-practice-hint" className="font-bold text-ink">
            {view.hint}
          </p>
          <div
            role="progressbar"
            aria-label={`Sosteniendo el paso ${current.order}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(view.hold * 100)}
            className="h-2 overflow-hidden rounded-pill bg-grid"
          >
            <div
              className="h-full rounded-pill bg-primary"
              style={{ width: `${view.hold * 100}%` }}
            />
          </div>
          <p className="text-sm text-muted">{current.description}</p>
        </div>
      ) : null}

      {view.done ? (
        <div role="status" className="flex flex-col items-start gap-3">
          {submit.isPending ? <p className="text-muted">Guardando tu práctica…</p> : null}
          {submit.data ? (
            <p className="text-lg font-extrabold text-ink">{resultText(submit.data)}</p>
          ) : null}
          {submit.isError ? (
            <p className="font-bold text-danger">
              {submit.error instanceof ApiError
                ? submit.error.message
                : 'No pudimos guardar tu práctica. Inténtalo de nuevo.'}
            </p>
          ) : null}
          <button type="button" onClick={onRestart} className={buttonPrimary}>
            Practicar de nuevo
          </button>
        </div>
      ) : null}
      <p className="text-xs text-muted">
        Secuencia didáctica pendiente de validación por el director de tesis. La validación de
        postura es orientativa y no reemplaza la evaluación de tu docente.
      </p>
    </section>
  );
}
