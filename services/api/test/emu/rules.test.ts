import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const SERVER_ONLY = [
  'questionKeys/q1',
  'quotas/alice',
  'groups/g1',
  'kbChunks/c1',
  'kbDocuments/d1',
];

async function seed(showDraftQuestions?: boolean) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, 'users/alice'), { uid: 'alice', displayName: 'Alice' }),
      setDoc(doc(db, 'users/bob'), { uid: 'bob', displayName: 'Bob' }),
      setDoc(doc(db, 'progress/alice/missions/m1'), { answeredCorrectIds: [], completed: false }),
      setDoc(doc(db, 'progress/bob/missions/m1'), { answeredCorrectIds: [], completed: false }),
      setDoc(doc(db, 'leaderboard/alice'), { displayName: 'Alice', xp: 0 }),
      setDoc(doc(db, 'missions/m1'), { title: 'Misión 1' }),
      setDoc(doc(db, 'questions/qv'), { status: 'validated', prompt: 'v' }),
      setDoc(doc(db, 'questions/qd'), { status: 'draft', prompt: 'd' }),
      setDoc(doc(db, 'questionKeys/q1'), { correctOptionIds: ['a'] }),
      setDoc(doc(db, 'quotas/alice'), { chatHourCount: 1 }),
      setDoc(doc(db, 'groups/g1'), { name: 'Grupo', joinCode: 'ABC123' }),
      setDoc(doc(db, 'kbChunks/c1'), { text: 'chunk' }),
      setDoc(doc(db, 'kbDocuments/d1'), { title: 'doc' }),
      ...(showDraftQuestions === undefined
        ? []
        : [setDoc(doc(db, 'appConfig/flags'), { showDraftQuestions })]),
    ]);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bata',
    firestore: {
      rules: readFileSync(resolve(import.meta.dirname, '../../../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe('owner-scoped reads', () => {
  it('lets a user read their own profile and mission progress', async () => {
    await seed();
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
    await assertSucceeds(getDoc(doc(db, 'progress/alice/missions/m1')));
  });

  it("denies reading another user's profile and mission progress", async () => {
    await seed();
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(db, 'users/bob')));
    await assertFails(getDoc(doc(db, 'progress/bob/missions/m1')));
  });

  it('denies unauthenticated reads of profiles', async () => {
    await seed();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users/alice')));
  });
});

describe('server-only data and writes', () => {
  it('denies reads of server-only collections', async () => {
    await seed();
    const db = env.authenticatedContext('alice', { admin: true }).firestore();
    for (const path of SERVER_ONLY) await assertFails(getDoc(doc(db, path)));
  });

  it('denies every client write, including to own documents', async () => {
    await seed(true);
    const db = env.authenticatedContext('alice').firestore();
    const paths = [
      'users/alice',
      'progress/alice/missions/m1',
      'progress/alice/attempts/a1',
      'leaderboard/alice',
      'missions/m1',
      'questions/qv',
      'appConfig/flags',
      'newCollection/x',
      ...SERVER_ONLY,
    ];
    for (const path of paths) {
      await assertFails(setDoc(doc(db, path), { xp: 9999 }));
      await assertFails(updateDoc(doc(db, path), { xp: 9999 }));
      await assertFails(deleteDoc(doc(db, path)));
    }
  });
});

describe('question visibility', () => {
  it('denies draft questions when the flag document is missing', async () => {
    await seed();
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(db, 'questions/qd')));
    await assertSucceeds(getDoc(doc(db, 'questions/qv')));
  });

  it('denies draft questions when the flag is false', async () => {
    await seed(false);
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(db, 'questions/qd')));
    await assertSucceeds(getDoc(doc(db, 'questions/qv')));
  });

  it('allows draft questions when the flag is true', async () => {
    await seed(true);
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(db, 'questions/qd')));
    await assertSucceeds(getDoc(doc(db, 'questions/qv')));
  });

  it('denies questions to signed-out clients', async () => {
    await seed(true);
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'questions/qv')));
  });
});
