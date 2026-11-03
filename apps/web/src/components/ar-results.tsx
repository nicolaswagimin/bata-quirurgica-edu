import { bogotaDate } from '@bata/shared/gamification';
import {
  DONNING_STEP_IDS,
  type PracticeCompleteResponse,
  PracticeCompleteResponseSchema,
} from '@bata/shared/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { scoreFor } from '../ar/game-view.ts';
import { VIOLATION_SHORT, type Violation } from '../ar/posture.ts';
import { ApiError, apiFetch, type Profile } from '../lib/api.ts';
import { useAuth } from '../lib/firebase.tsx';

function xpText(r: PracticeCompleteResponse): string {
  return r.alreadyCompletedToday
    ? 'Ya sumaste el XP de práctica de hoy; vuelve mañana por más.'
    : `¡Práctica completa! +${r.xpAwarded} XP`;
}

/**
 * End of the game: the notebook seal lands (the screen's one orchestrated moment), then the score,
 * the warnings by kind and the XP. The practice is saved once and XP is decided by
 * POST /quiz/practice, never here.
 */
export function ArResults({ errors }: { errors: Partial<Record<Violation, number>> }) {
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
    if (isIdle) mutate();
  }, [isIdle, mutate]);

  const entries = Object.entries(errors).filter(([, n]) => (n ?? 0) > 0) as [Violation, number][];
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const score = scoreFor(total);

  return (
    <section
      role="status"
      aria-label="Resultado de la práctica"
      className="pointer-events-none flex w-[calc(100%-2rem)] max-w-md flex-col items-center gap-3 rounded-card bg-bg/95 px-6 py-6 text-center text-ink shadow-float landscape:max-w-lg landscape:gap-1.5 landscape:py-3"
    >
      <span
        aria-hidden="true"
        className="relative grid size-28 -rotate-12 animate-stamp place-items-center rounded-pill border-[5px] border-seal font-mono text-sm leading-tight font-bold tracking-wider text-seal after:absolute after:inset-2 after:rounded-pill after:border-2 after:border-seal/60 landscape:size-16 landscape:border-[3px] landscape:text-[10px]"
      >
        <span>
          BATA
          <br />
          PUESTA
        </span>
      </span>
      <p className="font-mono text-[40px] leading-none font-bold tabular-nums landscape:text-2xl">
        {score}
        <span className="text-xl text-muted">/100</span>
      </p>
      {submit.isPending ? <p className="text-muted">Guardando tu práctica…</p> : null}
      {submit.data ? (
        <p className="text-xl font-extrabold landscape:text-base">{xpText(submit.data)}</p>
      ) : null}
      {submit.isError ? (
        <p className="font-bold text-danger">
          {submit.error instanceof ApiError
            ? submit.error.message
            : 'No pudimos guardar tu práctica. Inténtalo de nuevo.'}
        </p>
      ) : null}
      {total === 0 ? (
        <p className="text-base text-muted">Sin avisos de técnica estéril. ¡Impecable!</p>
      ) : (
        <div className="w-full text-left">
          <p className="text-sm font-bold">Avisos de técnica estéril: {total}</p>
          <ul className="mt-1 text-sm text-muted">
            {entries.map(([kind, n]) => (
              <li
                key={kind}
                className="flex justify-between gap-3 border-b border-grid py-1 last:border-b-0"
              >
                <span>{VIOLATION_SHORT[kind]}</span>
                <span className="font-mono tabular-nums">×{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
