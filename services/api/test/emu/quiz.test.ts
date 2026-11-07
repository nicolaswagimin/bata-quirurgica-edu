import { readFile } from 'node:fs/promises';
import {
  levelForXp,
  minCorrectToPass,
  PERFECT_BONUS_XP,
  PRACTICE_XP,
} from '@bata/shared/gamification';
import {
  type AttemptQuestion,
  DONNING_STEP_IDS,
  type FinishAttemptResponse,
  POLICY_VERSION,
  type SeedFile,
  type StartAttemptResponse,
} from '@bata/shared/schemas';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { Firestore } from 'firebase-admin/firestore';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SEED_FILE, seedContent } from '../../scripts/seed.ts';
import { me, quiz } from '../../src/handlers/entry.ts';
import { getDb } from '../../src/lib/identity.ts';
import { handleQuiz } from '../../src/routes/quiz.ts';

const FIRESTORE_RESET =
  'http://127.0.0.1:8080/emulator/v1/projects/demo-bata/databases/(default)/documents';
const AUTH_RESET = 'http://127.0.0.1:9099/emulator/v1/projects/demo-bata/accounts';

const UID = 'u_quiz';
const MISSION = 'm1-fundamentos';

let db: Firestore;
let seed: SeedFile;

function event(method: string, path: string, body?: unknown): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    body: body === undefined ? null : JSON.stringify(body),
    requestContext: { authorizer: { uid: UID, role: 'student', groupId: '' } },
  } as unknown as APIGatewayProxyEvent;
}

function correctIds(questionId: string): string[] {
  const q = seed.questions.find((x) => x.id === questionId);
  if (!q) throw new Error(`Missing seed question ${questionId}`);
  return q.correctOptionIds;
}

function wrongIds(questionId: string): string[] {
  const q = seed.questions.find((x) => x.id === questionId);
  const wrong = q?.options.find((o) => !q.correctOptionIds.includes(o.id));
  if (!wrong) throw new Error(`No wrong option for ${questionId}`);
  return [wrong.id];
}

function missionXp(): number {
  const mission = seed.missions.find((m) => m.id === MISSION);
  if (!mission) throw new Error(`Missing seed mission ${MISSION}`);
  return mission.xpReward;
}

function at(iso: string) {
  return { now: () => new Date(iso) };
}

async function createProfile(): Promise<void> {
  const res = await me(
    event('POST', '/me', {
      displayName: 'Laura Gómez',
      consent: { policyVersion: POLICY_VERSION, accepted: true },
    }),
  );
  expect(res.statusCode).toBe(201);
}

/** Abre un intento para la misión m1 y lo devuelve. */
async function startAttempt(
  missionId = MISSION,
): Promise<{ attemptId: string; response: StartAttemptResponse }> {
  const res = await quiz(event('POST', '/quiz/attempt', { missionId }));
  expect(res.statusCode).toBe(201);
  const response = JSON.parse(res.body) as StartAttemptResponse;
  return { attemptId: response.attemptId, response };
}

/** Responde una pregunta dentro de un intento (200 esperado). */
async function answerQuestion(
  attemptId: string,
  questionId: string,
  selectedOptionIds: string[],
  deps = at('2026-10-05T12:00:00Z'),
): Promise<{ correct: boolean; streakDays: number }> {
  const res = await handleQuiz(
    event('POST', '/quiz/answer', { attemptId, questionId, selectedOptionIds }),
    deps,
  );
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body) as { correct: boolean; streakDays: number };
}

/** Responde las primeras `correctCount` preguntas bien y el resto mal. */
async function answerAll(
  attemptId: string,
  questions: AttemptQuestion[],
  correctCount: number,
): Promise<void> {
  for (const [i, q] of questions.entries()) {
    await answerQuestion(attemptId, q.id, i < correctCount ? correctIds(q.id) : wrongIds(q.id));
  }
}

/** Finaliza un intento y devuelve la respuesta. */
async function finishAttempt(
  attemptId: string,
  deps = at('2026-10-05T12:00:00Z'),
): Promise<FinishAttemptResponse> {
  const res = await handleQuiz(event('POST', '/quiz/finish', { attemptId }), deps);
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body) as FinishAttemptResponse;
}

