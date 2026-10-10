import { CreateProfileSchema, JoinGroupSchema } from '@bata/shared/schemas';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { corsHeaders, httpError, json, parseJsonBody, readAuthContext } from '../lib/http.ts';
import { getAdminAuth, getDb } from '../lib/identity.ts';
import {
  createProfileBatch,
  deleteUserData,
  findGroupByCode,
  getUser,
  setUserGroup,
  type UserDoc,
} from '../lib/repos.ts';

export type MeDeps = { now: () => Date };

const defaultDeps: MeDeps = { now: () => new Date() };

const GROUP_NOT_FOUND = 'No encontramos un grupo con ese código';
const PROFILE_NOT_FOUND = 'Aún no tienes un perfil.';

// Firestore lanza ALREADY_EXISTS (código 6) cuando `create` encuentra el documento.
function isAlreadyExists(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 6;
}

async function resolveGroupId(groupCode: string): Promise<string> {
  const group = await findGroupByCode(await getDb(), groupCode);
  if (!group) throw httpError('NOT_FOUND', GROUP_NOT_FOUND);
  return group.groupId;
}

// El autorizador no reenvía el correo; se toma del usuario de Auth (vacío si no tiene).
async function lookupEmail(event: APIGatewayProxyEvent, uid: string): Promise<string> {
  const fromContext: unknown = event.requestContext?.authorizer?.email;
  if (typeof fromContext === 'string') return fromContext;
  try {
    return (await (await getAdminAuth()).getUser(uid)).email ?? '';
  } catch {
    return '';
  }
}

async function createProfile(
  event: APIGatewayProxyEvent,
  uid: string,
  deps: MeDeps,
): Promise<APIGatewayProxyResult> {
  const input = parseJsonBody(CreateProfileSchema, event.body);
  const db = await getDb();
  if (await getUser(db, uid)) throw httpError('CONFLICT', 'Ya tienes un perfil.');
  const groupId = input.groupCode ? await resolveGroupId(input.groupCode) : null;
  const now = deps.now().toISOString();
  const user: UserDoc = {
    uid,
    displayName: input.displayName,
    email: await lookupEmail(event, uid),
    role: 'student',
    groupId,
    xp: 0,
    level: 1,
    streakDays: 0,
    lastActiveDate: null,
    consent: { policyVersion: input.consent.policyVersion, acceptedAt: now },
    createdAt: now,
    updatedAt: now,
  };
  try {
    await createProfileBatch(db, user);
  } catch (err) {
    if (isAlreadyExists(err)) throw httpError('CONFLICT', 'Ya tienes un perfil.');
    throw err;
  }
  return json(201, user);
}

async function requireUser(uid: string): Promise<UserDoc> {
  const user = await getUser(await getDb(), uid);
  if (!user) throw httpError('NOT_FOUND', PROFILE_NOT_FOUND);
  return user;
}

async function joinGroup(
  event: APIGatewayProxyEvent,
  uid: string,
  deps: MeDeps,
): Promise<APIGatewayProxyResult> {
  const { groupCode } = parseJsonBody(JoinGroupSchema, event.body);
  const user = await requireUser(uid);
  const groupId = await resolveGroupId(groupCode);
  const updatedAt = deps.now().toISOString();
  await setUserGroup(await getDb(), uid, groupId, updatedAt);
  return json(200, { ...user, groupId, updatedAt });
}

async function deleteAccount(uid: string): Promise<APIGatewayProxyResult> {
  await deleteUserData(await getDb(), uid);
  try {
    await (await getAdminAuth()).deleteUser(uid);
  } catch (err) {
    if ((err as { code?: unknown }).code !== 'auth/user-not-found') throw err;
  }
  return { statusCode: 204, headers: corsHeaders(), body: '' };
}

export async function handleMe(
  event: APIGatewayProxyEvent,
  deps: MeDeps = defaultDeps,
): Promise<APIGatewayProxyResult> {
  const { uid } = readAuthContext(event);
  const route = `${event.httpMethod} ${event.path.replace(/\/+$/, '')}`;
  switch (route) {
    case 'POST /me':
      return createProfile(event, uid, deps);
    case 'GET /me':
      return json(200, await requireUser(uid));
    case 'DELETE /me':
      return deleteAccount(uid);
    case 'POST /me/group':
      return joinGroup(event, uid, deps);
    default:
      throw httpError('NOT_FOUND', 'Ruta no encontrada.');
  }
}
