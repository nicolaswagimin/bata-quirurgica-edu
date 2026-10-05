import { randomInt } from 'node:crypto';
import type { Role } from '@bata/shared/schemas';
import type { Firestore } from 'firebase-admin/firestore';
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
