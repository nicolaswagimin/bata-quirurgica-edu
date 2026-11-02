import { Link } from '@tanstack/react-router';
import { Pictogram } from './pictogram.tsx';

export type SheetMission = {
  id: string;
  order: number;
  title: string;
  description: string;
  topic: string;
  xpReward: number;
  questionCount: number;
};

/** Mission code as printed in the notebook: order 2 → "M-02". */
export function missionCode(order: number): string {
  return `M-${String(order).padStart(2, '0')}`;
}

const sheetClass =
  'paper-grid relative -mx-4 px-4 py-6 pl-16 shadow-[inset_0_-2px_0_var(--color-primary)] ' +
  'before:absolute before:inset-y-0 before:left-11 before:border-l-2 before:border-margin ' +
  'md:mx-0 md:rounded-card md:py-10 md:pr-10 md:pl-24 md:shadow-sheet md:before:left-[4.5rem]';

/**
 * Today's open page: the one mission to continue, its six competency boxes and one action.
 * `correct` is null when progress could not be read, so the page never shows a false 0.
 */
export function MissionSheet({
  mission,
  correct,
  className = '',
}: {
  mission: SheetMission;
  correct: number | null;
  className?: string;
}) {
  const started = (correct ?? 0) > 0;
  const boxes = Array.from({ length: mission.questionCount }, (_, i) => i < (correct ?? 0));

  return (
    <section aria-labelledby="mision-de-hoy" className={`${sheetClass} ${className}`}>
      <h2 id="mision-de-hoy" className="flex flex-col gap-2">
        <span className="font-mono text-code leading-none font-bold tracking-tighter text-primary">
          {missionCode(mission.order)}
        </span>
        <span className="max-w-[24ch] text-lg leading-snug font-extrabold tracking-tight text-balance text-ink md:text-xl">
          {mission.title}
        </span>
      </h2>
      <p className="mt-2 max-w-[52ch] text-sm text-muted">{mission.description}</p>
      {correct === null ? (
        <p className="mt-4 text-sm text-muted">
          Tu progreso no está disponible ahora. Puedes seguir practicando igual.
        </p>
      ) : (
        <>
          <ol
            aria-label={`${correct} de ${mission.questionCount} preguntas correctas`}
            className="mt-4 flex flex-wrap gap-2"
          >
            {boxes.map((done, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, order-stable boxes
                key={i}
                className="grid size-8 place-items-center rounded-box border-2 border-primary bg-bg text-primary"
              >
                {done ? <Pictogram name="check" className="size-5" strokeWidth={3} /> : null}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-sm text-muted">
            <span className="font-bold text-ink">
              {correct} de {mission.questionCount}
            </span>{' '}
            correctas · +{mission.xpReward} XP al completar
          </p>
        </>
      )}
      <Link
        to="/mision/$missionId"
        params={{ missionId: mission.id }}
        className="pressable mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-pill bg-primary px-6 text-base font-extrabold text-bg hover:bg-primary-strong sm:w-auto sm:min-w-72"
      >
        {started ? 'Seguir practicando' : 'Empezar misión'}
        <Pictogram name="arrow" className="size-5" />
      </Link>
      {mission.topic === 'colocacion' ? (
        <p className="mt-3 text-sm text-muted">
          ¿Prefieres verlo primero?{' '}
          <Link
            to="/bata-3d"
            className="font-bold text-primary underline underline-offset-4 hover:text-primary-strong"
          >
            Practica la técnica en 3D
          </Link>
        </p>
      ) : null}
    </section>
  );
}
