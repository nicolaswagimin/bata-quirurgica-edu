import { Link } from '@tanstack/react-router';
import { missionSprite } from '../art/sprites.ts';
import { Pictogram } from './pictogram.tsx';
import { PixelSprite } from './pixel-sprite.tsx';
import { panel } from './ui-classes.ts';

export type SheetMission = {
  id: string;
  order: number;
  title: string;
  description: string;
  topic: string;
  xpReward: number;
  questionCount: number;
  iconKey?: string;
};

/** Mission code: order 2 → "M-02". */
export function missionCode(order: number): string {
  return `M-${String(order).padStart(2, '0')}`;
}

/**
 * Today's open mission: its pixel icon on the mint tile wall, one progress tile per question and
 * one action.
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
    <section aria-labelledby="mision-de-hoy" className={`${panel} ${className}`}>
      <div className="flex items-center gap-4">
        <span className="tile-grid relative grid size-20 shrink-0 place-items-center rounded-card md:size-24">
          <PixelSprite
            sprite={missionSprite(mission.iconKey ?? '')}
            className="size-12 md:size-16"
          />
          <span
            aria-hidden="true"
            className="absolute -right-2 -bottom-2 rounded-box bg-primary px-1.5 py-0.5 font-pixel text-xs font-semibold text-bg"
          >
            {missionCode(mission.order)}
          </span>
        </span>
        <h2
          id="mision-de-hoy"
          className="max-w-[24ch] text-lg leading-snug font-extrabold tracking-tight text-balance text-ink md:text-xl"
        >
          <span className="sr-only">Misión de hoy: </span>
          {mission.title}
        </h2>
      </div>
      <p className="mt-4 max-w-[52ch] text-sm text-muted">{mission.description}</p>
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
                className={`grid size-8 place-items-center rounded-box border-2 ${
                  done ? 'border-primary bg-primary text-bg' : 'border-muted bg-primary-soft'
                }`}
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
