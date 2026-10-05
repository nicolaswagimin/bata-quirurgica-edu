import { type Role, RoleSchema } from '@bata/shared/schemas';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  signOut as firebaseSignOut,
  getAuth,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

const EnvSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
  VITE_USE_EMULATORS: z.enum(['true', 'false']).default('false'),
  VITE_API_BASE_URL: z.url(),
});

function readEnv() {
  const parsed = EnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Configuración web inválida (revisa apps/web/.env*): ${keys}`);
  }
  return parsed.data;
}

export const env = readEnv();

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);

if (env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

type AuthState = {
  user: User | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function readRole(user: User): Promise<Role> {
  const { claims } = await user.getIdTokenResult();
  const role = RoleSchema.safeParse(claims.role);
  return role.success ? role.data : 'student';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next);
        if (!next) {
          setRole(null);
          setLoading(false);
          return;
        }
        readRole(next)
          .then(setRole)
          .catch(() => setRole('student'))
          .finally(() => setLoading(false));
      }),
    [],
  );

  const value = useMemo<AuthState>(
    () => ({ user, role, loading, signOut: () => firebaseSignOut(auth) }),
    [user, role, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
