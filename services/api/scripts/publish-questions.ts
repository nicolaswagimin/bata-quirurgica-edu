// Publishes quiz questions: marks drafts as `validated` (who and when) through the same repository
// function the admin panel uses. In production the quiz only shows validated questions.
//
//   pnpm run publish-questions -- --all --validado-por "Nombre" [--dry-run] [--allow-remote]
//   pnpm run publish-questions -- q01 q02 --validado-por "Nombre"
//
// WARNING: `seed` resets every question to `draft`; never run it against production afterwards.
import { pathToFileURL } from 'node:url';
import type { Firestore } from 'firebase-admin/firestore';
import { validateQuestionTx } from '../src/lib/repos.ts';

export type PublishOptions = {
  db: Firestore;
  ids: string[] | 'all';
  by: string;
  now: Date;
  dryRun?: boolean;
  log?: (line: string) => void;
};

export type PublishResult = { published: string[]; alreadyValidated: string[]; missing: string[] };

export async function publishQuestions(opts: PublishOptions): Promise<PublishResult> {
  const log = opts.log ?? console.log;
  const snap = await opts.db.collection('questions').get();
  const status = new Map(snap.docs.map((d) => [d.id, d.get('status') as string]));
  const wanted = opts.ids === 'all' ? [...status.keys()].sort() : opts.ids;

  const result: PublishResult = { published: [], alreadyValidated: [], missing: [] };
  for (const id of wanted) {
    const current = status.get(id);
    if (current === undefined) {
      result.missing.push(id);
      log(`no existe: ${id}`);
    } else if (current === 'validated') {
      result.alreadyValidated.push(id);
    } else {
      if (!opts.dryRun) {
        await validateQuestionTx(opts.db, { id, uid: opts.by, now: opts.now.toISOString() });
      }
      result.published.push(id);
      log(`${opts.dryRun ? 'se publicaría' : 'publicada'}: ${id}`);
    }
  }
  log(
    `${opts.dryRun ? '[dry-run] ' : ''}${result.published.length} publicadas · ` +
      `${result.alreadyValidated.length} ya estaban validadas · ${result.missing.length} no existen`,
  );
  return result;
}

export async function main(argv: string[]): Promise<number> {
  const args = argv.filter((arg) => arg !== '--');
  const byIndex = args.indexOf('--validado-por');
  const by = byIndex >= 0 ? args[byIndex + 1] : undefined;
  const flags = new Set(['--all', '--dry-run', '--allow-remote', '--validado-por']);
  const ids = args.filter((a, i) => !flags.has(a) && i !== byIndex + 1);
  if (!by) {
    console.error('Falta --validado-por "Nombre de quien validó las preguntas".');
    return 2;
  }
  if (!args.includes('--all') && ids.length === 0) {
    console.error('Indica --all o los ids de las preguntas a publicar.');
    return 2;
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST && !args.includes('--allow-remote')) {
    console.error(
      'FIRESTORE_EMULATOR_HOST no está definido. Usa --allow-remote para un proyecto real.',
    );
    return 2;
  }
  const { getDb } = await import('../src/lib/identity.ts');
  const result = await publishQuestions({
    db: await getDb(),
    ids: args.includes('--all') ? 'all' : ids,
    by,
    now: new Date(),
    dryRun: args.includes('--dry-run'),
  });
  return result.missing.length > 0 ? 1 : 0;
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
