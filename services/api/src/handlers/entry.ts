import type {
  APIGatewayAuthorizerResult,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayTokenAuthorizerEvent,
} from 'aws-lambda';

// Único archivo de handlers Lambda. Cada export va en su propia línea `export const <nombre>`
// (la prueba de infra los lee con /^export const (\w+)/gm) y carga su módulo con import().

type ProxyHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

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
export const quiz: ProxyHandler = notImplemented;
export const chat: ProxyHandler = notImplemented;
export const transcribe: ProxyHandler = notImplemented;
export const admin: ProxyHandler = notImplemented;
