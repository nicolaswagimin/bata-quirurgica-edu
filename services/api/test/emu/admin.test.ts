import type { AdminQuestion, MemberProgress, QuestionInput } from '@bata/shared/schemas';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { Firestore } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SEED_FILE, seedContent } from '../../scripts/seed.ts';
import { admin } from '../../src/handlers/entry.ts';
import { getDb } from '../../src/lib/identity.ts';
import type { UserDoc } from '../../src/lib/repos.ts';

const FIRESTORE_RESET =
  'http://127.0.0.1:8080/emulator/v1/projects/demo-bata/databases/(default)/documents';
const AUTH_RESET = 'http://127.0.0.1:9099/emulator/v1/projects/demo-bata/accounts';

const ADMIN_UID = 'u_admin1';
const MISSION = 'm1-fundamentos';

let db: Firestore;

function event(
  method: string,
  path: string,
  body?: unknown,
  role: 'admin' | 'student' = 'admin',
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    body: body === undefined ? null : JSON.stringify(body),
    requestContext: {
      authorizer: { uid: role === 'admin' ? ADMIN_UID : 'u_student', role, groupId: '' },
    },
  } as unknown as APIGatewayProxyEvent;
}

const input: QuestionInput = {
  missionId: MISSION,
  type: 'single',
  prompt: '¿Qué parte de la bata se considera estéril?',
  options: [
    { id: 'a', text: 'El frente, del pecho a la cintura, y las mangas' },
    { id: 'b', text: 'La espalda' },
  ],
  explanation: 'Solo el frente y las mangas se consideran estériles.',
  source: {
    org: 'AORN',
    title: 'Guidelines for Perioperative Practice',
    year: 2023,
    section: 'Batas',
  },
  difficulty: 1,
  xp: 10,
  correctOptionIds: ['a'],
};

async function createQuestion(): Promise<AdminQuestion> {
  const res = await admin(event('POST', '/admin/questions', input));
  expect(res.statusCode).toBe(201);
  return JSON.parse(res.body) as AdminQuestion;
}

