import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

// Lectura perezosa: nunca leer process.env al importar el módulo.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`Missing env: ${name}`);
  return value;
}

export function getProjectId(): string {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error('Missing env: FIREBASE_PROJECT_ID');
  return projectId;
}

let secretsClient: SecretsManagerClient | undefined;
const secretCache = new Map<string, Promise<string>>();

// Cachea el valor en memoria durante la vida del contenedor; nunca loguearlo.
export function getSecretString(secretId: string): Promise<string> {
  const cached = secretCache.get(secretId);
  if (cached) return cached;
  secretsClient ??= new SecretsManagerClient({});
  const pending = secretsClient
    .send(new GetSecretValueCommand({ SecretId: secretId }))
    .then((res) => {
      if (!res.SecretString) throw new Error(`Secret without string value: ${secretId}`);
      return res.SecretString;
    });
  secretCache.set(secretId, pending);
  pending.catch(() => secretCache.delete(secretId));
  return pending;
}
