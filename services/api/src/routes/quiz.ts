import {
  AnswerRequestSchema,
  FinishAttemptRequestSchema,
  PracticeCompleteRequestSchema,
  StartAttemptRequestSchema,
} from '@bata/shared/schemas';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { httpError, json, parseJsonBody, readAuthContext } from '../lib/http.ts';
import { getDb } from '../lib/identity.ts';
import {
  completePracticeTx,
  finishAttemptTx,
  startAttemptTx,
  submitAnswerTx,
} from '../lib/repos.ts';

export type QuizDeps = { now: () => Date };

const defaultDeps: QuizDeps = { now: () => new Date() };

async function startAttempt(
  event: APIGatewayProxyEvent,
  uid: string,
  deps: QuizDeps,
): Promise<APIGatewayProxyResult> {
  const input = parseJsonBody(StartAttemptRequestSchema, event.body);
  const outcome = await startAttemptTx(await getDb(), {
    uid,
    missionId: input.missionId,
    allowDrafts: process.env.SHOW_DRAFT_QUESTIONS === 'true',
    now: deps.now(),
  });
  if (outcome.status === 'profile_not_found') {
    throw httpError('NOT_FOUND', 'Aún no tienes un perfil.');
  }
  if (outcome.status === 'mission_not_found') {
    throw httpError('NOT_FOUND', 'No encontramos esa misión o no tiene preguntas publicadas.');
  }
  return json(201, outcome.response);
}

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
  if (outcome.status === 'attempt_not_found' || outcome.status === 'question_not_in_attempt') {
    throw httpError('NOT_FOUND', 'Intento o pregunta no encontrada.');
  }
  if (outcome.status === 'already_answered') {
    throw httpError('CONFLICT', 'Esta pregunta ya fue respondida en este intento.');
  }
  if (outcome.status === 'attempt_closed') {
    throw httpError('CONFLICT', 'Este intento ya fue cerrado.');
  }
  if (outcome.status === 'question_not_found') {
    throw httpError('NOT_FOUND', 'No encontramos esa pregunta.');
  }
  if (outcome.status === 'profile_not_found') {
    throw httpError('NOT_FOUND', 'Aún no tienes un perfil.');
  }
  return json(200, outcome.response);
}

async function finishAttempt(
  event: APIGatewayProxyEvent,
  uid: string,
  deps: QuizDeps,
): Promise<APIGatewayProxyResult> {
  const input = parseJsonBody(FinishAttemptRequestSchema, event.body);
  const outcome = await finishAttemptTx(await getDb(), {
    uid,
    attemptId: input.attemptId,
    now: deps.now(),
  });
  if (outcome.status === 'attempt_not_found') {
    throw httpError('NOT_FOUND', 'Intento no encontrado.');
  }
  if (outcome.status === 'attempt_closed') {
    throw httpError('CONFLICT', 'Este intento ya fue cerrado.');
  }
  if (outcome.status === 'profile_not_found') {
    throw httpError('NOT_FOUND', 'Aún no tienes un perfil.');
  }
  return json(200, outcome.response);
}

async function practice(
  event: APIGatewayProxyEvent,
  uid: string,
  deps: QuizDeps,
): Promise<APIGatewayProxyResult> {
  const input = parseJsonBody(PracticeCompleteRequestSchema, event.body);
  const outcome = await completePracticeTx(await getDb(), {
    uid,
    stepIds: input.stepIds,
    now: deps.now(),
  });
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
  if (route === 'POST /quiz/attempt') return startAttempt(event, uid, deps);
  if (route === 'POST /quiz/answer') return answer(event, uid, deps);
  if (route === 'POST /quiz/finish') return finishAttempt(event, uid, deps);
  if (route === 'POST /quiz/practice') return practice(event, uid, deps);
  throw httpError('NOT_FOUND', 'Ruta no encontrada.');
}
