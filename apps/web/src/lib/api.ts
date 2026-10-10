import { ErrorEnvelopeSchema, messageForStatus, RoleSchema } from '@bata/shared/schemas';
import { useQuery } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { z } from 'zod';
import { auth, env, useAuth } from './firebase.tsx';

// Shown by the login page after a forced sign-out so the user sees why the session ended.
const AUTH_NOTICE_KEY = 'bata.authNotice';

export function readAuthNotice(): string | null {
  try {
    return sessionStorage.getItem(AUTH_NOTICE_KEY);
  } catch {
    return null;
  }
}

export function clearAuthNotice(): void {
  try {
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiInit = { method?: string; body?: unknown };

async function send(path: string, init: ApiInit, forceRefresh: boolean): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, messageForStatus(401));
  const token = await user.getIdToken(forceRefresh);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${env.VITE_API_BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function errorCode(res: Response): Promise<string | undefined> {
  const parsed = ErrorEnvelopeSchema.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data.error.code : undefined;
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  let res = await send(path, init, false);
  if (res.status === 401) res = await send(path, init, true);
  if (res.status === 401) {
    const message = messageForStatus(401);
    try {
      sessionStorage.setItem(AUTH_NOTICE_KEY, message);
    } catch {
      // Storage may be unavailable; the sign-out still happens.
    }
    await signOut(auth);
    throw new ApiError(401, message, 'UNAUTHORIZED');
  }
  if (!res.ok) throw new ApiError(res.status, messageForStatus(res.status), await errorCode(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Fields of `users/{uid}` the web shows (GET /me).
export const ProfileSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  role: RoleSchema,
  groupId: z.string().nullable(),
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
  streakDays: z.number().int().min(0),
});
export type Profile = z.infer<typeof ProfileSchema>;

// `null` means the user has no profile yet (GET /me → 404).
export function useMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['me', user?.uid],
    enabled: Boolean(user),
    retry: false,
    queryFn: async (): Promise<Profile | null> => {
      try {
        return ProfileSchema.parse(await apiFetch<unknown>('/me'));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}
