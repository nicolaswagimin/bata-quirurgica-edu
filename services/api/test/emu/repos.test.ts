import type { Firestore } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../src/lib/identity.ts';
import {
  consumeQuotaTx,
  createGroup,
  createProfileBatch,
  deleteUserData,
  findGroupByCode,
  getUser,
  setUserGroup,
  type UserDoc,
} from '../../src/lib/repos.ts';

const FIRESTORE_RESET =
  'http://127.0.0.1:8080/emulator/v1/projects/demo-bata/databases/(default)/documents';
const AUTH_RESET = 'http://127.0.0.1:9099/emulator/v1/projects/demo-bata/accounts';
const NOW = '2026-10-05T12:00:00.000Z';

let db: Firestore;

function user(uid: string): UserDoc {
  return {
    uid,
    displayName: 'Laura Gómez',
    email: `${uid}@ejemplo.test`,
    role: 'student',
    groupId: null,
    xp: 0,
    level: 1,
    streakDays: 0,
    lastActiveDate: null,
    consent: { policyVersion: '2026-10-04', acceptedAt: NOW },
    createdAt: NOW,
    updatedAt: NOW,
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
});

describe('consumeQuotaTx', () => {
  it('allows 30 chat requests in an hour and rejects the 31st', async () => {
    const nowMs = Date.parse(NOW);
    const results: boolean[] = [];
    for (let i = 0; i < 31; i++) results.push(await consumeQuotaTx(db, 'u1', 'chat', nowMs + i));
    expect(results.slice(0, 30).every(Boolean)).toBe(true);
    expect(results[30]).toBe(false);
    const snap = await db.doc('quotas/u1').get();
    expect(snap.get('chatHourCount')).toBe(30);
  });
});

describe('profiles and groups', () => {
  it('creates a profile with its leaderboard entry and refuses a duplicate', async () => {
    await createProfileBatch(db, user('u1'));
    expect(await getUser(db, 'u1')).toEqual(user('u1'));
    expect((await db.doc('leaderboard/u1').get()).get('xp')).toBe(0);
    await expect(createProfileBatch(db, user('u1'))).rejects.toMatchObject({ code: 6 });
    expect(await getUser(db, 'missing')).toBeNull();
  });

  it('retries colliding join codes and finds groups by code', async () => {
    const codes = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
    const next = () => codes.shift() ?? 'ZZZZZZ';
    const first = await createGroup(
      db,
      { name: 'Cirugía A', createdBy: 'admin', createdAt: NOW },
      next,
    );
    const second = await createGroup(
      db,
      { name: 'Cirugía B', createdBy: 'admin', createdAt: NOW },
      next,
    );
    expect(first.joinCode).toBe('AAAAAA');
    expect(second.joinCode).toBe('BBBBBB');
    expect((await findGroupByCode(db, 'BBBBBB'))?.groupId).toBe(second.groupId);
    expect(await findGroupByCode(db, 'CCCCCC')).toBeNull();
  });

  it('sets the group on the profile and the leaderboard entry', async () => {
    await createProfileBatch(db, user('u1'));
    await setUserGroup(db, 'u1', 'g1', NOW);
    expect((await getUser(db, 'u1'))?.groupId).toBe('g1');
    expect((await db.doc('leaderboard/u1').get()).get('groupId')).toBe('g1');
  });
});

describe('deleteUserData', () => {
  it('removes profile, attempts, mission progress, leaderboard and quota', async () => {
    await createProfileBatch(db, user('u1'));
    await createProfileBatch(db, user('u2'));
    await db.doc('progress/u1/attempts/a1').set({ questionId: 'q1', correct: true });
    await db.doc('progress/u1/missions/m1').set({ answeredCorrectIds: ['q1'], completed: false });
    await consumeQuotaTx(db, 'u1', 'chat', Date.parse(NOW));

    await deleteUserData(db, 'u1');

    const paths = [
      'users/u1',
      'leaderboard/u1',
      'quotas/u1',
      'progress/u1/attempts/a1',
      'progress/u1/missions/m1',
    ];
    for (const path of paths) expect((await db.doc(path).get()).exists).toBe(false);
    expect((await db.collection('progress/u1/attempts').get()).empty).toBe(true);
    expect(await getUser(db, 'u2')).not.toBeNull();
  });
});