function member(uid: string, displayName: string, xp: number, groupId: string): UserDoc {
  return {
    uid,
    displayName,
    email: `${uid}@ejemplo.test`,
    role: 'student',
    groupId,
    xp,
    level: 1,
    streakDays: 2,
    lastActiveDate: null,
    consent: { policyVersion: '2026-10-04', acceptedAt: '2026-10-01T00:00:00.000Z' },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

beforeAll(async () => {
  db = await getDb();
});

beforeEach(async () => {
  await Promise.all([
    fetch(FIRESTORE_RESET, { method: 'DELETE' }),
    fetch(AUTH_RESET, { method: 'DELETE' }),
  ]);
  await seedContent(db, DEFAULT_SEED_FILE);
});

describe('admin authorization', () => {
  it('rejects students with 403 FORBIDDEN on every route and changes nothing', async () => {
    const before = (await db.collection('questions').get()).size;
    const calls = [
      event('GET', '/admin/questions', undefined, 'student'),
      event('POST', '/admin/questions', input, 'student'),
      event('PUT', '/admin/questions/q01', input, 'student'),
      event('POST', '/admin/questions/q01/validate', undefined, 'student'),
      event('POST', '/admin/groups', { name: 'Cirugía 2026-A' }, 'student'),
      event('GET', '/admin/groups/g1/progress', undefined, 'student'),
    ];
    for (const call of calls) {
      const res = await admin(call);
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toMatchObject({ error: { code: 'FORBIDDEN' } });
      expect(res.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:4173');
    }
    expect((await db.collection('questions').get()).size).toBe(before);
    expect((await db.collection('groups').get()).size).toBe(0);
    expect((await db.doc('questions/q01').get()).get('status')).toBe('draft');
  });
});

describe('admin questions', () => {
  it('creates a draft question with its key and adds it to the mission', async () => {
    const created = await createQuestion();
    const snap = await db.doc(`questions/${created.id}`).get();
    expect(snap.data()).toMatchObject({ status: 'draft', createdBy: ADMIN_UID, validatedBy: null });
    expect(snap.get('correctOptionIds')).toBeUndefined();
    expect((await db.doc(`questionKeys/${created.id}`).get()).data()).toEqual({
      correctOptionIds: ['a'],
    });
    expect((await db.doc(`missions/${MISSION}`).get()).get('questionIds')).toContain(created.id);
  });

  it('rejects invalid input with 422 and unknown missions with 404', async () => {
    const bad = await admin(
      event('POST', '/admin/questions', { ...input, correctOptionIds: ['z'] }),
    );
    expect(bad.statusCode).toBe(422);
    const missing = await admin(event('POST', '/admin/questions', { ...input, missionId: 'nope' }));
    expect(missing.statusCode).toBe(404);
  });

  it('updates question and key, and resets a validated question to draft', async () => {
    const created = await createQuestion();
    await admin(event('POST', `/admin/questions/${created.id}/validate`));
    const res = await admin(
      event('PUT', `/admin/questions/${created.id}`, {
        ...input,
        prompt: 'Texto corregido',
        correctOptionIds: ['b'],
      }),
    );
    expect(res.statusCode).toBe(200);
    const snap = await db.doc(`questions/${created.id}`).get();
    expect(snap.data()).toMatchObject({
      prompt: 'Texto corregido',
      status: 'draft',
      createdBy: ADMIN_UID,
      validatedBy: null,
      validatedAt: null,
    });
    expect((await db.doc(`questionKeys/${created.id}`).get()).get('correctOptionIds')).toEqual([
      'b',
    ]);
    const missing = await admin(event('PUT', '/admin/questions/nope', input));
    expect(missing.statusCode).toBe(404);
  });

  it('validates a question and lists every question with its key', async () => {
    const res = await admin(event('POST', '/admin/questions/q01/validate'));
    expect(res.statusCode).toBe(200);
    const snap = await db.doc('questions/q01').get();
    expect(snap.get('status')).toBe('validated');
    expect(snap.get('validatedBy')).toBe(ADMIN_UID);
    expect(typeof snap.get('validatedAt')).toBe('string');

    const list = await admin(event('GET', '/admin/questions'));
    expect(list.statusCode).toBe(200);
    const questions = JSON.parse(list.body) as AdminQuestion[];
    expect(questions.length).toBe((await db.collection('questions').get()).size);
    for (const q of questions) expect(q.correctOptionIds.length).toBeGreaterThan(0);
    expect(questions.find((q) => q.id === 'q01')?.status).toBe('validated');

    const missing = await admin(event('POST', '/admin/questions/nope/validate'));
    expect(missing.statusCode).toBe(404);
  });
});

describe('admin groups', () => {
  it('creates groups with unique 6-character join codes', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const res = await admin(event('POST', '/admin/groups', { name: `Cirugía 2026-${i}` }));
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body) as { groupId: string; joinCode: string };
      expect(body.joinCode).toMatch(/^[A-Z0-9]{6}$/);
      codes.add(body.joinCode);
      const group = await db.doc(`groups/${body.groupId}`).get();
      expect(group.data()).toMatchObject({ joinCode: body.joinCode, createdBy: ADMIN_UID });
    }
    expect(codes.size).toBe(3);
    const bad = await admin(event('POST', '/admin/groups', { name: 'x' }));
    expect(bad.statusCode).toBe(422);
  });

  it('returns member progress ordered by xp descending', async () => {
    const res = await admin(event('POST', '/admin/groups', { name: 'Cirugía 2026-A' }));
    const { groupId } = JSON.parse(res.body) as { groupId: string };
    await Promise.all([
      db.doc('users/u1').set(member('u1', 'Ana', 40, groupId)),
      db.doc('users/u2').set(member('u2', 'Bruno', 120, groupId)),
      db.doc('users/u3').set(member('u3', 'Carla', 500, 'otro')),
      db.doc(`progress/u2/missions/${MISSION}`).set({
        answeredCorrectIds: [],
        completed: true,
        completedAt: '2026-10-02T00:00:00.000Z',
      }),
      db.doc('progress/u2/missions/m2').set({
        answeredCorrectIds: [],
        completed: false,
        completedAt: null,
      }),
    ]);
    const progress = await admin(event('GET', `/admin/groups/${groupId}/progress`));
    expect(progress.statusCode).toBe(200);
    expect(JSON.parse(progress.body) as MemberProgress[]).toEqual([
      { uid: 'u2', displayName: 'Bruno', xp: 120, level: 1, streakDays: 2, completedMissions: 1 },
      { uid: 'u1', displayName: 'Ana', xp: 40, level: 1, streakDays: 2, completedMissions: 0 },
    ]);
    const missing = await admin(event('GET', '/admin/groups/nope/progress'));
    expect(missing.statusCode).toBe(404);
  });
});
