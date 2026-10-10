import { POLICY_VERSION } from '@bata/shared/schemas';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setAdmin } from '../../scripts/set-admin.ts';
import { me } from '../../src/handlers/entry.ts';
import { getAdminAuth, getDb } from '../../src/lib/identity.ts';
import { createGroup } from '../../src/lib/repos.ts';

const FIRESTORE_RESET =
  'http://127.0.0.1:8080/emulator/v1/projects/demo-bata/databases/(default)/documents';
const AUTH_RESET = 'http://127.0.0.1:9099/emulator/v1/projects/demo-bata/accounts';

let db: Firestore;
let auth: Auth;

function event(method: string, path: string, uid: string, body?: unknown): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    body: body === undefined ? null : JSON.stringify(body),
    requestContext: { authorizer: { uid, role: 'student', groupId: '' } },
  } as unknown as APIGatewayProxyEvent;
}

async function newUser(email = 'laura@ejemplo.test'): Promise<string> {
  return (await auth.createUser({ email, password: 'secreto123' })).uid;
}

const validBody = {
  displayName: 'Laura Gómez',
  consent: { policyVersion: POLICY_VERSION, accepted: true },
};

async function errorCode(res: { body: string }): Promise<string> {
  return (JSON.parse(res.body) as { error: { code: string } }).error.code;
}

beforeAll(async () => {
  [db, auth] = await Promise.all([getDb(), getAdminAuth()]);
});

beforeEach(async () => {
  await Promise.all([
    fetch(FIRESTORE_RESET, { method: 'DELETE' }),
    fetch(AUTH_RESET, { method: 'DELETE' }),
  ]);
});

describe('POST /me', () => {
  it('creates the profile with consent and responds 201', async () => {
    const uid = await newUser();
    const res = await me(event('POST', '/me', uid, validBody));
    expect(res.statusCode).toBe(201);
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:4173');
    const stored = (await db.doc(`users/${uid}`).get()).data();
    expect(stored).toMatchObject({
      uid,
      email: 'laura@ejemplo.test',
      role: 'student',
      xp: 0,
      level: 1,
      streakDays: 0,
      groupId: null,
      consent: { policyVersion: POLICY_VERSION },
    });
    expect(typeof stored?.consent.acceptedAt).toBe('string');
    expect(JSON.parse(res.body)).toMatchObject({ uid, displayName: 'Laura Gómez' });
    expect((await db.doc(`leaderboard/${uid}`).get()).exists).toBe(true);
  });

  it.each([
    ['missing consent', { displayName: 'Laura Gómez' }],
    [
      'accepted false',
      { ...validBody, consent: { policyVersion: POLICY_VERSION, accepted: false } },
    ],
    [
      'other policy version',
      { ...validBody, consent: { policyVersion: '2020-01-01', accepted: true } },
    ],
  ])('rejects %s with 422 and writes nothing', async (_label, body) => {
    const uid = await newUser();
    const res = await me(event('POST', '/me', uid, body));
    expect(res.statusCode).toBe(422);
    expect(await errorCode(res)).toBe('VALIDATION_ERROR');
    expect((await db.doc(`users/${uid}`).get()).exists).toBe(false);
    expect((await db.doc(`leaderboard/${uid}`).get()).exists).toBe(false);
  });

  it('responds 409 when the profile already exists', async () => {
    const uid = await newUser();
    await me(event('POST', '/me', uid, validBody));
    const res = await me(event('POST', '/me', uid, validBody));
    expect(res.statusCode).toBe(409);
    expect(await errorCode(res)).toBe('CONFLICT');
  });

  it('joins a group by code, and 404s on an unknown code', async () => {
    const group = await createGroup(db, { name: 'Cirugía A', createdBy: 'x', createdAt: 'now' });
    const uid = await newUser();
    const ok = await me(event('POST', '/me', uid, { ...validBody, groupCode: group.joinCode }));
    expect(ok.statusCode).toBe(201);
    expect((await db.doc(`users/${uid}`).get()).get('groupId')).toBe(group.groupId);
    expect((await db.doc(`leaderboard/${uid}`).get()).get('groupId')).toBe(group.groupId);

    const other = await newUser('otro@ejemplo.test');
    const missing = await me(event('POST', '/me', other, { ...validBody, groupCode: 'ZZZ999' }));
    expect(missing.statusCode).toBe(404);
    expect(await errorCode(missing)).toBe('NOT_FOUND');
    expect((await db.doc(`users/${other}`).get()).exists).toBe(false);
  });
});

describe('POST /me/group', () => {
  it('sets groupId on users and leaderboard, and 404s on an unknown code', async () => {
    const group = await createGroup(db, { name: 'Cirugía B', createdBy: 'x', createdAt: 'now' });
    const uid = await newUser();
    await me(event('POST', '/me', uid, validBody));

    const ok = await me(event('POST', '/me/group', uid, { groupCode: group.joinCode }));
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body)).toMatchObject({ groupId: group.groupId });
    expect((await db.doc(`users/${uid}`).get()).get('groupId')).toBe(group.groupId);
    expect((await db.doc(`leaderboard/${uid}`).get()).get('groupId')).toBe(group.groupId);

    const missing = await me(event('POST', '/me/group', uid, { groupCode: 'ZZZ999' }));
    expect(missing.statusCode).toBe(404);
    expect(await errorCode(missing)).toBe('NOT_FOUND');
  });
});

describe('GET /me', () => {
  it('responds 404 without a profile and 200 with it', async () => {
    const uid = await newUser();
    const before = await me(event('GET', '/me', uid));
    expect(before.statusCode).toBe(404);
    expect(await errorCode(before)).toBe('NOT_FOUND');

    await me(event('POST', '/me', uid, validBody));
    const after = await me(event('GET', '/me', uid));
    expect(after.statusCode).toBe(200);
    expect(JSON.parse(after.body)).toMatchObject({ uid, displayName: 'Laura Gómez' });
  });
});

describe('DELETE /me', () => {
  it('deletes profile, progress, leaderboard, quotas and the Auth user', async () => {
    const uid = await newUser();
    await me(event('POST', '/me', uid, validBody));
    await db.doc(`progress/${uid}/missions/m1`).set({ completed: false });
    await db.doc(`progress/${uid}/attempts/a1`).set({ correct: true });
    await db.doc(`quotas/${uid}`).set({ chat: { windowStart: 0, count: 1 } });

    const res = await me(event('DELETE', '/me', uid));
    expect(res.statusCode).toBe(204);
    for (const path of [
      `users/${uid}`,
      `leaderboard/${uid}`,
      `quotas/${uid}`,
      `progress/${uid}/missions/m1`,
      `progress/${uid}/attempts/a1`,
    ]) {
      expect((await db.doc(path).get()).exists, path).toBe(false);
    }
    await expect(auth.getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
  });
});

describe('setAdmin', () => {
  it('sets the admin claim and the profile role', async () => {
    const uid = await newUser('admin@ejemplo.test');
    await me(event('POST', '/me', uid, validBody));
    await setAdmin('admin@ejemplo.test');
    expect((await auth.getUser(uid)).customClaims).toMatchObject({ role: 'admin' });
    expect((await db.doc(`users/${uid}`).get()).get('role')).toBe('admin');
  });

  it('sets the claim when the user has no profile yet', async () => {
    const uid = await newUser('sinperfil@ejemplo.test');
    await setAdmin('sinperfil@ejemplo.test');
    expect((await auth.getUser(uid)).customClaims).toMatchObject({ role: 'admin' });
    expect((await db.doc(`users/${uid}`).get()).exists).toBe(false);
  });
});
