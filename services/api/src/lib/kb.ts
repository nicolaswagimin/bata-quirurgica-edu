import type { Firestore } from 'firebase-admin/firestore';

export const EMBED_MODEL_ID = 'amazon.titan-embed-text-v2:0';
export const EMBED_DIMENSIONS = 1024;
export const KB_CHUNKS = 'kbChunks';
export const KB_DOCUMENTS = 'kbDocuments';

export type PageText = { page: number; text: string };
export type Chunk = { page: number; index: number; text: string };

export type RetrievedChunk = {
  text: string;
  page: number;
  distance: number;
  source: { title: string; org: string; year: number };
};

export interface Retriever {
  search(vector: number[], k: number): Promise<RetrievedChunk[]>;
}

// Subconjunto del cliente Bedrock que usamos; permite inyectar un doble en pruebas.
export type BedrockLike = { send(command: unknown): Promise<{ body?: Uint8Array }> };
export type EmbedMetrics = { distribution(name: 'bedrock.embed_ms', value: number): void };

// Fragmenta cada página por separado: ventanas de `size` caracteres que se solapan `overlap`.
export function chunkPages(
  pages: PageText[],
  { size = 800, overlap = 150 }: { size?: number; overlap?: number } = {},
): Chunk[] {
  if (overlap >= size) throw new Error('overlap debe ser menor que size');
  const chunks: Chunk[] = [];
  for (const { page, text } of pages) {
    const clean = text.replace(/\s+/g, ' ').trim();
    let index = 0;
    for (let start = 0; start < clean.length; start += size - overlap) {
      chunks.push({ page, index: index++, text: clean.slice(start, start + size) });
      if (start + size >= clean.length) break;
    }
  }
  return chunks;
}

let defaultClient: Promise<BedrockLike> | undefined;

function getBedrockClient(): Promise<BedrockLike> {
  defaultClient ??= import('@aws-sdk/client-bedrock-runtime').then(
    ({ BedrockRuntimeClient }) => new BedrockRuntimeClient({}),
  );
  return defaultClient;
}

export async function embedText(
  text: string,
  { client, metrics }: { client?: BedrockLike; metrics?: EmbedMetrics } = {},
): Promise<number[]> {
  const { InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
  const bedrock = client ?? (await getBedrockClient());
  const start = Date.now();
  const res = await bedrock.send(
    new InvokeModelCommand({
      modelId: EMBED_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ inputText: text, dimensions: EMBED_DIMENSIONS, normalize: true }),
    }),
  );
  metrics?.distribution('bedrock.embed_ms', Date.now() - start);
  const parsed = JSON.parse(new TextDecoder().decode(res.body)) as { embedding?: unknown };
  const embedding = parsed.embedding;
  if (
    !Array.isArray(embedding) ||
    embedding.length !== EMBED_DIMENSIONS ||
    !embedding.every((n) => typeof n === 'number')
  ) {
    throw new Error('Respuesta de embeddings inválida');
  }
  return embedding as number[];
}

type ChunkDoc = {
  text: string;
  page: number;
  title: string;
  org: string;
  year: number;
  distance?: number;
};

export function createFirestoreRetriever(db: Firestore): Retriever {
  return {
    async search(vector, k) {
      const snap = await db
        .collection(KB_CHUNKS)
        .findNearest({
          vectorField: 'embedding',
          queryVector: vector,
          limit: k,
          distanceMeasure: 'COSINE',
          distanceResultField: 'distance',
        })
        .get();
      return snap.docs.map((doc) => {
        const d = doc.data() as ChunkDoc;
        return {
          text: d.text,
          page: d.page,
          distance: d.distance ?? Number.POSITIVE_INFINITY,
          source: { title: d.title, org: d.org, year: d.year },
        };
      });
    },
  };
}

export type MemoryChunk = Omit<RetrievedChunk, 'distance'> & { embedding: number[] };

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 1;
  return 1 - dot / Math.sqrt(na * nb);
}

// Recuperador en memoria (coseno exacto) para pruebas y desarrollo sin Firestore.
export function createMemoryRetriever(chunks: MemoryChunk[]): Retriever {
  return {
    async search(vector, k) {
      return chunks
        .map(({ embedding, ...rest }) => ({ ...rest, distance: cosineDistance(vector, embedding) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, k);
    },
  };
}

export async function retrieveContext(
  query: string,
  {
    embed,
    retriever,
    maxDistance,
    k = 5,
  }: {
    embed: (text: string) => Promise<number[]>;
    retriever: Retriever;
    maxDistance: number;
    k?: number;
  },
): Promise<RetrievedChunk[]> {
  const vector = await embed(query);
  const found = await retriever.search(vector, k);
  return found
    .filter((chunk) => chunk.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);
}
