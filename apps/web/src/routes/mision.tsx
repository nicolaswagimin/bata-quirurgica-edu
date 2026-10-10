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
import { ApiError, apiFetch, type Profile, useMe } from '../lib/api.ts';
import { db, useAuth } from '../lib/firebase.tsx';
import { MissionSchema, StatsBar } from './home.tsx';

const primaryButtonClass =
  'min-h-11 self-start rounded-pill bg-primary px-4 font-semibold text-bg hover:bg-primary-strong disabled:opacity-60';

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
    <div className="flex flex-col gap-2 rounded-card border border-border bg-bg p-4">
      <p className={`text-xl font-semibold ${result.correct ? 'text-success' : 'text-danger'}`}>
        {result.correct ? '¡Correcto!' : 'Incorrecto'}
      </p>
      <p>{result.explanation}</p>
      <p className="text-sm text-muted">
        Fuente: {source.org}, «{source.title}» ({source.year}), {source.section}
      </p>
      <p>
        <span className="rounded-pill bg-xp px-3 py-1 text-sm font-semibold text-ink">
          +{result.xpAwarded} XP
        </span>
      </p>
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
          ? { ...old, xp: result.totalXp, level: result.level, streakDays: result.streakDays }
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
    <li className="flex flex-col gap-4 rounded-card bg-surface p-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset aria-labelledby={promptId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={promptId} className="font-semibold">
              {index + 1}. {question.prompt}
            </h2>
            {question.status === 'draft' ? (
              <span className="rounded-pill border border-border bg-bg px-2 text-xs text-muted">
                Borrador
              </span>
            ) : null}
          </div>
          {multiple ? <p className="text-sm text-muted">Selecciona todas las correctas.</p> : null}
          {question.options.map((option) => {
            const id = `${question.id}-${option.id}`;
            return (
              <div key={option.id} className="flex items-start gap-2">
                <input
                  id={id}
                  type={multiple ? 'checkbox' : 'radio'}
                  name={question.id}
                  value={option.id}
                  checked={selected.includes(option.id)}
                  onChange={(e) => toggle(option.id, e.target.checked)}
                  className="mt-1 size-6 accent-primary"
                />
                <label htmlFor={id}>{option.text}</label>
              </div>
            );
          })}
        </fieldset>
        <button
          type="submit"
          disabled={selected.length === 0 || answer.isPending}
          className={primaryButtonClass}
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
        <h1 className="text-2xl font-semibold">Misión no disponible</h1>
        <Link to="/" className="text-primary underline hover:text-primary-strong">
          Volver a las misiones
        </Link>
      </section>
    );
  }

  const { mission, questions } = data.data;
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link to="/" className="text-sm text-primary underline hover:text-primary-strong">
          Volver a las misiones
        </Link>
        <h1 className="text-2xl font-semibold">{mission.title}</h1>
        <p className="text-muted">{mission.description}</p>
        {me.data ? <StatsBar profile={me.data} /> : null}
      </header>
      {questions.length === 0 ? (
        <p className="text-muted">Esta misión aún no tiene preguntas publicadas.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {questions.map((question, index) => (
            <QuestionCard key={question.id} question={question} index={index} />
          ))}
        </ol>
      )}
    </section>
  );
}
