import { bogotaDate } from '@bata/shared/gamification';
import {
  type AnswerRequest,
  type AnswerResponse,
  AnswerResponseSchema,
  type Question,
  QuestionSchema,
} from '@bata/shared/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { type FormEvent, useState } from 'react';
import { LoadingState } from '../components/loading-state.tsx';
import { missionCode } from '../components/mission-sheet.tsx';
import { Pictogram } from '../components/pictogram.tsx';
import { StatsBar } from '../components/stats-bar.tsx';
import { buttonPrimary, pageTitle, sheet, textLink } from '../components/ui-classes.ts';
import { ApiError, apiFetch, type Profile, useMe } from '../lib/api.ts';
import { db, useAuth } from '../lib/firebase.tsx';
import { MissionSchema } from './home.tsx';

async function loadMission(missionId: string) {
  const [missionSnap, flagsSnap] = await Promise.all([
    getDoc(doc(db, 'missions', missionId)),
    getDoc(doc(db, 'appConfig', 'flags')),
  ]);
  if (!missionSnap.exists()) return null;
  const mission = MissionSchema.parse({ ...missionSnap.data(), id: missionSnap.id });
  // Rules reject (not filter) draft reads unless drafts are enabled, so the query must match.
  const showDrafts = flagsSnap.data()?.showDraftQuestions === true;
  const filters = [where('missionId', '==', missionId)];
  if (!showDrafts) filters.push(where('status', '==', 'validated'));
  const snap = await getDocs(query(collection(db, 'questions'), ...filters));
  const questions = snap.docs
    .map((d) => QuestionSchema.parse({ ...d.data(), id: d.id }))
    .sort((a, b) => mission.questionIds.indexOf(a.id) - mission.questionIds.indexOf(b.id));
  return { mission, questions };
}

function AnswerResult({ result }: { result: AnswerResponse }) {
  const { source } = result;
  return (
    <div className="flex animate-rise flex-col gap-3 rounded-card bg-bg p-4 shadow-sheet">
      <p
        className={`flex items-center gap-2 text-xl font-extrabold ${
          result.correct ? 'text-success' : 'text-danger'
        }`}
      >
        {result.correct ? <Pictogram name="check" className="size-6" strokeWidth={3} /> : null}
        {result.correct ? '¡Correcto!' : 'Incorrecto'}
      </p>
      <p className="max-w-[65ch]">{result.explanation}</p>
      <p className="border-t border-grid pt-2 text-sm text-muted">
        Fuente: {source.org}, «{source.title}» ({source.year}), {source.section}
      </p>
      {result.xpAwarded > 0 ? (
        <p>
          <span className="rounded-pill bg-xp px-3 py-1.5 text-sm leading-none font-extrabold text-ink">
            +{result.xpAwarded} XP
          </span>
        </p>
      ) : null}
    </div>
  );
}

function QuestionCard({ question, index }: { question: Question; index: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const multiple = question.type === 'multiple';
  const answer = useMutation({
    mutationFn: async (body: AnswerRequest) =>
      AnswerResponseSchema.parse(await apiFetch<unknown>('/quiz/answer', { method: 'POST', body })),
    onSuccess: async (result) => {
      queryClient.setQueryData<Profile | null>(['me', user?.uid], (old) =>
        old
          ? {
              ...old,
              xp: result.totalXp,
              level: result.level,
              streakDays: result.streakDays,
              ...(result.correct ? { lastActiveDate: bogotaDate(new Date()) } : {}),
            }
          : old,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['me'] }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
      ]);
    },
  });

  const toggle = (optionId: string, checked: boolean) => {
    if (!multiple) return setSelected([optionId]);
    setSelected((prev) => (checked ? [...prev, optionId] : prev.filter((id) => id !== optionId)));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) return;
    answer.mutate({ questionId: question.id, selectedOptionIds: selected });
  };

  const promptId = `pregunta-${question.id}`;

  return (
    <li className="flex flex-col gap-4 border-b border-grid pb-8 last:border-b-0 last:pb-0">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset aria-labelledby={promptId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={promptId} className="text-lg leading-snug font-extrabold text-balance">
              {index + 1}. {question.prompt}
            </h2>
            {question.status === 'draft' ? (
              <span className="rounded-pill bg-surface px-2 py-1 text-xs leading-none font-bold text-muted">
                Borrador
              </span>
            ) : null}
          </div>
          {multiple ? <p className="text-sm text-muted">Selecciona todas las correctas.</p> : null}
          {question.options.map((option) => {
            const id = `${question.id}-${option.id}`;
            return (
              <label
                key={option.id}
                htmlFor={id}
                className="pressable flex min-h-12 cursor-pointer items-start gap-3 rounded-card bg-bg px-3 py-3 ring-1 ring-border ring-inset hover:bg-primary-soft has-checked:bg-primary-soft has-checked:ring-2 has-checked:ring-primary"
              >
                <input
                  id={id}
                  type={multiple ? 'checkbox' : 'radio'}
                  name={question.id}
                  value={option.id}
                  checked={selected.includes(option.id)}
                  onChange={(e) => toggle(option.id, e.target.checked)}
                  className="mt-0.5 size-5 flex-none accent-primary"
                />
                <span>{option.text}</span>
              </label>
            );
          })}
        </fieldset>
        <button
          type="submit"
          disabled={selected.length === 0 || answer.isPending}
          className={`${buttonPrimary} self-start`}
        >
          Responder
        </button>
      </form>
      <div aria-live="polite">
        {answer.data ? <AnswerResult result={answer.data} /> : null}
        {answer.isError ? (
          <p role="alert" className="text-danger">
            {answer.error instanceof ApiError
              ? answer.error.message
              : 'Ocurrió un error inesperado.'}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default function MisionPage() {
  const { missionId = '' } = useParams({ strict: false });
  const me = useMe();
  const data = useQuery({
    queryKey: ['mission', missionId],
    queryFn: () => loadMission(missionId),
  });

  if (data.isPending) return <LoadingState />;
  if (data.isError || !data.data) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className={pageTitle}>Misión no disponible</h1>
        <Link to="/" className={`${textLink} self-start`}>
          Volver a las misiones
        </Link>
      </section>
    );
  }

  const { mission, questions } = data.data;
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link to="/" className={`${textLink} self-start text-sm`}>
          Volver a las misiones
        </Link>
        <p
          aria-hidden="true"
          className="font-mono text-code leading-none font-bold tracking-tighter text-primary"
        >
          {missionCode(mission.order)}
        </p>
        <h1 className={pageTitle}>{mission.title}</h1>
        <p className="max-w-[65ch] text-muted">{mission.description}</p>
        {me.data ? <StatsBar profile={me.data} /> : null}
      </header>
      {questions.length === 0 ? (
        <p className="text-muted">Esta misión aún no tiene preguntas publicadas.</p>
      ) : (
        <ol className={`${sheet} flex flex-col gap-8`}>
          {questions.map((question, index) => (
            <QuestionCard key={question.id} question={question} index={index} />
          ))}
        </ol>
      )}
    </section>
  );
}