async function userXp(): Promise<number> {
  return ((await db.doc(`users/${UID}`).get()).get('xp') as number | undefined) ?? 0;
}

beforeAll(async () => {
  db = await getDb();
  seed = JSON.parse(await readFile(DEFAULT_SEED_FILE, 'utf8')) as SeedFile;
});

beforeEach(async () => {
  await Promise.all([
    fetch(FIRESTORE_RESET, { method: 'DELETE' }),
    fetch(AUTH_RESET, { method: 'DELETE' }),
  ]);
  await seedContent(db, DEFAULT_SEED_FILE);
});

afterEach(() => {
  process.env.SHOW_DRAFT_QUESTIONS = 'true';
});

describe('seedContent', () => {
  it('is idempotent and loads every question as draft with its key', async () => {
    await seedContent(db, DEFAULT_SEED_FILE);
    const [missions, questions, keys, flags] = await Promise.all([
      db.collection('missions').get(),
      db.collection('questions').get(),
      db.collection('questionKeys').get(),
      db.doc('appConfig/flags').get(),
    ]);
    expect(missions.size).toBe(seed.missions.length);
    expect(questions.size).toBe(seed.questions.length);
    expect(keys.size).toBe(seed.questions.length);
    expect(questions.docs.every((d) => d.get('status') === 'draft')).toBe(true);
    expect(questions.docs.every((d) => d.get('correctOptionIds') === undefined)).toBe(true);
    expect(flags.get('showDraftQuestions')).toBe(true);
    const m1 = (await db.doc(`missions/${MISSION}`).get()).get('questionIds') as string[];
    expect(m1).toEqual(seed.questions.filter((q) => q.missionId === MISSION).map((q) => q.id));
  });
});

describe('POST /quiz/attempt', () => {
  it('crea un intento y devuelve preguntas barajadas sin claves', async () => {
    await createProfile();
    const res = await quiz(event('POST', '/quiz/attempt', { missionId: MISSION }));
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as StartAttemptResponse;
    expect(body.attemptId).toBeTruthy();
    expect(body.missionId).toBe(MISSION);
    expect(body.questions.length).toBeGreaterThan(0);
    expect(body.alreadySealed).toBe(false);
    // Las claves nunca se exponen al cliente.
    expect(res.body).not.toContain('correctOptionIds');
    for (const q of body.questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.id).toBeTruthy();
      // El XP es de la misión, no de cada pregunta.
      expect('xp' in q).toBe(false);
    }
  });

  it('abandona el intento abierto anterior al empezar otro', async () => {
    await createProfile();
    const first = await startAttempt();
    const question = first.response.questions[0];
    if (!question) throw new Error('Sin preguntas');
    await startAttempt();
    // El intento anterior quedó cerrado: ya no acepta respuestas.
    const res = await quiz(
      event('POST', '/quiz/answer', {
        attemptId: first.attemptId,
        questionId: question.id,
        selectedOptionIds: correctIds(question.id),
      }),
    );
    expect(res.statusCode).toBe(409);
  });

  it('falla 404 sin perfil', async () => {
    const res = await quiz(event('POST', '/quiz/attempt', { missionId: MISSION }));
    expect(res.statusCode).toBe(404);
  });

  it('falla 404 con misión inexistente', async () => {
    await createProfile();
    const res = await quiz(event('POST', '/quiz/attempt', { missionId: 'no-existe' }));
    expect(res.statusCode).toBe(404);
  });

  it('falla 422 con cuerpo inválido', async () => {
    await createProfile();
    const res = await quiz(event('POST', '/quiz/attempt', {}));
    expect(res.statusCode).toBe(422);
  });
});

