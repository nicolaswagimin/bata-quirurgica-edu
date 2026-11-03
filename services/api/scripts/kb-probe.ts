// Read-only diagnosis of the knowledge base: embeds each question, asks Firestore for the nearest
// chunks and prints their cosine distance next to KB_MAX_DISTANCE. Writes nothing.
// Usage: pnpm run kb-probe -- "pregunta 1" "pregunta 2"
import { pathToFileURL } from 'node:url';
import {
  createFirestoreRetriever,
  embedText,
  KB_CHUNKS,
  KB_DOCUMENTS,
  retrieveBilingual,
  retrieveContext,
} from '../src/lib/kb.ts';

const DEFAULT_QUESTIONS = [
  '¿Se recomienda rasurar el vello antes de una cirugía?',
  'Is hair removal recommended before surgery?',
  '¿Qué exige la Resolución 3100 para habilitar un servicio quirúrgico?',
];

export async function kbProbe(argv: string[]): Promise<number> {
  const questions = argv.filter((a) => a !== '--');
  const { getDb } = await import('../src/lib/identity.ts');
  const db = await getDb();
  const threshold = Number(process.env.KB_MAX_DISTANCE ?? '0.35');

  const docs = await db.collection(KB_DOCUMENTS).get();
  const chunkCount = (await db.collection(KB_CHUNKS).count().get()).data().count;
  console.log(`kbDocuments: ${docs.size} · kbChunks: ${chunkCount} · KB_MAX_DISTANCE=${threshold}`);

  const retriever = createFirestoreRetriever(db);
  for (const question of questions.length > 0 ? questions : DEFAULT_QUESTIONS) {
    const found = await retriever.search(await embedText(question), 5);
    console.log(`\n» ${question}`);
    const model = process.env.GROQ_CHAT_MODEL;
    if (model && (process.env.GROQ_API_KEY || process.env.GROQ_SECRET_ID)) {
      // Same path as the assistant: question + English translation, filtered and merged.
      const { translateForSearch } = await import('../src/lib/assistant-deps.ts');
      let english: string | null = null;
      const kept = await retrieveBilingual(question, {
        search: (q) => retrieveContext(q, { embed: embedText, retriever, maxDistance: threshold }),
        translate: async (q) => {
          english = await translateForSearch(model, q);
          return english;
        },
      });
      console.log(`  traducción: ${english ?? '(sin traducción)'}`);
      console.log(
        `  asistente: ${kept.length} fragmentos pasan (mejor d=${kept[0]?.distance.toFixed(3) ?? '—'})`,
      );
    }
    for (const c of found) {
      const mark = c.distance <= threshold ? 'PASA ' : 'filtra';
      const snippet = c.text.slice(0, 90).replace(/\s+/g, ' ');
      console.log(
        `  ${mark} d=${c.distance.toFixed(3)} ${c.source.org} ${c.source.year} p.${c.page} · ${snippet}…`,
      );
    }
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  kbProbe(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    },
  );
}
