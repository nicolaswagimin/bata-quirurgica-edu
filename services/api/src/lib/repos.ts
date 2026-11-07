import { randomInt } from 'node:crypto';
import {
  bogotaDate,
  levelForXp,
  missionXpAward,
  nextStreak,
  PRACTICE_XP,
  sameSet,
} from '@bata/shared/gamification';
import type {
  AdminQuestion,
  AnswerResponse,
  AttemptQuestion,
  FailedQuestionSummary,
  FinishAttemptResponse,
  MemberProgress,
  PracticeCompleteResponse,
  Question,
  QuestionInput,
  Role,
  StartAttemptResponse,
} from '@bata/shared/schemas';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { consumeQuota, type QuotaDoc, type QuotaKind } from './quota.ts';

// Único módulo de runtime que toca colecciones de Firestore (las rutas pasan por aquí).

export type UserDoc = {
  uid: string;
  displayName: string;
  email: string;
  role: Role;
  groupId: string | null;
  xp: number;
  level: number;
  streakDays: number;
  lastActiveDate: string | null;
  consent: { policyVersion: string; acceptedAt: string };
  createdAt: string;
  updatedAt: string;
};

export type LeaderboardDoc = {
  displayName: string;
  xp: number;
  level: number;
  groupId: string | null;
  updatedAt: string;
};

export type GroupDoc = { name: string; joinCode: string; createdBy: string; createdAt: string };

export type Group = GroupDoc & { groupId: string };

const JOIN_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const JOIN_CODE_ATTEMPTS = 5;

export function randomJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  return code;
}

export async function getUser(db: Firestore, uid: string): Promise<UserDoc | null> {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? (snap.data() as UserDoc) : null;
}

export function leaderboardEntry(user: UserDoc): LeaderboardDoc {
  return {
    displayName: user.displayName,
    xp: user.xp,
    level: user.level,
    groupId: user.groupId,
    updatedAt: user.updatedAt,
  };
}

// `create` falla con ALREADY_EXISTS (código 6) si el perfil ya existe: la ruta lo traduce a 409.
export async function createProfileBatch(db: Firestore, user: UserDoc): Promise<void> {
  const batch = db.batch();
  batch.create(db.doc(`users/${user.uid}`), user);
  batch.set(db.doc(`leaderboard/${user.uid}`), leaderboardEntry(user));
  await batch.commit();
}

export async function findGroupByCode(db: Firestore, joinCode: string): Promise<Group | null> {
  const snap = await db.collection('groups').where('joinCode', '==', joinCode).limit(1).get();
  const doc = snap.docs[0];
  return doc ? { groupId: doc.id, ...(doc.data() as GroupDoc) } : null;
}

export async function createGroup(
  db: Firestore,
  input: { name: string; createdBy: string; createdAt: string },
  generateCode: () => string = randomJoinCode,
): Promise<Group> {
  for (let attempt = 0; attempt < JOIN_CODE_ATTEMPTS; attempt++) {
    const joinCode = generateCode();
    if (await findGroupByCode(db, joinCode)) continue;
    const data: GroupDoc = { ...input, joinCode };
    const ref = await db.collection('groups').add(data);
    return { groupId: ref.id, ...data };
  }
  throw new Error('Could not generate a unique join code');
}

export async function setUserGroup(
  db: Firestore,
  uid: string,
  groupId: string,
  updatedAt: string,
): Promise<void> {
  const batch = db.batch();
  batch.update(db.doc(`users/${uid}`), { groupId, updatedAt });
  batch.set(db.doc(`leaderboard/${uid}`), { groupId, updatedAt }, { merge: true });
  await batch.commit();
}

// `progress/{uid}` puede no existir como documento; recursiveDelete borra igual sus subcolecciones.
export async function deleteUserData(db: Firestore, uid: string): Promise<void> {
  await db.recursiveDelete(db.doc(`progress/${uid}`));
  const batch = db.batch();
  batch.delete(db.doc(`users/${uid}`));
  batch.delete(db.doc(`leaderboard/${uid}`));
  batch.delete(db.doc(`quotas/${uid}`));
  await batch.commit();
}

