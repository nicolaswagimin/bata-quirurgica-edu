import type { Writable } from 'node:stream';
import type {
  APIGatewayAuthorizerResult,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayTokenAuthorizerEvent,
} from 'aws-lambda';

// Único archivo de handlers Lambda. Cada export va en su propia línea `export const <nombre>`
// (la prueba de infra los lee con /^export const (\w+)/gm) y carga su módulo con import().

type ProxyHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
type StreamHandler = (event: APIGatewayProxyEvent, stream: Writable) => Promise<void>;

// Sin el global `awslambda` (pruebas, check:bundle) el handler queda sin envolver.
const streamify = (fn: StreamHandler) =>
  globalThis.awslambda ? globalThis.awslambda.streamifyResponse(fn) : fn;

export const notImplemented: ProxyHandler = async () => {
  const { errorResponse, httpError } = await import('../lib/http.ts');
  return errorResponse(httpError('NOT_IMPLEMENTED', 'Esta función aún no está disponible.'));
};

let authorizerFn:
  | ((event: APIGatewayTokenAuthorizerEvent) => Promise<APIGatewayAuthorizerResult>)
  | undefined;

export const authorizer = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  if (!authorizerFn) {
    const { createAuthorizer, getAdminAuth, getDb } = await import('../lib/identity.ts');
    authorizerFn = createAuthorizer({
      verify: async (token) => (await getAdminAuth()).verifyIdToken(token),
      loadGroupId: async (uid) => {
        const snap = await (await getDb()).collection('users').doc(uid).get();
        const groupId: unknown = snap.get('groupId');
        return typeof groupId === 'string' ? groupId : null;
      },
    });
  }
  return authorizerFn(event);
};

export const me: ProxyHandler = async (event) => {
  const [{ withJsonHandler }, { handleMe }] = await Promise.all([
    import('../lib/http.ts'),
    import('../routes/me.ts'),
  ]);
  return withJsonHandler((e) => handleMe(e))(event);
};
export const quiz: ProxyHandler = async (event) => {
  const [{ withJsonHandler }, { handleQuiz }] = await Promise.all([
    import('../lib/http.ts'),
    import('../routes/quiz.ts'),
  ]);
  return withJsonHandler((e) => handleQuiz(e))(event);
};
export const chat = streamify(async (event, stream) => {
  const [{ handleChatStream }, { defaultChatDeps }] = await Promise.all([
    import('../routes/assistant.ts'),
    import('../lib/assistant-deps.ts'),
  ]);
  await handleChatStream(event, stream, defaultChatDeps());
});
export const transcribe: ProxyHandler = async (event) => {
  const [{ handleTranscribe }, { defaultTranscribeDeps }] = await Promise.all([
    import('../routes/assistant.ts'),
    import('../lib/assistant-deps.ts'),
  ]);
  return handleTranscribe(event, defaultTranscribeDeps());
};
export const admin: ProxyHandler = notImplemented;
