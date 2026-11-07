import {
  type AnswerResponse,
  AnswerResponseSchema,
  type AttemptQuestion,
} from '@bata/shared/schemas';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { SPARKLE } from '../art/sprites.ts';
import { ApiError, apiFetch } from '../lib/api.ts';
import { MascotNote } from './mascot.tsx';
import { Pictogram } from './pictogram.tsx';
import { PixelSprite } from './pixel-sprite.tsx';
import { buttonPrimary } from './ui-classes.ts';

type Answered = { response: AnswerResponse; selectedOptionIds: string[] };

type QuestionCardProps = {
  question: AttemptQuestion;
  attemptId: string;
  /** true en la última pregunta: el botón cierra el intento en vez de avanzar. */
  isLast: boolean;
  onAnswered: (response: AnswerResponse, selectedOptionIds: string[]) => void;
  onNext: () => void;
};

/**
 * One question of the exam. A single shot: once answered the options lock, the correct answer and
 * its source are revealed, and the only way forward is the next question.
 */
export function QuestionCard({
  question,
  attemptId,
  isLast,
  onAnswered,
  onNext,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const multiple = question.type === 'multiple';

  const answerMutation = useMutation({
    mutationFn: async (body: {
      attemptId: string;
      questionId: string;
      selectedOptionIds: string[];
    }) =>
      AnswerResponseSchema.parse(await apiFetch<unknown>('/quiz/answer', { method: 'POST', body })),
    onSuccess: (result, vars) => {
      setAnswered({ response: result, selectedOptionIds: vars.selectedOptionIds });
      onAnswered(result, vars.selectedOptionIds);
      // Move the focus to the only action left once the feedback is on screen.
      window.setTimeout(() => nextRef.current?.focus(), 320);
    },
  });

  const toggle = (optionId: string) => {
    if (answered) return;
    if (!multiple) {
      setSelected([optionId]);
    } else {
      setSelected((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
    }
  };

  const submit = () => {
    if (selected.length === 0 || answerMutation.isPending || answered) return;
    answerMutation.mutate({ attemptId, questionId: question.id, selectedOptionIds: selected });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selected.length > 0 && !answered && !answerMutation.isPending) {
      submit();
    }
  };

  const promptId = `pregunta-${question.id}`;
  const result = answered?.response;

  return (
    <div className="relative flex flex-col gap-5">
      {result ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 rounded-card transition-opacity duration-300 motion-reduce:transition-none ${
            result.correct ? 'bg-success/10' : 'bg-danger/10'
          }`}
        />
      ) : null}

      <fieldset aria-labelledby={promptId} className="flex flex-col gap-3">
        <h2 id={promptId} className="text-lg leading-snug font-extrabold text-balance text-ink">
          {question.prompt}
        </h2>
        {multiple ? <p className="text-sm text-muted">Selecciona todas las correctas.</p> : null}

        <ul className="flex flex-col gap-2">
          {question.options.map((option) => {
            const isSelected = selected.includes(option.id);
            const isCorrect = result?.correctOptionIds.includes(option.id);
            const wasSelected = answered?.selectedOptionIds.includes(option.id);
            const locked = Boolean(answered);

            let stateClass =
              'ring-1 ring-border ring-inset hover:bg-primary-soft has-checked:bg-primary-soft has-checked:ring-2 has-checked:ring-primary';
            if (locked) {
              if (isCorrect) {
                stateClass = 'ring-2 ring-success bg-success/10 cursor-default';
              } else if (wasSelected && !isCorrect) {
                stateClass = 'ring-2 ring-danger bg-danger/10 cursor-default';
              } else {
                stateClass = 'ring-1 ring-border bg-surface/50 cursor-default opacity-70';
              }
            }

            return (
              <li key={option.id}>
                <label
                  htmlFor={`${question.id}-${option.id}`}
                  onKeyDown={handleKeyDown}
                  className={`pressable relative flex min-h-12 cursor-pointer items-start gap-3 rounded-card bg-bg px-3 py-3 transition-colors duration-150 motion-reduce:transition-none ${stateClass} ${locked ? 'pointer-events-none' : ''}`}
                >
                  <input
                    id={`${question.id}-${option.id}`}
                    type={multiple ? 'checkbox' : 'radio'}
                    name={question.id}
                    value={option.id}
                    checked={isSelected}
                    disabled={locked}
                    onChange={() => toggle(option.id)}
                    className="mt-0.5 size-5 flex-none accent-primary"
                  />
                  <span className="flex-1">{option.text}</span>
                  {locked && isCorrect ? (
                    <Pictogram
                      name="check"
                      className="mt-0.5 size-5 shrink-0 text-success"
                      strokeWidth={3}
                    />
                  ) : null}
                  {locked && wasSelected && !isCorrect ? (
                    <Pictogram
                      name="close"
                      className="mt-0.5 size-5 shrink-0 text-danger"
                      strokeWidth={3}
                    />
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {!answered ? (
        <button
          type="button"
          disabled={selected.length === 0 || answerMutation.isPending}
          onClick={submit}
          className={`${buttonPrimary} self-start`}
        >
          {answerMutation.isPending ? 'Enviando…' : 'Responder'}
        </button>
      ) : null}

      {result ? (
        <div
          aria-live="assertive"
          className="flex animate-rise flex-col gap-3 border-t-2 border-border pt-4"
        >
          <p
            className={`flex items-center gap-2 text-xl font-extrabold ${
              result.correct ? 'text-success' : 'text-danger'
            }`}
          >
            {result.correct ? (
              <Pictogram name="check" className="size-6" strokeWidth={3} />
            ) : (
              <Pictogram name="close" className="size-6" strokeWidth={2} />
            )}
            {result.correct ? '¡Correcto!' : 'Incorrecto'}
            {result.correct ? <PixelSprite sprite={SPARKLE} className="size-5" /> : null}
          </p>
          <p className="max-w-[65ch] text-base">{result.explanation}</p>
          <p className="border-t border-border pt-2 text-sm text-muted">
            Fuente: {result.source.org}, «{result.source.title}» ({result.source.year}),{' '}
            {result.source.section}
          </p>
          <MascotNote on="panel" mood={result.correct ? 'cheer' : 'idle'}>
            {result.correct
              ? '¡Así se hace! Cada acierto te acerca a sellar la misión.'
              : 'Lee la explicación con calma: así se aprende la técnica.'}
          </MascotNote>
          <button
            ref={nextRef}
            type="button"
            onClick={onNext}
            className={`${buttonPrimary} self-start`}
          >
            {isLast ? (
              'Ver resultados'
            ) : (
              <>
                Siguiente pregunta
                <Pictogram name="arrow" className="size-5" />
              </>
            )}
          </button>
        </div>
      ) : null}

      {answerMutation.isError ? (
        <p role="alert" className="text-sm text-danger">
          {answerMutation.error instanceof ApiError
            ? answerMutation.error.message
            : 'Ocurrió un error inesperado. Intenta de nuevo.'}
        </p>
      ) : null}
    </div>
  );
}
