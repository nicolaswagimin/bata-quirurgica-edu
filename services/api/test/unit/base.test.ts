import { ERROR_CODES, ERROR_STATUS } from '@bata/shared/schemas';
import type { APIGatewayProxyEvent, APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { notImplemented } from '../../src/handlers/entry.ts';
import {
  errorResponse,
  HttpError,
  httpError,
  parseJsonBody,
  readAuthContext,
  toHttpError,
} from '../../src/lib/http.ts';
import { createAuthorizer } from '../../src/lib/identity.ts';

const ORIGIN = 'http://localhost:4173';
const API_ARN = 'arn:aws:execute-api:us-east-1:123456789012:abc123';

function expectCors(headers: Record<string, unknown> | undefined) {
  expect(headers?.['Access-Control-Allow-Origin']).toBe(ORIGIN);
  expect(headers?.['Access-Control-Allow-Headers']).toBe('Authorization,Content-Type');
  expect(headers?.Vary).toBe('Origin');
}

function tokenEvent(authorizationToken: string): APIGatewayTokenAuthorizerEvent {
  return { type: 'TOKEN', authorizationToken, methodArn: `${API_ARN}/v1/POST/quiz/answer` };
}

describe('errorResponse', () => {
  it.each(ERROR_CODES)('maps %s to its status with envelope and CORS', (code) => {
    const res = errorResponse(httpError(code, `msg ${code}`));
    expect(res.statusCode).toBe(ERROR_STATUS[code]);
    expect(JSON.parse(res.body)).toEqual({ error: { code, message: `msg ${code}` } });
    expectCors(res.headers);
  });

  it('turns unknown errors into 500 INTERNAL without the stack', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = errorResponse(new Error('secret stack detail'));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error.code).toBe('INTERNAL');
    expect(res.body).not.toContain('secret stack detail');
    expectCors(res.headers);
    expect(toHttpError('boom').code).toBe('INTERNAL');
  });
});

describe('parseJsonBody', () => {
  const schema = z.object({ name: z.string().min(1) }).strict();

  it('returns the parsed body', () => {
    expect(parseJsonBody(schema, '{"name":"Ana"}')).toEqual({ name: 'Ana' });
  });

  it.each(['{not json', '', null, '{"name":""}', '{"name":"Ana","x":1}', '[]'])(
    'throws 422 VALIDATION_ERROR for %j',
    (raw) => {
      try {
        parseJsonBody(schema, raw);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(422);
        expect((err as HttpError).code).toBe('VALIDATION_ERROR');
      }
    },
  );
});

describe('readAuthContext', () => {
  it('reads uid, role and groupId', () => {
    const event = {
      requestContext: { authorizer: { uid: 'u1', role: 'admin', groupId: 'g1' } },
    } as unknown as APIGatewayProxyEvent;
    expect(readAuthContext(event)).toEqual({ uid: 'u1', role: 'admin', groupId: 'g1' });
  });

  it('throws 401 without uid', () => {
    const event = { requestContext: { authorizer: null } } as unknown as APIGatewayProxyEvent;
    expect(() => readAuthContext(event)).toThrow(HttpError);
  });
});

describe('authorizer', () => {
  const loadGroupId = vi.fn(async (uid: string) => (uid === 'u1' ? 'g1' : null));

  it('allows the whole v1 stage with string context', async () => {
    const verify = vi.fn(async () => ({ uid: 'u1' }));
    const result = await createAuthorizer({ verify, loadGroupId })(tokenEvent('Bearer good'));
    expect(verify).toHaveBeenCalledWith('good');
    expect(result.principalId).toBe('u1');
    expect(result.policyDocument.Statement).toEqual([
      { Action: 'execute-api:Invoke', Effect: 'Allow', Resource: `${API_ARN}/v1/*/*` },
    ]);
    expect(result.context).toEqual({ uid: 'u1', role: 'student', groupId: 'g1' });
    for (const value of Object.values(result.context ?? {})) expect(typeof value).toBe('string');
  });

  it('uses an empty groupId when the user has none', async () => {
    const verify = async () => ({ uid: 'u2' });
    const result = await createAuthorizer({ verify, loadGroupId })(tokenEvent('Bearer t'));
    expect(result.context?.groupId).toBe('');
  });

  it.each([
    [{ uid: 'u1', role: 'admin' }, 'admin'],
    [{ uid: 'u1', role: 'superuser' }, 'student'],
    [{ uid: 'u1', role: true }, 'student'],
    [{ uid: 'u1' }, 'student'],
  ])('maps claims %j to role %s', async (claims, role) => {
    const result = await createAuthorizer({ verify: async () => claims, loadGroupId })(
      tokenEvent('Bearer t'),
    );
    expect(result.context?.role).toBe(role);
  });

  it.each(['', 'good', 'Basic abc', 'Bearer ', 'bearer good'])(
    'rejects header %j with Unauthorized',
    async (header) => {
      const verify = vi.fn(async () => ({ uid: 'u1' }));
      await expect(createAuthorizer({ verify, loadGroupId })(tokenEvent(header))).rejects.toThrow(
        /^Unauthorized$/,
      );
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it('rejects a token the verifier refuses', async () => {
    const verify = async () => {
      throw new Error('auth/id-token-expired');
    };
    await expect(
      createAuthorizer({ verify, loadGroupId })(tokenEvent('Bearer bad')),
    ).rejects.toThrow(/^Unauthorized$/);
  });
});

describe('notImplemented', () => {
  it('returns 501 NOT_IMPLEMENTED with CORS', async () => {
    const res = await notImplemented({} as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(501);
    expect(JSON.parse(res.body).error.code).toBe('NOT_IMPLEMENTED');
    expectCors(res.headers);
  });
});
