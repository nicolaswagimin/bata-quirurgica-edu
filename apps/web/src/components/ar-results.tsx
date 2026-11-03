import { bogotaDate } from '@bata/shared/gamification';
import {
  DONNING_STEP_IDS,
  type PracticeCompleteResponse,
  PracticeCompleteResponseSchema,
} from '@bata/shared/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError, apiFetch, type Profile } from '../lib/api.ts';
import { useAuth } from '../lib/firebase.tsx';

function resultText(r: PracticeCompleteResponse): string {
  return r.alreadyCompletedToday
    ? 'Práctica completa. Ya sumaste el XP de práctica de hoy; vuelve mañana por más.'
    : `¡Práctica completa! +${r.xpAwarded} XP`;
}

/**
 * End of the game: saves the practice once (XP is decided by POST /quiz/practice, never here) and
 * shows the outcome with the warnings the player triggered.
 */
export function ArResults({ errors }: { errors: number }) {
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

  return (
    <section
      role="status"
      aria-label="Resultado de la práctica"
      className="pointer-events-none mx-4 flex max-w-xl flex-col items-center gap-2 rounded-card bg-bg/95 px-6 py-5 text-center text-ink shadow-float"
    >
      {submit.isPending ? <p className="text-muted">Guardando tu práctica…</p> : null}
      {submit.data ? (
        <p className="text-2xl font-extrabold md:text-[32px]">{resultText(submit.data)}</p>
      ) : null}
      {submit.isError ? (
        <p className="font-bold text-danger">
          {submit.error instanceof ApiError
            ? submit.error.message
            : 'No pudimos guardar tu práctica. Inténtalo de nuevo.'}
        </p>
      ) : null}
      <p className="text-base text-muted">
        {errors === 0
          ? 'Sin avisos de técnica estéril. ¡Impecable!'
          : `Avisos de técnica estéril: ${errors}. Repite para bajarlos a cero.`}
      </p>
    </section>
  );
}
