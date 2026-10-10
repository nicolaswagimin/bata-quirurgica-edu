import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SeedFileSchema } from '@bata/shared/schemas';
import type { Firestore } from 'firebase-admin/firestore';
import { getDb } from '../src/lib/identity.ts';
import type { QuestionDoc } from '../src/lib/repos.ts';

export const DEFAULT_SEED_FILE = fileURLToPath(
  new URL('../../../content/questions/seed.json', import.meta.url),
);

// Idempotente: ids fijos y `set`. Toda pregunta entra como `draft` hasta su validación.
export async function seedContent(db: Firestore, file: string): Promise<void> {
  const seed = SeedFileSchema.parse(JSON.parse(await readFile(file, 'utf8')));
  const batch = db.batch();
  for (const { id, ...mission } of seed.missions) {
    const questionIds = seed.questions.filter((q) => q.missionId === id).map((q) => q.id);
    batch.set(db.doc(`missions/${id}`), { ...mission, questionIds });
  }
  for (const { id, correctOptionIds, ...body } of seed.questions) {
    const question: QuestionDoc = {
      ...body,
      status: 'draft',
      createdBy: 'seed',
      validatedBy: null,
      validatedAt: null,
    };
    batch.set(db.doc(`questions/${id}`), question);
    batch.set(db.doc(`questionKeys/${id}`), { correctOptionIds });
  }
  batch.set(db.doc('appConfig/flags'), {
    showDraftQuestions: process.env.SHOW_DRAFT_QUESTIONS === 'true',
  });
  await batch.commit();
}

async function main(argv: string[]): Promise<number> {
  const args = argv.filter((arg) => arg !== '--');
  if (!process.env.FIRESTORE_EMULATOR_HOST && !args.includes('--allow-remote')) {
    console.error(
      'FIRESTORE_EMULATOR_HOST no está definido. Usa --allow-remote para un proyecto real.',
    );
    return 2;
  }
  await seedContent(await getDb(), DEFAULT_SEED_FILE);
  console.log(`Seed cargado desde ${DEFAULT_SEED_FILE}`);
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
