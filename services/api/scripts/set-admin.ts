import { pathToFileURL } from 'node:url';
import { getAdminAuth, getDb } from '../src/lib/identity.ts';

// Contrato verificado por `grep` en E2-T1: no traducir ni adornar.
const USAGE = 'Uso: set-admin <correo>';

// Marca a un usuario existente de Firebase Auth como admin (claim + perfil si existe).
export async function setAdmin(email: string): Promise<void> {
  const auth = await getAdminAuth();
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: 'admin' });
  const db = await getDb();
  const ref = db.doc(`users/${user.uid}`);
  if ((await ref.get()).exists) {
    await ref.update({ role: 'admin', updatedAt: new Date().toISOString() });
  }
}

async function main(argv: string[]): Promise<number> {
  const args = argv.filter((arg) => arg !== '--');
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const email = args[0];
  if (!email) {
    console.error(USAGE);
    return 2;
  }
  await setAdmin(email);
  console.log(`Listo: ${email} ahora es admin. Debe cerrar sesión y volver a entrar.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    },
  );
}
