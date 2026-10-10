import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { type KbSource, KbSourcesSchema } from '@bata/shared/schemas';
import type { Firestore } from 'firebase-admin/firestore';
import {
  type BedrockLike,
  chunkPages,
  embedText,
  KB_CHUNKS,
  KB_DOCUMENTS,
  type PageText,
} from '../src/lib/kb.ts';

export const DEFAULT_SOURCES_FILE = fileURLToPath(
  new URL('../../../content/kb/sources.json', import.meta.url),
);
export const DEFAULT_PDF_DIR = fileURLToPath(new URL('../../../content/kb/pdfs/', import.meta.url));

const BATCH_SIZE = 400;

export type IngestDeps = {
  dryRun: boolean;
  bedrock?: BedrockLike;
  db?: Firestore;
  log?: (line: string) => void;
  sourcesFile?: string;
  pdfDir?: string;
};

async function readPages(file: string): Promise<PageText[]> {
  const { extractText } = await import('unpdf');
  const { text } = await extractText(new Uint8Array(await readFile(file)), { mergePages: false });
  return text.map((pageText, i) => ({ page: i + 1, text: pageText }));
}

async function replaceChunks(
  db: Firestore,
  source: KbSource,
  pages: PageText[],
  bedrock?: BedrockLike,
) {
  const { FieldValue } = await import('firebase-admin/firestore');
  const chunks = chunkPages(pages, { size: 800, overlap: 150 });

  const previous = await db.collection(KB_CHUNKS).where('docId', '==', source.id).get();
  for (let i = 0; i < previous.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const doc of previous.docs.slice(i, i + BATCH_SIZE)) batch.delete(doc.ref);
    await batch.commit();
  }

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const chunk of chunks.slice(i, i + BATCH_SIZE)) {
      const embedding = await embedText(chunk.text, { client: bedrock });
      const id = `${source.id}-p${String(chunk.page).padStart(4, '0')}-c${String(chunk.index).padStart(2, '0')}`;
      batch.set(db.doc(`${KB_CHUNKS}/${id}`), {
        docId: source.id,
        text: chunk.text,
        page: chunk.page,
        title: source.title,
        org: source.org,
        year: source.year,
        embedding: FieldValue.vector(embedding),
      });
    }
    await batch.commit();
  }

  await db.doc(`${KB_DOCUMENTS}/${source.id}`).set({
    title: source.title,
    org: source.org,
    year: source.year,
    file: source.file,
    language: source.language,
    pages: pages.length,
    chunks: chunks.length,
    ingestedAt: new Date().toISOString(),
  });
  return chunks.length;
}

// Ingresa a Firestore los PDFs presentes; en dry-run solo informa cuáles faltan.
export async function ingestKb(deps: IngestDeps): Promise<void> {
  const log = deps.log ?? console.log;
  const sources = KbSourcesSchema.parse(
    JSON.parse(await readFile(deps.sourcesFile ?? DEFAULT_SOURCES_FILE, 'utf8')),
  );
  const pdfDir = deps.pdfDir ?? DEFAULT_PDF_DIR;

  for (const source of sources.documents) {
    const file = join(pdfDir, source.file);
    if (!existsSync(file)) {
      log(`faltante: ${source.id}`);
      continue;
    }
    if (deps.dryRun) {
      const pages = await readPages(file);
      log(`presente: ${source.id} (${chunkPages(pages).length} fragmentos)`);
      continue;
    }
    if (!deps.db) throw new Error('ingestKb requiere Firestore fuera de --dry-run');
    const n = await replaceChunks(deps.db, source, await readPages(file), deps.bedrock);
    log(`presente: ${source.id} (${n} fragmentos)`);
  }
}

async function main(argv: string[]): Promise<number> {
  const args = argv.filter((arg) => arg !== '--');
  const dryRun = args.includes('--dry-run');
  let db: Firestore | undefined;
  if (!dryRun) {
    const { getDb } = await import('../src/lib/identity.ts');
    db = await getDb();
  }
  await ingestKb({ dryRun, db });
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
