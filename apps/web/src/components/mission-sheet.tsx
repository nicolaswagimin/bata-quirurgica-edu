import { minCorrectToPass } from '@bata/shared/gamification';
import { Link } from '@tanstack/react-router';
import { missionSprite } from '../art/sprites.ts';
import { Pictogram } from './pictogram.tsx';
import { PixelSprite } from './pixel-sprite.tsx';
import { StarRating } from './star-rating.tsx';
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

/** Lo que el inicio sabe del progreso de una misión; `null` si Firestore no respondió. */
export type MissionProgressView = {
  bestCorrect: number;
  questionCount: number;
  stars: number;
  sealed: boolean;
};

/** Mission code: order 2 → "M-02". */
export function missionCode(order: number): string {
  return `M-${String(order).padStart(2, '0')}`;
}

/**
 * Today's open mission: its pixel icon on the mint tile wall, one tile per question of the best
 * attempt, the pass bar and one action.
 * `progress` is null when progress could not be read, so the page never shows a false 0.
 */
export function MissionSheet({
  mission,
  progress,
  className = '',
}: {
  mission: SheetMission;
  progress: MissionProgressView | null;
  className?: string;
}) {
  const best = progress?.bestCorrect ?? 0;
  const total = progress?.questionCount ?? mission.questionCount;
  const sealed = progress?.sealed ?? false;
  const started = best > 0;
  const minimum = minCorrectToPass(total);
  const boxes = Array.from({ length: total }, (_, i) => i < best);

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
      {progress === null ? (
        <p className="mt-4 text-sm text-muted">
          Tu progreso no está disponible ahora. Puedes seguir practicando igual.
        </p>
      ) : (
        <>
          <ol
            aria-label={`Mejor intento: ${best} de ${total} preguntas correctas`}
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
          {sealed ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
              <StarRating stars={progress.stars} size="size-5" />
              <span className="font-bold text-seal">Misión dominada</span>· récord {best} de {total}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              <span className="font-bold text-ink">
                Necesitas {minimum} de {total} correctas
              </span>{' '}
              para aprobar · +{mission.xpReward} XP
            </p>
          )}
        </>
      )}
      <Link
        to="/mision/$missionId"
        params={{ missionId: mission.id }}
        className="pressable mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-pill bg-primary px-6 text-base font-extrabold text-bg hover:bg-primary-strong sm:w-auto sm:min-w-72"
      >
        {sealed ? 'Repasar misión' : started ? 'Volver a intentarlo' : 'Empezar misión'}
        <Pictogram name="arrow" className="size-5" />
      </Link>
      <p className="mt-3 text-sm text-muted">
        <Link
          to="/aprende/$missionId"
          params={{ missionId: mission.id }}
          className="inline-flex items-center gap-1.5 font-bold text-primary underline underline-offset-4 hover:text-primary-strong"
        >
          <Pictogram name="book" className="size-4" />
          Lee la lección
        </Link>{' '}
        antes si es tu primera vez.
      </p>
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
