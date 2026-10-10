import { AnswerRequestSchema } from '@bata/shared/schemas';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { httpError, json, parseJsonBody, readAuthContext } from '../lib/http.ts';
import { getDb } from '../lib/identity.ts';
import { submitAnswerTx } from '../lib/repos.ts';

export type QuizDeps = { now: () => Date };

const defaultDeps: QuizDeps = { now: () => new Date() };

async function answer(
  event: APIGatewayProxyEvent,
  uid: string,
  deps: QuizDeps,
): Promise<APIGatewayProxyResult> {
  const input = parseJsonBody(AnswerRequestSchema, event.body);
  const outcome = await submitAnswerTx(await getDb(), {
    uid,
    ...input,
    allowDrafts: process.env.SHOW_DRAFT_QUESTIONS === 'true',
    now: deps.now(),
  });
  if (outcome.status === 'question_not_found') {
    throw httpError('NOT_FOUND', 'No encontramos esa pregunta.');
  }
  if (outcome.status === 'profile_not_found') {
    throw httpError('NOT_FOUND', 'Aún no tienes un perfil.');
  }
  return json(200, outcome.response);
}

export async function handleQuiz(
  event: APIGatewayProxyEvent,
  deps: QuizDeps = defaultDeps,
): Promise<APIGatewayProxyResult> {
  const { uid } = readAuthContext(event);
  const route = `${event.httpMethod} ${event.path.replace(/\/+$/, '')}`;
  if (route === 'POST /quiz/answer') return answer(event, uid, deps);
  throw httpError('NOT_FOUND', 'Ruta no encontrada.');
}
