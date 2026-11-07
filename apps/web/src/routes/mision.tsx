import { MAX_LIVES } from '@bata/shared/gamification';
import type {
  AnswerResponse,
  FinishAttemptResponse,
  StartAttemptResponse,
} from '@bata/shared/schemas';
import { FinishAttemptResponseSchema, StartAttemptResponseSchema } from '@bata/shared/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { doc, getDoc } from 'firebase/firestore';
import { useState } from 'react';
import { HEART, missionSprite } from '../art/sprites.ts';
import { LoadingState } from '../components/loading-state.tsx';
import { MascotNote } from '../components/mascot.tsx';
import { missionCode } from '../components/mission-sheet.tsx';
import { Pictogram } from '../components/pictogram.tsx';
import { PixelSprite } from '../components/pixel-sprite.tsx';
import { ExitDialog } from '../components/quiz-exit-dialog.tsx';
import { QuestionCard } from '../components/quiz-question.tsx';
import { QuizResults } from '../components/quiz-results.tsx';
import { StatsBar } from '../components/stats-bar.tsx';
import {
  buttonPrimary,
  buttonSecondary,
  pageTitle,
  panel,
  textLink,
} from '../components/ui-classes.ts';
import { ApiError, apiFetch, useMe } from '../lib/api.ts';
import { db } from '../lib/firebase.tsx';
import { MissionSchema } from '../lib/missions.ts';

type QuizPhase =
  | { kind: 'start' }
  | { kind: 'question'; attempt: StartAttemptResponse; index: number }
  | { kind: 'finish'; attempt: StartAttemptResponse; result: FinishAttemptResponse };

// ---------- carga de la misión desde Firestore (solo metadatos, sin claves) ----------

async function loadMissionMeta(missionId: string) {
  const snap = await getDoc(doc(db, 'missions', missionId));
  if (!snap.exists()) return null;
  return MissionSchema.parse({ ...snap.data(), id: snap.id });
}

// ---------- progreso del intento ----------

function Lives({ left }: { left: number }) {
  return (
    <span
      role="img"
      aria-label={`${left} de ${MAX_LIVES} vidas`}
      className="inline-flex items-center gap-0.5"
    >
      {Array.from({ length: MAX_LIVES }, (_, i) => (
        <PixelSprite
          // biome-ignore lint/suspicious/noArrayIndexKey: three fixed, order-stable hearts
          key={i}
          sprite={HEART}
          className={`size-4 ${i < left ? '' : 'opacity-25'}`}
        />
      ))}
    </span>
  );
}

function AttemptHeader({
  index,
  total,
  combo,
  livesLeft,
  alreadySealed,
}: {
  index: number;
  total: number;
  combo: number;
  livesLeft: number;
  alreadySealed: boolean;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-muted tabular-nums">
          Pregunta {index + 1} de {total}
        </span>
        <span className="flex items-center gap-2">
          {combo >= 2 ? (
            <span className="rounded-pill bg-primary-soft px-2 py-1 text-xs font-bold leading-none text-primary">
              {combo} seguidas
            </span>
          ) : null}
          <Lives left={livesLeft} />
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progreso de la misión"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index}
        className="h-2 overflow-hidden rounded-pill bg-primary-soft"
      >
        <div
          className="h-full rounded-pill bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${total > 0 ? (index / total) * 100 : 0}%` }}
        />
      </div>
      {alreadySealed ? (
        <p className="mt-1 flex items-center gap-2 rounded-card bg-seal-soft px-3 py-2 text-sm font-bold text-seal">
          <Pictogram name="check" className="size-4" strokeWidth={3} />
          Misión ya sellada · En este repaso el XP es 0
        </p>
      ) : null}
    </div>
  );
}

// ---------- página principal ----------