describe('POST /quiz/answer', () => {
  it('corrige la respuesta y expone correctOptionIds, sin pagar XP', async () => {
    await createProfile();
    const { attemptId, response } = await startAttempt();
    const q = response.questions[0];
    if (!q) throw new Error('Sin preguntas');
    const res = await handleQuiz(
      event('POST', '/quiz/answer', {
        attemptId,
        questionId: q.id,
        selectedOptionIds: correctIds(q.id),
      }),
      at('2026-10-05T12:00:00Z'),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.correct).toBe(true);
    expect(Array.isArray(body.correctOptionIds)).toBe(true);
    expect(body.streakDays).toBe(1);
    expect(body.xpAwarded).toBeUndefined();
    expect(await userXp()).toBe(0);
  });

  it('rechaza responder la misma pregunta dos veces en el mismo intento (CONFLICT)', async () => {
    await createProfile();
    const { attemptId, response } = await startAttempt();
    const q = response.questions[0];
    if (!q) throw new Error('Sin preguntas');
    await answerQuestion(attemptId, q.id, correctIds(q.id));
    const res2 = await quiz(
      event('POST', '/quiz/answer', {
        attemptId,
        questionId: q.id,
        selectedOptionIds: correctIds(q.id),
      }),
    );
    expect(res2.statusCode).toBe(409);
    expect(JSON.parse(res2.body)).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('rechaza preguntas que no pertenecen al intento (NOT_FOUND)', async () => {
    await createProfile();
    const { attemptId } = await startAttempt();
    const res = await quiz(
      event('POST', '/quiz/answer', {
        attemptId,
        questionId: 'q-inexistente',
        selectedOptionIds: ['a'],
      }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('rechaza un intento inexistente (NOT_FOUND)', async () => {
    await createProfile();
    const res = await quiz(
      event('POST', '/quiz/answer', {
        attemptId: 'intento-falso',
        questionId: 'q01',
        selectedOptionIds: ['a'],
      }),
    );
    expect(res.statusCode).toBe(404);
  });

  it('falla 422 con cuerpo inválido (sin attemptId)', async () => {
    await createProfile();
    const res = await quiz(
      event('POST', '/quiz/answer', { questionId: 'q01', selectedOptionIds: ['a'] }),
    );
    expect(res.statusCode).toBe(422);
  });

  it('nunca filtra la clave de respuesta en las preguntas del intento', async () => {
    await createProfile();
    const { response } = await startAttempt();
    expect(response.questions.some((q) => 'correctOptionIds' in q)).toBe(false);
  });

  it('rastrea la racha en días de Bogotá', async () => {
    await createProfile();

    // Día 1 (04:30Z = 23:30 Bogotá del día anterior).
    const a1 = await startAttempt();
    const q1 = a1.response.questions[0];
    if (!q1) throw new Error('Sin preguntas');
    const r1 = await handleQuiz(
      event('POST', '/quiz/answer', {
        attemptId: a1.attemptId,
        questionId: q1.id,
        selectedOptionIds: correctIds(q1.id),
      }),
      at('2026-10-05T04:30:00Z'),
    );
    expect(JSON.parse(r1.body)).toMatchObject({ streakDays: 1 });

    // Mismo día Bogotá.
    const a2 = await startAttempt();
    const q2 = a2.response.questions.find((q) => q.id !== q1.id);
    if (!q2) throw new Error('Sin preguntas distintas');
    const r2 = await handleQuiz(
      event('POST', '/quiz/answer', {
        attemptId: a2.attemptId,
        questionId: q2.id,
        selectedOptionIds: correctIds(q2.id),
      }),
      at('2026-10-04T12:00:00Z'),
    );
    expect(JSON.parse(r2.body)).toMatchObject({ streakDays: 1 });

    // Día 2.
    const a3 = await startAttempt();
    const remaining = a3.response.questions.find((q) => q.id !== q1.id && q.id !== q2.id);
    if (!remaining) throw new Error('Sin preguntas distintas');
    const r3 = await handleQuiz(
      event('POST', '/quiz/answer', {
        attemptId: a3.attemptId,
        questionId: remaining.id,
        selectedOptionIds: correctIds(remaining.id),
      }),
      at('2026-10-05T15:00:00Z'),
    );
    expect(JSON.parse(r3.body)).toMatchObject({ streakDays: 2 });
  });
});

describe('POST /quiz/finish', () => {
  it('aprueba con todo correcto: sella, da 3 estrellas y paga misión + bono', async () => {
    await createProfile();
    const { attemptId, response } = await startAttempt();
    await answerAll(attemptId, response.questions, response.questions.length);

    const result = await finishAttempt(attemptId);
    expect(result).toMatchObject({
      correct: response.questions.length,
      total: response.questions.length,
      answered: response.questions.length,
      abandoned: false,
      passed: true,
      stars: 3,
      missionSealed: true,
      alreadySealed: false,
      bonusXp: PERFECT_BONUS_XP,
      xpAwarded: missionXp() + PERFECT_BONUS_XP,
    });
    expect(result.failedQuestions).toHaveLength(0);
    expect(await userXp()).toBe(missionXp() + PERFECT_BONUS_XP);
    expect((await db.doc(`leaderboard/${UID}`).get()).get('xp')).toBe(
      missionXp() + PERFECT_BONUS_XP,
    );

    const progress = await db.doc(`progress/${UID}/missions/${MISSION}`).get();
    expect(progress.data()).toMatchObject({
      sealed: true,
      stars: 3,
      bestCorrect: response.questions.length,
      completed: true,
    });
  });

  it('aprueba con 4 de 6: sella con 1 estrella, sin bono', async () => {
    await createProfile();
    const { attemptId, response } = await startAttempt();
    await answerAll(attemptId, response.questions, 4);

    const result = await finishAttempt(attemptId);
    expect(result).toMatchObject({
      correct: 4,
      passed: true,
      stars: 1,
      bonusXp: 0,
      xpAwarded: missionXp(),
      missionSealed: true,
    });
    expect(result.failedQuestions).toHaveLength(2);
    expect(result.failedQuestions.every((q) => q.options.length >= 2)).toBe(true);
    expect(result.failedQuestions.every((q) => q.correctOptionIds.length >= 1)).toBe(true);
    expect(await userXp()).toBe(missionXp());
  });

  it('no aprueba ni paga XP por debajo del mínimo', async () => {
    await createProfile();
    const { attemptId, response } = await startAttempt();
    const failing = minCorrectToPass(response.questions.length) - 1;
    await answerAll(attemptId, response.questions, failing);

    const result = await finishAttempt(attemptId);
    expect(result).toMatchObject({
      correct: failing,
      passed: false,
      stars: 0,
      xpAwarded: 0,
      bonusXp: 0,
      missionSealed: false,
    });
    expect(result.failedQuestions.length).toBeGreaterThan(0);
    expect(await userXp()).toBe(0);
    expect((await db.doc(`progress/${UID}/missions/${MISSION}`).get()).exists).toBe(true);
    expect((await db.doc(`progress/${UID}/missions/${MISSION}`).get()).get('sealed')).toBe(false);
  });

  it('un intento abandonado no cuenta ni deja récord', async () => {
    await createProfile();
    const { attemptId, response } = await startAttempt();
    const first = response.questions[0];
    if (!first) throw new Error('Sin preguntas');
    await answerQuestion(attemptId, first.id, correctIds(first.id));

    const result = await finishAttempt(attemptId);
    expect(result).toMatchObject({
      answered: 1,
      abandoned: true,
      passed: false,
      stars: 0,
      xpAwarded: 0,
      missionSealed: false,
      bestCorrect: 0,
    });
    expect(await userXp()).toBe(0);
    expect((await db.doc(`progress/${UID}/missions/${MISSION}`).get()).get('bestCorrect')).toBe(0);
  });

  it('repetir una misión sellada no da XP, aunque sea perfecta', async () => {
    await createProfile();

    const a1 = await startAttempt();
    await answerAll(a1.attemptId, a1.response.questions, a1.response.questions.length);
    const r1 = await finishAttempt(a1.attemptId);
    const xpAfterFirst = r1.totalXp;
    expect(r1.missionSealed).toBe(true);

    const a2 = await startAttempt();
    expect(a2.response.alreadySealed).toBe(true);
    await answerAll(a2.attemptId, a2.response.questions, a2.response.questions.length);
    const r2 = await finishAttempt(a2.attemptId);
    expect(r2).toMatchObject({
      alreadySealed: true,
      passed: true,
      stars: 3,
      xpAwarded: 0,
      bonusXp: 0,
      totalXp: xpAfterFirst,
    });
    expect(await userXp()).toBe(xpAfterFirst);
  });

  it('el repaso mejora el récord de estrellas sin pagar XP', async () => {
    await createProfile();

    const a1 = await startAttempt();
    await answerAll(a1.attemptId, a1.response.questions, 4);
    await finishAttempt(a1.attemptId);
    expect((await db.doc(`progress/${UID}/missions/${MISSION}`).get()).get('stars')).toBe(1);

    const a2 = await startAttempt();
    await answerAll(a2.attemptId, a2.response.questions, a2.response.questions.length);
    const r2 = await finishAttempt(a2.attemptId);
    expect(r2.stars).toBe(3);
    expect(r2.xpAwarded).toBe(0);
    expect((await db.doc(`progress/${UID}/missions/${MISSION}`).get()).data()).toMatchObject({
      sealed: true,
      stars: 3,
      bestCorrect: a2.response.questions.length,
    });
  });

  it('no paga XP si la misión se selló en otra pestaña durante el intento', async () => {
    await createProfile();
    const { attemptId, response } = await startAttempt();
    await answerAll(attemptId, response.questions, response.questions.length);
    // Otra pestaña sella la misión antes de que este intento cierre.
    await db.doc(`progress/${UID}/missions/${MISSION}`).set(
      {
        answeredCorrectIds: [],
        sealed: true,
        sealedAt: '2026-10-05T11:00:00Z',
        stars: 3,
        bestCorrect: response.questions.length,
        completed: true,
      },
      { merge: true },
    );

    const result = await finishAttempt(attemptId);
    expect(result).toMatchObject({ passed: true, missionSealed: true, xpAwarded: 0, bonusXp: 0 });
    expect(await userXp()).toBe(0);
  });

  it('rechaza cerrar un intento ya cerrado (CONFLICT)', async () => {
    await createProfile();
    const { attemptId } = await startAttempt();
    await finishAttempt(attemptId);
    const res = await quiz(event('POST', '/quiz/finish', { attemptId }));
    expect(res.statusCode).toBe(409);
  });

  it('falla 404 con intento inexistente', async () => {
    await createProfile();
    const res = await quiz(event('POST', '/quiz/finish', { attemptId: 'intento-falso' }));
    expect(res.statusCode).toBe(404);
  });

  it('falla 422 con cuerpo inválido', async () => {
    await createProfile();
    const res = await quiz(event('POST', '/quiz/finish', {}));
    expect(res.statusCode).toBe(422);
  });
});

describe('POST /quiz/practice', () => {
  const body = { protocol: 'donning', stepIds: [...DONNING_STEP_IDS] };
  const practice = () => event('POST', '/quiz/practice', body);

  it('awards practice XP once per Bogotá day and counts it for the streak', async () => {
    await createProfile();
    const first = await handleQuiz(practice(), at('2026-11-02T15:00:00Z'));
    expect(first.statusCode).toBe(200);
    expect(JSON.parse(first.body)).toEqual({
      xpAwarded: PRACTICE_XP,
      alreadyCompletedToday: false,
      totalXp: PRACTICE_XP,
      level: levelForXp(PRACTICE_XP),
      streakDays: 1,
    });

    // 23:30 en Bogotá es el mismo día (04:30 UTC del día siguiente).
    const again = await handleQuiz(practice(), at('2026-11-03T04:30:00Z'));
    expect(JSON.parse(again.body)).toMatchObject({
      xpAwarded: 0,
      alreadyCompletedToday: true,
      totalXp: PRACTICE_XP,
    });

    const nextDay = await handleQuiz(practice(), at('2026-11-03T15:00:00Z'));
    expect(JSON.parse(nextDay.body)).toMatchObject({
      xpAwarded: PRACTICE_XP,
      totalXp: PRACTICE_XP * 2,
      streakDays: 2,
    });
    expect((await db.doc(`leaderboard/${UID}`).get()).data()).toMatchObject({
      xp: PRACTICE_XP * 2,
    });
    const records = await db.collection(`progress/${UID}/practice`).get();
    expect(records.docs.map((d) => d.id).sort()).toEqual(['2026-11-02', '2026-11-03']);
  });

  it('rejects incomplete or reordered steps and requires a profile', async () => {
    const missing = await quiz(practice());
    expect(missing.statusCode).toBe(404);
    await createProfile();
    const reordered = await quiz(
      event('POST', '/quiz/practice', { ...body, stepIds: [...DONNING_STEP_IDS].reverse() }),
    );
    expect(reordered.statusCode).toBe(422);
    expect(JSON.parse(reordered.body)).toMatchObject({ error: { code: expect.any(String) } });
    expect(reordered.headers?.['Access-Control-Allow-Origin']).toBeDefined();
  });
});
