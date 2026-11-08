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
import { MEDAL, XP_GEM } from '../art/sprites.ts';
import { ApiError, apiFetch, type Profile } from '../lib/api.ts';
import { useAuth } from '../lib/firebase.tsx';
import { Mascot } from './mascot.tsx';
import { PixelSprite } from './pixel-sprite.tsx';

function XpLine({ r }: { r: PracticeCompleteResponse }) {
  if (r.alreadyCompletedToday) {
    return (
      <p className="text-balance">Ya sumaste el XP de práctica de hoy; vuelve mañana por más.</p>
    );
  }
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xl font-extrabold landscape:text-base">
      ¡Práctica completa!{' '}
      <span className="inline-flex items-center gap-2 rounded-pill bg-xp px-3 py-1.5 font-pixel text-base leading-none font-semibold whitespace-nowrap">
        <PixelSprite sprite={XP_GEM} className="size-4" />+{r.xpAwarded} XP
      </span>
    </p>
  );
}

/**
 * End of the game: the pixel medal assembles (the screen's one orchestrated moment), then the score,
 * the warnings by kind and the XP. The practice is saved once and XP is decided by
 * POST /quiz/practice, never here.
 */
export function ArResults({
  errors,
  skipped = 0,
}: {
  errors: Partial<Record<Violation, number>>;
  /** Steps skipped with "Saltar paso": the practice is not saved and earns no XP. */
  skipped?: number;
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
    if (isIdle && skipped === 0) mutate();
  }, [isIdle, mutate, skipped]);

  const entries = Object.entries(errors).filter(([, n]) => (n ?? 0) > 0) as [Violation, number][];
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const score = scoreFor(total);

  return (
    <section
      role="status"
      aria-label="Resultado de la práctica"
      className="pointer-events-none flex w-[calc(100%-2rem)] max-w-md flex-col items-center gap-3 rounded-card bg-bg/95 px-6 py-6 text-center text-ink shadow-float landscape:max-w-lg landscape:gap-1.5 landscape:py-3"
    >
      <div aria-hidden="true" className="flex items-end gap-3">
        <Mascot mood="cheer" className="h-20 w-auto landscape:h-12" />
        <span className="flex animate-medal flex-col items-center">
          <PixelSprite sprite={MEDAL} className="size-20 landscape:size-12" />
        </span>
      </div>
      <p className="font-pixel text-2xl font-semibold text-seal landscape:text-lg">
        {skipped > 0 ? 'Casi lista' : 'Bata puesta'}
      </p>
      <p className="font-mono text-[40px] leading-none font-bold tabular-nums landscape:text-2xl">
        {score}
        <span className="text-xl text-muted">/100</span>
      </p>
      {skipped > 0 ? (
        <p className="text-balance">
          Saltaste {skipped === 1 ? '1 paso' : `${skipped} pasos`}: esta práctica no suma XP.
          Repítela completa para ganarlo.
        </p>
      ) : null}
      {submit.isPending ? <p className="text-muted">Guardando tu práctica…</p> : null}
      {submit.data ? <XpLine r={submit.data} /> : null}
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
                className="flex justify-between gap-3 border-b border-border py-1 last:border-b-0"
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
