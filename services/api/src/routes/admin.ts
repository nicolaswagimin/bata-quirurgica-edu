import { CreateGroupSchema, QuestionInputSchema } from '@bata/shared/schemas';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { httpError, json, parseJsonBody, readAuthContext } from '../lib/http.ts';
import { getDb } from '../lib/identity.ts';
import {
  createGroup,
  groupExists,
  groupProgress,
  listQuestionsWithKeys,
  saveQuestionTx,
  validateQuestionTx,
} from '../lib/repos.ts';

export type AdminDeps = { now: () => Date };

const defaultDeps: AdminDeps = { now: () => new Date() };

const QUESTION_NOT_FOUND = 'No encontramos esa pregunta.';

async function saveQuestion(
  event: APIGatewayProxyEvent,
  uid: string,
  id: string | null,
): Promise<APIGatewayProxyResult> {
  const question = parseJsonBody(QuestionInputSchema, event.body);
  const outcome = await saveQuestionTx(await getDb(), { id, question, uid });
  if (outcome.status === 'mission_not_found') {
    throw httpError('NOT_FOUND', 'No encontramos esa misión.');
  }
  if (outcome.status === 'question_not_found') throw httpError('NOT_FOUND', QUESTION_NOT_FOUND);
  return json(id ? 200 : 201, outcome.question);
}

async function validateQuestion(
  id: string,
  uid: string,
  deps: AdminDeps,
): Promise<APIGatewayProxyResult> {
  const question = await validateQuestionTx(await getDb(), {
    id,
    uid,
    now: deps.now().toISOString(),
  });
  if (!question) throw httpError('NOT_FOUND', QUESTION_NOT_FOUND);
  return json(200, { id, ...question });
}

async function newGroup(
  event: APIGatewayProxyEvent,
  uid: string,
  deps: AdminDeps,
): Promise<APIGatewayProxyResult> {
  const { name } = parseJsonBody(CreateGroupSchema, event.body);
  const group = await createGroup(await getDb(), {
    name,
    createdBy: uid,
    createdAt: deps.now().toISOString(),
  });
  return json(201, { groupId: group.groupId, joinCode: group.joinCode });
}

async function progress(groupId: string): Promise<APIGatewayProxyResult> {
  const db = await getDb();
  if (!(await groupExists(db, groupId))) throw httpError('NOT_FOUND', 'No encontramos ese grupo.');
  return json(200, await groupProgress(db, groupId));
}

export async function handleAdmin(
  event: APIGatewayProxyEvent,
  deps: AdminDeps = defaultDeps,
): Promise<APIGatewayProxyResult> {
  const { uid, role } = readAuthContext(event);
  if (role !== 'admin') throw httpError('FORBIDDEN', 'No tienes permiso para esta acción.');
  const method = event.httpMethod;
  const segments = event.path.split('/').filter(Boolean).map(decodeURIComponent);
  const [root, resource, id, action, ...rest] = segments;
  if (root === 'admin' && rest.length === 0) {
    if (resource === 'questions') {
      if (!id && !action && method === 'GET') {
        return json(200, await listQuestionsWithKeys(await getDb()));
      }
      if (!id && !action && method === 'POST') return saveQuestion(event, uid, null);
      if (id && !action && method === 'PUT') return saveQuestion(event, uid, id);
      if (id && action === 'validate' && method === 'POST') return validateQuestion(id, uid, deps);
    }
    if (resource === 'groups') {
      if (!id && !action && method === 'POST') return newGroup(event, uid, deps);
      if (id && action === 'progress' && method === 'GET') return progress(id);
    }
  }
  throw httpError('NOT_FOUND', 'Ruta no encontrada.');
}
