import { readFile } from 'node:fs/promises';
import { levelForXp } from '@bata/shared/gamification';
import { POLICY_VERSION, type SeedFile } from '@bata/shared/schemas';
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

function answer(questionId: string, selectedOptionIds: string[]) {
  return event('POST', '/quiz/answer', { questionId, selectedOptionIds });
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
    const m1 = (await db.doc('missions/m1-fundamentos').get()).get('questionIds') as string[];
    expect(m1).toEqual(
      seed.questions.filter((q) => q.missionId === 'm1-fundamentos').map((q) => q.id),
    );
  });
});

describe('POST /quiz/answer', () => {
  it('awards XP on the first correct answer and updates the leaderboard', async () => {
    await createProfile();
    const res = await quiz(answer('q01', correctIds('q01')));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      correct: true,
      xpAwarded: 10,
      totalXp: 10,
      level: levelForXp(10),
      streakDays: 1,
    });
    expect(typeof body.explanation).toBe('string');
    expect(body.source).toMatchObject({ org: expect.any(String) });
    expect(res.body).not.toContain('correctOptionIds');

    const attempts = await db.collection(`progress/${UID}/attempts`).get();
    expect(attempts.size).toBe(1);
    expect(attempts.docs[0]?.data()).toMatchObject({ questionId: 'q01', correct: true });
    expect((await db.doc(`leaderboard/${UID}`).get()).data()).toMatchObject({ xp: 10 });
    expect((await db.doc(`progress/${UID}/missions/m1-fundamentos`).get()).data()).toMatchObject({
      answeredCorrectIds: ['q01'],
      completed: false,
    });
  });

  it('does not award XP twice for the same question', async () => {
    await createProfile();
    await quiz(answer('q01', correctIds('q01')));
    const res = await quiz(answer('q01', correctIds('q01')));
    expect(JSON.parse(res.body)).toMatchObject({ correct: true, xpAwarded: 0, totalXp: 10 });
    expect((await db.doc(`users/${UID}`).get()).get('xp')).toBe(10);
    expect((await db.collection(`progress/${UID}/attempts`).get()).size).toBe(2);
  });

  it('answers wrong without XP and never leaks the key', async () => {
    await createProfile();
    const res = await quiz(answer('q02', wrongIds('q02')));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ correct: false, xpAwarded: 0, totalXp: 0 });
    expect(res.body).not.toContain('correctOptionIds');
    expect((await db.doc(`users/${UID}`).get()).get('xp')).toBe(0);
  });

  it('tracks the streak across America/Bogota days', async () => {
    await createProfile();
    // 04:30Z del 5 = 23:30 del 4 en Bogotá.
    const day1 = await handleQuiz(answer('q01', correctIds('q01')), at('2026-10-05T04:30:00Z'));
    expect(JSON.parse(day1.body)).toMatchObject({ streakDays: 1 });
    const sameDay = await handleQuiz(answer('q02', correctIds('q02')), at('2026-10-04T12:00:00Z'));
    expect(JSON.parse(sameDay.body)).toMatchObject({ streakDays: 1 });
    const day2 = await handleQuiz(answer('q03', correctIds('q03')), at('2026-10-05T15:00:00Z'));
    expect(JSON.parse(day2.body)).toMatchObject({ streakDays: 2 });
    const wrong = await handleQuiz(answer('q04', wrongIds('q04')), at('2026-10-06T15:00:00Z'));
    expect(JSON.parse(wrong.body)).toMatchObject({ correct: false, streakDays: 2 });
    const afterGap = await handleQuiz(answer('q05', correctIds('q05')), at('2026-10-07T15:00:00Z'));
    expect(JSON.parse(afterGap.body)).toMatchObject({ streakDays: 1 });
    expect((await db.doc(`users/${UID}`).get()).get('lastActiveDate')).toBe('2026-10-07');
  });

  it('responds 404 without a profile, for unknown questions and for hidden drafts', async () => {
    expect((await quiz(answer('q01', ['b']))).statusCode).toBe(404);
    await createProfile();
    expect((await quiz(answer('q999', ['a']))).statusCode).toBe(404);
    process.env.SHOW_DRAFT_QUESTIONS = 'false';
    const hidden = await quiz(answer('q01', correctIds('q01')));
    expect(hidden.statusCode).toBe(404);
    expect(JSON.parse(hidden.body)).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('rejects an invalid body with 422', async () => {
    await createProfile();
    const res = await quiz(event('POST', '/quiz/answer', { questionId: 'q01' }));
    expect(res.statusCode).toBe(422);
  });
});
