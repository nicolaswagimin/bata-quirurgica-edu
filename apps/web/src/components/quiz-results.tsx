import { minCorrectToPass } from '@bata/shared/gamification';
import type { FinishAttemptResponse } from '@bata/shared/schemas';
import { Link } from '@tanstack/react-router';
import { SPARKLE, XP_GEM } from '../art/sprites.ts';
import { Pictogram } from './pictogram.tsx';
import { PixelSprite } from './pixel-sprite.tsx';
import { StarRating } from './star-rating.tsx';
import { buttonPrimary, buttonSecondary } from './ui-classes.ts';

type QuizResultsProps = {
  result: FinishAttemptResponse;
  missionId: string;
  onRetry: () => void;
};

function title(result: FinishAttemptResponse): string {
  if (result.abandoned) return 'Saliste antes de terminar';
  if (result.passed && result.alreadySealed) return '¡Repaso completado!';
  if (result.passed) return '¡Misión sellada!';
  if (result.alreadySealed) return 'Repaso terminado';
  return 'No aprobaste';
}

function summary(result: FinishAttemptResponse): string {
  const minimum = minCorrectToPass(result.total);
  if (result.abandoned) {
    return 'Cerrar el intento antes de responder todo no cuenta: esta vez no hay XP.';
  }
  if (result.passed && !result.alreadySealed) {
    return result.xpAwarded > 0
      ? `Aprobaste la misión y ganaste ${result.xpAwarded} XP.`
      : 'Aprobaste la misión. Ya estaba sellada, así que esta vez no hay XP.';
  }
  if (result.passed) {
    return 'Ya tenías la misión sellada: el repaso no da XP, pero mejora tus estrellas.';
  }
  if (result.alreadySealed) {
    return `Necesitabas ${minimum} de ${result.total} correctas. La misión sigue sellada.`;
  }
  return `Necesitabas ${minimum} de ${result.total} respuestas correctas. Esta vez no hay XP.`;
}

/**
 * End of an exam: pass or fail, stars, the XP actually paid (none when it was not passed) and the
 * questions to review, with the correct answer spelled out.
 */
export function QuizResults({ result, missionId, onRetry }: QuizResultsProps) {
  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
  const passed = result.passed;
  const minimum = minCorrectToPass(result.total);

  return (
    <section aria-labelledby="resultados-titulo" className="flex animate-rise flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {passed ? <PixelSprite sprite={SPARKLE} className="size-8" /> : null}
        <h2 id="resultados-titulo" className="text-2xl font-extrabold tracking-tight text-ink">
          {title(result)}
        </h2>
        <StarRating stars={result.stars} size="size-7" />
        <p className="max-w-[46ch] text-sm text-muted">{summary(result)}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-card bg-surface/60 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-muted">Respuestas correctas</span>
            <span className="text-3xl font-extrabold text-ink tabular-nums">
              {result.correct} / {result.total}
              <span className="ml-2 text-lg font-bold text-muted">({pct} %)</span>
            </span>
            <span className="text-xs text-muted">
              Mínimo para aprobar: {minimum} de {result.total} · Tu récord: {result.bestCorrect} de{' '}
              {result.total}
            </span>
          </div>
          {result.xpAwarded > 0 ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-bold text-muted">XP ganado</span>
              <span className="inline-flex items-center gap-2 rounded-pill bg-xp px-3 py-1.5 font-pixel text-lg font-semibold leading-none text-ink">
                <PixelSprite sprite={XP_GEM} className="size-5" />+{result.xpAwarded}
              </span>
              {result.bonusXp > 0 ? (
                <span className="text-xs text-muted">
                  incluye +{result.bonusXp} XP de misión perfecta
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-bold text-muted">XP ganado</span>
              <span className="rounded-pill bg-surface px-3 py-1.5 font-pixel text-lg font-semibold leading-none text-muted">
                0 XP
              </span>
            </div>
          )}
        </div>

        {result.failedQuestions.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-base font-extrabold text-ink">Preguntas para repasar</h3>
            <ul className="flex flex-col gap-4">
              {result.failedQuestions.map((q) => (
                <li key={q.id} className="flex flex-col gap-1">
                  <p className="font-medium text-ink">{q.prompt}</p>
                  <p className="text-sm text-ink">
                    <span className="font-bold text-success">Respuesta correcta: </span>
                    {q.options
                      .filter((o) => q.correctOptionIds.includes(o.id))
                      .map((o) => o.text)
                      .join(' · ')}
                  </p>
                  <p className="text-sm text-muted">
                    Fuente: {q.source.org}, «{q.source.title}» ({q.source.year}), {q.source.section}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {!passed ? (
          <button type="button" onClick={onRetry} className={buttonPrimary}>
            Reintentar misión
            <Pictogram name="arrow" className="size-5" />
          </button>
        ) : null}
        <Link
          to="/aprende/$missionId"
          params={{ missionId }}
          className={`${buttonSecondary} gap-2`}
        >
          <Pictogram name="book" className="size-4" />
          Repasar en Aprende
        </Link>
        <Link to="/" className={buttonSecondary}>
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