export function consumeQuotaTx(
  db: Firestore,
  uid: string,
  kind: QuotaKind,
  nowMs: number,
): Promise<boolean> {
  const ref = db.doc(`quotas/${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data() as QuotaDoc) : undefined;
    const { allowed, next } = consumeQuota(current, kind, nowMs);
    if (allowed) tx.set(ref, next);
    return allowed;
  });
}

export type QuestionDoc = Omit<Question, 'id'>;

export type MissionProgressDoc = {
  /** IDs de preguntas respondidas correctamente en algún intento. */
  answeredCorrectIds: string[];
  /** true si la misión está aprobada (sello de dominio). */
  sealed: boolean;
  sealedAt: string | null;
  /** Récord de estrellas de 0 a 3; un repaso puede mejorarlo. */
  stars: number;
  /** Récord de aciertos en un intento completo. */
  bestCorrect: number;
  /** Intento abierto de esta misión; empezar otro lo abandona. */
  openAttemptId?: string | null;
  /** Legado: el mapa de misiones antiguo leía `completed`. */
  completed?: boolean;
  completedAt?: string | null;
};

// ---------- Intento de misión ----------

export type AttemptStatus = 'open' | 'finished' | 'abandoned';

export type AttemptDoc = {
  uid: string;
  missionId: string;
  /** IDs de preguntas en orden barajado para este intento. */
  questionIds: string[];
  /** IDs de preguntas ya respondidas en este intento. */
  answeredQuestionIds: string[];
  /** IDs de preguntas respondidas correctamente en este intento. */
  correctQuestionIds: string[];
  status: AttemptStatus;
  /** true si la misión ya estaba sellada al iniciar (repaso). */
  wasAlreadySealed: boolean;
  startedAt: string;
  finishedAt: string | null;
};

/** Baraja un arreglo usando Fisher-Yates con randomInt del módulo crypto. */
function shuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

export type StartAttemptInput = {
  uid: string;
  missionId: string;
  allowDrafts: boolean;
  now: Date;
};

export type StartAttemptOutcome =
  | { status: 'mission_not_found' }
  | { status: 'profile_not_found' }
  | { status: 'ok'; response: StartAttemptResponse; attemptId: string };

// Todas las lecturas antes de cualquier escritura (requisito de Firestore).
export function startAttemptTx(
  db: Firestore,
  input: StartAttemptInput,
): Promise<StartAttemptOutcome> {
  const { uid, missionId } = input;
  const nowIso = input.now.toISOString();
  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(db.doc(`users/${uid}`));
    if (!userSnap.exists) return { status: 'profile_not_found' } as const;

    const missionSnap = await tx.get(db.doc(`missions/${missionId}`));
    if (!missionSnap.exists) return { status: 'mission_not_found' } as const;

    const progressRef = db.doc(`progress/${uid}/missions/${missionId}`);
    const progressSnap = await tx.get(progressRef);
    const progress = progressSnap.exists ? (progressSnap.data() as MissionProgressDoc) : null;
    const alreadySealed = progress?.sealed === true || progress?.completed === true;

    // Un intento abierto no sobrevive a empezar otro (recarga, otra pestaña, volver atrás).
    // Solo se lee aquí; la escritura va al final, después de todas las lecturas.
    const openAttemptId = progress?.openAttemptId ?? null;
    let abandonOpen = false;
    if (openAttemptId) {
      const openSnap = await tx.get(db.doc(`progress/${uid}/attempts/${openAttemptId}`));
      abandonOpen = openSnap.exists && openSnap.get('status') === 'open';
    }

    const questionIds = (missionSnap.get('questionIds') as string[] | undefined) ?? [];
    if (questionIds.length === 0) return { status: 'mission_not_found' } as const;

    const questionSnaps = await tx.getAll(...questionIds.map((id) => db.doc(`questions/${id}`)));
    const questions: Array<QuestionDoc & { id: string }> = questionSnaps
      .filter((s) => s.exists && (input.allowDrafts || s.data()?.status === 'validated'))
      .map((s) => ({ id: s.id, ...(s.data() as QuestionDoc) }));

    if (questions.length === 0) return { status: 'mission_not_found' } as const;

    // Barajar preguntas y opciones: el mismo examen nunca se ve igual dos veces.
    const shuffledQuestions = shuffle(questions).map((q) => ({
      ...q,
      options: shuffle(q.options),
    }));

    const attemptRef = db.collection(`progress/${uid}/attempts`).doc();
    const doc: AttemptDoc = {
      uid,
      missionId,
      questionIds: shuffledQuestions.map((q) => q.id),
      answeredQuestionIds: [],
      correctQuestionIds: [],
      status: 'open',
      wasAlreadySealed: alreadySealed,
      startedAt: nowIso,
      finishedAt: null,
    };

    const responseQuestions: AttemptQuestion[] = shuffledQuestions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      explanation: q.explanation,
      source: q.source,
      status: q.status,
    }));

    tx.set(attemptRef, doc);
    tx.set(progressRef, { openAttemptId: attemptRef.id }, { merge: true });
    if (abandonOpen && openAttemptId) {
      tx.update(db.doc(`progress/${uid}/attempts/${openAttemptId}`), {
        status: 'abandoned',
        finishedAt: nowIso,
      });
    }

    return {
      status: 'ok',
      attemptId: attemptRef.id,
      response: {
        attemptId: attemptRef.id,
        missionId,
        questions: responseQuestions,
        alreadySealed,
      },
    } as const;
  });
}

export type AnswerInput = {
  uid: string;
  attemptId: string;
  questionId: string;
  selectedOptionIds: string[];
  allowDrafts: boolean;
  now: Date;
};

export type AnswerOutcome =
  | { status: 'attempt_not_found' }
  | { status: 'question_not_in_attempt' }
  | { status: 'already_answered' }
  | { status: 'attempt_closed' }
  | { status: 'question_not_found' }
  | { status: 'profile_not_found' }
  | { status: 'ok'; response: AnswerResponse };

// Todas las lecturas antes de cualquier escritura (requisito de las transacciones de Firestore).
export function submitAnswerTx(db: Firestore, input: AnswerInput): Promise<AnswerOutcome> {
  const { uid, questionId } = input;
  const nowIso = input.now.toISOString();
  return db.runTransaction(async (tx) => {
    const attemptRef = db.doc(`progress/${uid}/attempts/${input.attemptId}`);
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists) return { status: 'attempt_not_found' } as const;
    const attempt = attemptSnap.data() as AttemptDoc;

    if (attempt.status !== 'open') return { status: 'attempt_closed' } as const;
    if (!attempt.questionIds.includes(questionId))
      return { status: 'question_not_in_attempt' } as const;
    if (attempt.answeredQuestionIds.includes(questionId))
      return { status: 'already_answered' } as const;

    const userRef = db.doc(`users/${uid}`);
    const answerSnaps = await tx.getAll(
      db.doc(`questions/${questionId}`),
      db.doc(`questionKeys/${questionId}`),
      userRef,
    );
    const questionSnap = answerSnaps[0];
    const keySnap = answerSnaps[1];
    const userSnap = answerSnaps[2];
    const question = questionSnap?.exists ? (questionSnap.data() as QuestionDoc) : null;
    if (!question || (question.status === 'draft' && !input.allowDrafts)) {
      return { status: 'question_not_found' } as const;
    }
    if (!userSnap?.exists) return { status: 'profile_not_found' } as const;
    const user = userSnap.data() as UserDoc;

    const correctOptionIds = (keySnap?.get('correctOptionIds') as string[] | undefined) ?? [];
    const correct =
      correctOptionIds.length > 0 && sameSet(input.selectedOptionIds, correctOptionIds);

    // Un solo disparo por pregunta: se guarda la respuesta y no se puede cambiar.
    tx.update(attemptRef, {
      answeredQuestionIds: [...attempt.answeredQuestionIds, questionId],
      correctQuestionIds: correct
        ? [...attempt.correctQuestionIds, questionId]
        : attempt.correctQuestionIds,
    });

    // El XP se paga al aprobar la misión; aquí solo se mueve la racha de días.
    let streakDays = user.streakDays;
    if (correct) {
      const today = bogotaDate(input.now);
      streakDays = nextStreak(user, today);
      if (user.streakDays !== streakDays || user.lastActiveDate !== today) {
        tx.update(userRef, { streakDays, lastActiveDate: today, updatedAt: nowIso });
      }
    }

    return {
      status: 'ok',
      response: {
        correct,
        correctOptionIds,
        explanation: question.explanation,
        source: question.source,
        streakDays,
      },
    } as const;
  });
}

export type FinishAttemptInput = {
  uid: string;
  attemptId: string;
  now: Date;
};

export type FinishAttemptOutcome =
  | { status: 'attempt_not_found' }
  | { status: 'attempt_closed' }
  | { status: 'profile_not_found' }
  | { status: 'ok'; response: FinishAttemptResponse };

export function finishAttemptTx(
  db: Firestore,
  input: FinishAttemptInput,
): Promise<FinishAttemptOutcome> {
  const { uid } = input;
  const nowIso = input.now.toISOString();
  return db.runTransaction(async (tx) => {
    const attemptRef = db.doc(`progress/${uid}/attempts/${input.attemptId}`);
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists) return { status: 'attempt_not_found' } as const;
    const attempt = attemptSnap.data() as AttemptDoc;
    if (attempt.status !== 'open') return { status: 'attempt_closed' } as const;

    const userRef = db.doc(`users/${uid}`);
    const progressRef = db.doc(`progress/${uid}/missions/${attempt.missionId}`);
    const finishSnaps = await tx.getAll(
      userRef,
      db.doc(`missions/${attempt.missionId}`),
      progressRef,
    );
    const userSnap = finishSnaps[0];
    const missionSnap = finishSnaps[1];
    const progressSnap = finishSnaps[2];
    if (!userSnap?.exists) return { status: 'profile_not_found' } as const;
    const user = userSnap.data() as UserDoc;

    const prev: MissionProgressDoc | null = progressSnap?.exists
      ? (progressSnap.data() as MissionProgressDoc)
      : null;
    // Si otra pestaña selló la misión mientras este intento estaba abierto, esto es un repaso.
    const wasSealed = attempt.wasAlreadySealed || prev?.sealed === true || prev?.completed === true;

    const correctCount = attempt.correctQuestionIds.length;
    const totalCount = attempt.questionIds.length;
    const answeredCount = attempt.answeredQuestionIds.length;
    const reward = missionSnap?.get('xpReward');
    const award = missionXpAward({
      correct: correctCount,
      total: totalCount,
      answered: answeredCount,
      missionXp: typeof reward === 'number' ? reward : 0,
      isRepeat: wasSealed,
    });

    // Preguntas falladas, con sus opciones para poder mostrar la respuesta correcta.
    const failedIds = attempt.questionIds.filter(
      (id) => attempt.answeredQuestionIds.includes(id) && !attempt.correctQuestionIds.includes(id),
    );
    const [failedSnaps, failedKeySnaps] =
      failedIds.length > 0
        ? [
            await tx.getAll(...failedIds.map((id) => db.doc(`questions/${id}`))),
            await tx.getAll(...failedIds.map((id) => db.doc(`questionKeys/${id}`))),
          ]
        : [[], []];
    const failedQuestions: FailedQuestionSummary[] = failedSnaps
      .map((snap, i) => {
        if (!snap.exists) return null;
        const q = snap.data() as QuestionDoc;
        const keyIds = (failedKeySnaps[i]?.get('correctOptionIds') as string[] | undefined) ?? [];
        return {
          id: snap.id,
          prompt: q.prompt,
          options: q.options,
          correctOptionIds: keyIds,
          source: q.source,
        };
      })
      .filter((x): x is FailedQuestionSummary => x !== null);

    const nowSealed = !wasSealed && award.passed;
    const sealed = wasSealed || nowSealed;
    const sealedAt = nowSealed ? nowIso : (prev?.sealedAt ?? prev?.completedAt ?? null);
    // Un intento abandonado no deja récord: salir a mitad de camino no cuenta.
    const stars = Math.max(prev?.stars ?? 0, award.stars);
    const bestCorrect = Math.max(prev?.bestCorrect ?? 0, award.abandoned ? 0 : correctCount);
    const answeredCorrectIds = [
      ...new Set([...(prev?.answeredCorrectIds ?? []), ...attempt.correctQuestionIds]),
    ];

    const finalXp = user.xp + award.totalXp;
    const finalLevel = levelForXp(finalXp);

    tx.set(
      progressRef,
      {
        answeredCorrectIds,
        sealed,
        sealedAt,
        stars,
        bestCorrect,
        completed: sealed,
        completedAt: sealedAt,
        openAttemptId: null,
      },
      { merge: true },
    );

    if (award.totalXp > 0) {
      tx.update(userRef, { xp: finalXp, level: finalLevel, updatedAt: nowIso });
      tx.set(
        db.doc(`leaderboard/${uid}`),
        leaderboardEntry({ ...user, xp: finalXp, level: finalLevel, updatedAt: nowIso }),
      );
    }

    tx.update(attemptRef, {
      status: award.abandoned ? 'abandoned' : 'finished',
      finishedAt: nowIso,
    });

    return {
      status: 'ok',
      response: {
        correct: correctCount,
        total: totalCount,
        answered: answeredCount,
        abandoned: award.abandoned,
        passed: award.passed,
        stars: award.stars,
        bestCorrect,
        xpAwarded: award.totalXp,
        bonusXp: award.bonusXp,
        missionSealed: sealed,
        alreadySealed: wasSealed,
        failedQuestions,
        totalXp: finalXp,
        level: finalLevel,
        streakDays: user.streakDays,
      },
    } as const;
  });
}

// ---------- Práctica guiada ----------

export type PracticeInput = { uid: string; stepIds: readonly string[]; now: Date };
export type PracticeOutcome =
  | { status: 'ok'; response: PracticeCompleteResponse }
  | { status: 'profile_not_found' };

/**
 * Registra una práctica guiada completa. Las imágenes nunca salen del navegador, así que el servidor
 * solo confía en que el cliente validó los pasos; por eso el premio es pequeño y se limita a una vez
 * por día de Bogotá (`progress/{uid}/practice/{YYYY-MM-DD}`). Cuenta como actividad para la racha.
 */
export function completePracticeTx(db: Firestore, input: PracticeInput): Promise<PracticeOutcome> {
  const { uid } = input;
  return db.runTransaction(async (tx) => {
    const today = bogotaDate(input.now);
    const userRef = db.doc(`users/${uid}`);
    const practiceRef = db.doc(`progress/${uid}/practice/${today}`);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return { status: 'profile_not_found' } as const;
    const user = userSnap.data() as UserDoc;
    const practiceSnap = await tx.get(practiceRef);
    if (practiceSnap.exists) {
      return {
        status: 'ok',
        response: {
          xpAwarded: 0,
          alreadyCompletedToday: true,
          totalXp: user.xp,
          level: user.level,
          streakDays: user.streakDays,
        },
      } as const;
    }
    const nowIso = input.now.toISOString();
    const xp = user.xp + PRACTICE_XP;
    const next: UserDoc = {
      ...user,
      xp,
      level: levelForXp(xp),
      streakDays: nextStreak(user, today),
      lastActiveDate: today,
      updatedAt: nowIso,
    };
    tx.create(practiceRef, {
      protocol: 'donning',
      stepIds: [...input.stepIds],
      xpAwarded: PRACTICE_XP,
      createdAt: nowIso,
    });
    tx.update(userRef, {
      xp: next.xp,
      level: next.level,
      streakDays: next.streakDays,
      lastActiveDate: next.lastActiveDate,
      updatedAt: nowIso,
    });
    tx.set(db.doc(`leaderboard/${uid}`), leaderboardEntry(next));
    return {
      status: 'ok',
      response: {
        xpAwarded: PRACTICE_XP,
        alreadyCompletedToday: false,
        totalXp: next.xp,
        level: next.level,
        streakDays: next.streakDays,
      },
    } as const;
  });
}

// ---------- Administración ----------

const ADMIN_QUESTIONS_LIMIT = 200;

export async function listQuestionsWithKeys(db: Firestore): Promise<AdminQuestion[]> {
  const snap = await db.collection('questions').limit(ADMIN_QUESTIONS_LIMIT).get();
  const keyRefs = snap.docs.map((d) => db.doc(`questionKeys/${d.id}`));
  const keys = keyRefs.length > 0 ? await db.getAll(...keyRefs) : [];
  return snap.docs
    .map((d, i) => ({
      id: d.id,
      ...(d.data() as QuestionDoc),
      correctOptionIds: (keys[i]?.get('correctOptionIds') as string[] | undefined) ?? [],
    }))
    .sort((a, b) => a.missionId.localeCompare(b.missionId) || a.id.localeCompare(b.id));
}

export type SaveQuestionOutcome =
  | { status: 'mission_not_found' }
  | { status: 'question_not_found' }
  | { status: 'ok'; question: AdminQuestion };

// Crea (id = null) o reemplaza una pregunta y su clave; siempre queda en `draft` y la misión
// mantiene su lista `questionIds` al día.
export function saveQuestionTx(
  db: Firestore,
  input: { id: string | null; question: QuestionInput; uid: string },
): Promise<SaveQuestionOutcome> {
  return db.runTransaction(async (tx) => {
    const { correctOptionIds, ...body } = input.question;
    const ref = input.id ? db.doc(`questions/${input.id}`) : db.collection('questions').doc();
    const missionSnap = await tx.get(db.doc(`missions/${body.missionId}`));
    if (!missionSnap.exists) return { status: 'mission_not_found' } as const;
    let createdBy = input.uid;
    let previousMissionId: string | null = null;
    if (input.id) {
      const snap = await tx.get(ref);
      if (!snap.exists) return { status: 'question_not_found' } as const;
      const prev = snap.data() as QuestionDoc;
      createdBy = prev.createdBy;
      previousMissionId = prev.missionId;
    }
    const doc: QuestionDoc = {
      ...body,
      status: 'draft',
      createdBy,
      validatedBy: null,
      validatedAt: null,
    };
    tx.set(ref, doc);
    tx.set(db.doc(`questionKeys/${ref.id}`), { correctOptionIds });
    if (previousMissionId !== body.missionId) {
      if (previousMissionId) {
        tx.update(db.doc(`missions/${previousMissionId}`), {
          questionIds: FieldValue.arrayRemove(ref.id),
        });
      }
      tx.update(missionSnap.ref, { questionIds: FieldValue.arrayUnion(ref.id) });
    }
    return { status: 'ok', question: { id: ref.id, ...doc, correctOptionIds } } as const;
  });
}

export function validateQuestionTx(
  db: Firestore,
  input: { id: string; uid: string; now: string },
): Promise<QuestionDoc | null> {
  const ref = db.doc(`questions/${input.id}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const update = { status: 'validated', validatedBy: input.uid, validatedAt: input.now } as const;
    tx.update(ref, update);
    return { ...(snap.data() as QuestionDoc), ...update };
  });
}

export async function groupExists(db: Firestore, groupId: string): Promise<boolean> {
  return (await db.doc(`groups/${groupId}`).get()).exists;
}

export async function groupProgress(db: Firestore, groupId: string): Promise<MemberProgress[]> {
  const members = await db.collection('users').where('groupId', '==', groupId).get();
  const rows = await Promise.all(
    members.docs.map(async (d) => {
      const user = d.data() as UserDoc;
      const completed = await db
        .collection(`progress/${d.id}/missions`)
        .where('completed', '==', true)
        .count()
        .get();
      return {
        uid: d.id,
        displayName: user.displayName,
        xp: user.xp,
        level: user.level,
        streakDays: user.streakDays,
        completedMissions: completed.data().count,
      };
    }),
  );
  return rows.sort((a, b) => b.xp - a.xp || a.displayName.localeCompare(b.displayName));
}
