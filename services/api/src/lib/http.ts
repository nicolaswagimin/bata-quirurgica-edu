import { ERROR_STATUS, type ErrorCode, type Role, RoleSchema } from '@bata/shared/schemas';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { z } from 'zod';
import { requireEnv } from './config.ts';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function httpError(code: ErrorCode, message: string): HttpError {
  return new HttpError(ERROR_STATUS[code], code, message);
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': requireEnv('WEB_ORIGIN'),
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    Vary: 'Origin',
  };
}

export function json(status: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode: status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

// Errores desconocidos → 500 INTERNAL; el stack nunca llega al cliente.
export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  console.error('Unhandled error', err instanceof Error ? err.message : String(err));
  return httpError('INTERNAL', 'Error interno del servidor.');
}

export function errorResponse(err: unknown): APIGatewayProxyResult {
  const httpErr = toHttpError(err);
  return json(ERROR_STATUS[httpErr.code], {
    error: { code: httpErr.code, message: httpErr.message },
  });
}

export function parseJsonBody<S extends z.ZodType>(
  schema: S,
  raw: string | null | undefined,
): z.infer<S> {
  let data: unknown;
  try {
    data = JSON.parse(raw ?? '');
  } catch {
    throw httpError('VALIDATION_ERROR', 'El cuerpo no es JSON válido.');
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw httpError('VALIDATION_ERROR', 'Revisa los datos enviados.');
  return parsed.data;
}

export type AuthContext = { uid: string; role: Role; groupId: string | null };

export function readAuthContext(event: Pick<APIGatewayProxyEvent, 'requestContext'>): AuthContext {
  const auth = event.requestContext?.authorizer as Record<string, unknown> | null | undefined;
  const uid = auth?.uid;
  if (typeof uid !== 'string' || uid === '') {
    throw httpError('UNAUTHORIZED', 'Tu sesión expiró, vuelve a iniciar sesión');
  }
  const role = RoleSchema.safeParse(auth?.role);
  const groupId = typeof auth?.groupId === 'string' && auth.groupId !== '' ? auth.groupId : null;
  return { uid, role: role.success ? role.data : 'student', groupId };
}

export function withJsonHandler(
  fn: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>,
): (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  return async (event) => {
    try {
      return await fn(event);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
