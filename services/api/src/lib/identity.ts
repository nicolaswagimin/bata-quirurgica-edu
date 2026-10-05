import type { Role } from '@bata/shared/schemas';
import type { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { getProjectId, getSecretString, requireEnv } from './config.ts';

let appPromise: Promise<App> | undefined;

// Emulador → solo projectId; en AWS, credencial desde el secreto de la cuenta de servicio.
export function getAdminApp(): Promise<App> {
  appPromise ??= (async () => {
    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const existing = getApps()[0];
    if (existing) return existing;
    const projectId = getProjectId();
    if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      return initializeApp({ projectId });
    }
    const serviceAccount = JSON.parse(await getSecretString(requireEnv('FIREBASE_SA_SECRET_ID')));
    return initializeApp({ credential: cert(serviceAccount), projectId });
  })();
  appPromise.catch(() => {
    appPromise = undefined;
  });
  return appPromise;
}

export async function getDb(): Promise<Firestore> {
  const [app, { getFirestore }] = await Promise.all([
    getAdminApp(),
    import('firebase-admin/firestore'),
  ]);
  return getFirestore(app);
}

export async function getAdminAuth(): Promise<Auth> {
  const [app, { getAuth }] = await Promise.all([getAdminApp(), import('firebase-admin/auth')]);
  return getAuth(app);
}

export type VerifiedToken = { uid: string; role?: unknown };

export type AuthorizerDeps = {
  verify: (idToken: string) => Promise<VerifiedToken>;
  loadGroupId: (uid: string) => Promise<string | null>;
};

// `arn:aws:execute-api:<region>:<account>:<apiId>/<stage>/<METHOD>/<path>` → `<...apiId>/v1/*/*`.
// La política cubre toda la etapa porque la caché del autorizador (300 s) se comparte entre rutas.
export function stageWildcardArn(methodArn: string): string {
  const [apiArn = ''] = methodArn.split('/');
  return `${apiArn}/v1/*/*`;
}

export function createAuthorizer(deps: AuthorizerDeps) {
  return async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
    const match = /^Bearer (\S+)$/.exec(event.authorizationToken ?? '');
    if (!match?.[1]) throw new Error('Unauthorized');
    let decoded: VerifiedToken;
    try {
      decoded = await deps.verify(match[1]);
    } catch {
      throw new Error('Unauthorized');
    }
    if (!decoded.uid) throw new Error('Unauthorized');
    const role: Role = decoded.role === 'admin' ? 'admin' : 'student';
    const groupId = (await deps.loadGroupId(decoded.uid)) ?? '';
    return {
      principalId: decoded.uid,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: stageWildcardArn(event.methodArn),
          },
        ],
      },
      context: { uid: decoded.uid, role, groupId },
    };
  };
}
