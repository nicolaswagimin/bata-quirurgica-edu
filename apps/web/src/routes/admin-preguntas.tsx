import type { AdminQuestion, QuestionInput } from '@bata/shared/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { LoadingState } from '../components/loading-state.tsx';
import { QuestionForm } from '../components/question-form.tsx';
import { AdminOnlyNotice } from '../components/require-admin.tsx';
import { ApiError, apiFetch } from '../lib/api.ts';
import { useAuth } from '../lib/firebase.tsx';

const QUESTIONS_KEY = ['admin', 'questions'] as const;

const primaryButtonClass =
  'min-h-11 rounded-pill bg-primary px-4 font-semibold text-bg hover:bg-primary-strong disabled:opacity-60';
const secondaryButtonClass =
  'min-h-11 rounded-pill border border-border px-4 font-semibold text-ink hover:bg-primary-soft';

type Editing = { question: AdminQuestion | null } | null;

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
}

const badgeClass = {
  validated: 'rounded-pill bg-primary px-3 py-1 text-xs font-semibold text-bg',
  draft: 'rounded-pill border border-border bg-bg px-3 py-1 text-xs font-semibold text-muted',
} as const;

export default function AdminPreguntasPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const questions = useQuery({
    queryKey: QUESTIONS_KEY,
    queryFn: () => apiFetch<AdminQuestion[]>('/admin/questions'),
    enabled: role === 'admin',
  });

  const validate = useMutation({
    mutationFn: (id: string) =>
      apiFetch<unknown>(`/admin/questions/${encodeURIComponent(id)}/validate`, { method: 'POST' }),
    onSuccess: async (_, id) => {
      setNotice(`Pregunta ${id} validada.`);
      await queryClient.invalidateQueries({ queryKey: QUESTIONS_KEY });
    },
    onError: (error) => setNotice(errorText(error)),
  });

  if (role !== 'admin') return <AdminOnlyNotice />;

  const list = questions.data ?? [];
  const missionIds = [...new Set(list.map((q) => q.missionId))].sort();

  const save = async (input: QuestionInput) => {
    const current = editing?.question;
    const saved = await apiFetch<AdminQuestion>(
      current ? `/admin/questions/${encodeURIComponent(current.id)}` : '/admin/questions',
      { method: current ? 'PUT' : 'POST', body: input },
    );
    setEditing(null);
    setNotice(`Pregunta ${saved.id} guardada como borrador.`);
    await queryClient.invalidateQueries({ queryKey: QUESTIONS_KEY });
  };

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Banco de preguntas</h1>
          <p className="text-sm text-muted">
            Toda pregunta nueva o editada queda en borrador hasta que un docente la valide.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => setEditing({ question: null })}
          >
            Nueva pregunta
          </button>
        ) : null}
      </header>

      <p aria-live="polite" className="text-sm text-ink">
        {notice}
      </p>

      {editing ? (
        <QuestionForm
          key={editing.question?.id ?? 'new'}
          question={editing.question}
          missionIds={missionIds}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {questions.isPending ? <LoadingState /> : null}
      {questions.isError ? (
        <p role="alert" className="text-danger">
          {errorText(questions.error)}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {list.map((q) => (
          <li
            key={q.id}
            className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className={badgeClass[q.status]}>
                {q.status === 'validated' ? 'Validada' : 'Borrador'}
              </span>
              <span>
                {q.id} · {q.missionId} · {q.xp} XP
              </span>
            </div>
            <p className="text-base text-ink">{q.prompt}</p>
            <ul className="text-sm text-muted">
              {q.options.map((o) => (
                <li key={o.id}>
                  {q.correctOptionIds.includes(o.id) ? '✔ ' : '· '}
                  {o.text}
                  {q.correctOptionIds.includes(o.id) ? (
                    <span className="sr-only"> (correcta)</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setEditing({ question: q })}
              >
                Editar
              </button>
              {q.status === 'draft' ? (
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={validate.isPending}
                  onClick={() => validate.mutate(q.id)}
                >
                  Validar
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