export default function MisionPage() {
  const { missionId = '' } = useParams({ strict: false });
  const me = useMe();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const missionQuery = useQuery({
    queryKey: ['mission-meta', missionId],
    queryFn: () => loadMissionMeta(missionId),
  });

  const [phase, setPhase] = useState<QuizPhase>({ kind: 'start' });
  const [combo, setCombo] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const livesLeft = Math.max(0, MAX_LIVES - wrong);

  const startMutation = useMutation({
    mutationFn: async () =>
      StartAttemptResponseSchema.parse(
        await apiFetch<unknown>('/quiz/attempt', { method: 'POST', body: { missionId } }),
      ),
    onSuccess: (attempt) => {
      setCombo(0);
      setWrong(0);
      setPhase({ kind: 'question', attempt, index: 0 });
    },
  });

  const finishMutation = useMutation({
    mutationFn: async (attemptId: string) =>
      FinishAttemptResponseSchema.parse(
        await apiFetch<unknown>('/quiz/finish', { method: 'POST', body: { attemptId } }),
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      setPhase((prev) =>
        prev.kind === 'question' ? { kind: 'finish', attempt: prev.attempt, result } : prev,
      );
    },
  });

  const handleAnswered = (response: AnswerResponse) => {
    setCombo((current) => (response.correct ? current + 1 : 0));
    if (!response.correct) setWrong((current) => current + 1);
  };

  const handleNext = () => {
    if (phase.kind !== 'question') return;
    const nextIndex = phase.index + 1;
    // Sin vidas o sin preguntas: el intento se cierra y se corrige.
    if (livesLeft === 0 || nextIndex >= phase.attempt.questions.length) {
      finishMutation.mutate(phase.attempt.attemptId);
    } else {
      setPhase({ ...phase, index: nextIndex });
    }
  };

  const handleExit = async () => {
    if (phase.kind !== 'question') {
      await navigate({ to: '/' });
      return;
    }
    // Cerrar el intento antes de salir: queda como abandonado y no da XP.
    try {
      await apiFetch('/quiz/finish', {
        method: 'POST',
        body: { attemptId: phase.attempt.attemptId },
      });
    } catch {
      // Si falla, igualmente salimos.
    }
    queryClient.invalidateQueries({ queryKey: ['me'] });
    await navigate({ to: '/' });
  };

  if (missionQuery.isPending) return <LoadingState />;
  if (missionQuery.isError || !missionQuery.data) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className={pageTitle}>Misión no disponible</h1>
        <Link to="/" className={`${textLink} self-start`}>
          Volver a las misiones
        </Link>
      </section>
    );
  }

  const mission = missionQuery.data;
  const total = phase.kind === 'start' ? 0 : phase.attempt.questions.length;
  const question = phase.kind === 'question' ? phase.attempt.questions[phase.index] : undefined;

  return (
    <>
      {showExitDialog ? (
        <ExitDialog
          onConfirm={() => {
            setShowExitDialog(false);
            void handleExit();
          }}
          onCancel={() => setShowExitDialog(false)}
        />
      ) : null}

      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Link to="/" className={`${textLink} self-start text-sm`}>
              Volver a las misiones
            </Link>
            {phase.kind === 'question' ? (
              <button
                type="button"
                onClick={() => setShowExitDialog(true)}
                className={`${textLink} text-sm text-muted`}
              >
                Salir
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <span className="tile-grid relative grid size-20 shrink-0 place-items-center rounded-card">
              <PixelSprite sprite={missionSprite(mission.iconKey)} className="size-12" />
              <span
                aria-hidden="true"
                className="absolute -right-2 -bottom-2 rounded-box bg-primary px-1.5 py-0.5 font-pixel text-xs font-semibold text-bg"
              >
                {missionCode(mission.order)}
              </span>
            </span>
            <h1 className={pageTitle}>{mission.title}</h1>
          </div>
          <p className="max-w-[65ch] text-muted">{mission.description}</p>
          {me.data ? <StatsBar profile={me.data} /> : null}
        </header>

        <div className={panel}>
          {phase.kind === 'start' ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-extrabold text-ink">Así funciona el examen</h2>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                  <li>Respondes cada pregunta una sola vez: no puedes corregirla después.</li>
                  <li>Apruebas con el 60 % de las respuestas correctas o más.</li>
                  <li>
                    Ganas <strong className="text-ink">{mission.xpReward} XP</strong> al aprobar, y{' '}
                    <strong className="text-ink">+20 XP</strong> si aciertas todas.
                  </li>
                  <li>Tienes {MAX_LIVES} vidas: si las pierdes, el examen se cierra.</li>
                  <li>Si no apruebas, no ganas XP y puedes intentarlo de nuevo.</li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className={buttonPrimary}
                >
                  {startMutation.isPending ? 'Preparando…' : 'Empezar misión'}
                  <Pictogram name="arrow" className="size-5" />
                </button>
                <Link
                  to="/aprende/$missionId"
                  params={{ missionId: mission.id }}
                  className={`${buttonSecondary} inline-flex items-center gap-1.5`}
                >
                  <Pictogram name="book" className="size-4" />
                  Leer la lección
                </Link>
              </div>
              <MascotNote on="panel" mood="idle">
                Un examen se aprueba o no se aprueba: el XP llega cuando dominas la misión.
              </MascotNote>
              {startMutation.isError ? (
                <p role="alert" className="text-sm text-danger">
                  {startMutation.error instanceof ApiError
                    ? startMutation.error.message
                    : 'No se pudo iniciar la misión. Intenta de nuevo.'}
                </p>
              ) : null}
            </div>
          ) : null}

          {phase.kind === 'question' && question ? (
            <>
              <AttemptHeader
                index={phase.index}
                total={total}
                combo={combo}
                livesLeft={livesLeft}
                alreadySealed={phase.attempt.alreadySealed}
              />
              <QuestionCard
                key={`${phase.attempt.attemptId}-${phase.index}`}
                question={question}
                attemptId={phase.attempt.attemptId}
                isLast={phase.index + 1 === total || livesLeft === 0}
                onAnswered={handleAnswered}
                onNext={handleNext}
              />
              {finishMutation.isPending ? (
                <p className="mt-4 text-sm text-muted">Calculando resultados…</p>
              ) : null}
              {finishMutation.isError ? (
                <p role="alert" className="mt-4 text-sm text-danger">
                  Error al cerrar el intento. Intenta de nuevo.
                </p>
              ) : null}
            </>
          ) : null}

          {phase.kind === 'finish' ? (
            <QuizResults
              result={phase.result}
              missionId={mission.id}
              onRetry={() => {
                setCombo(0);
                setWrong(0);
                setPhase({ kind: 'start' });
              }}
            />
          ) : null}
        </div>
      </section>
    </>
  );
}
