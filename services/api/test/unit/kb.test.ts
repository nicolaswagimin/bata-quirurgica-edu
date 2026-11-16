import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import { ingestKb } from '../../scripts/ingest-kb.ts';
import {
  type BedrockLike,
  chunkPages,
  createFirestoreRetriever,
  createMemoryRetriever,
  EMBED_MODEL_ID,
  embedText,
  type MemoryChunk,
  rankChunks,
  retrieveContext,
  retrieveWithFallback,
} from '../../src/lib/kb.ts';

const SOURCE = { title: 'Guía', org: 'OMS', year: 2009 };

function at<T>(list: T[], i: number): T {
  const item = list[i];
  if (item === undefined) throw new Error(`sin elemento ${i}`);
  return item;
}

function unit(angle: number): number[] {
  return [Math.cos(angle), Math.sin(angle), 0];
}

function chunk(text: string, angle: number): MemoryChunk {
  return { text, page: 1, source: SOURCE, embedding: unit(angle) };
}

describe('chunkPages', () => {
  it('emits overlapping chunks of at most 800 chars that keep their page', () => {
    const text = Array.from({ length: 2000 }, (_, i) => String.fromCharCode(97 + (i % 26))).join(
      '',
    );
    const chunks = chunkPages([
      { page: 3, text },
      { page: 4, text: 'corto' },
    ]);
    const page3 = chunks.filter((c) => c.page === 3);
    expect(page3.length).toBe(3);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(800);
    for (let i = 1; i < page3.length; i++) {
      expect(at(page3, i).text.slice(0, 150)).toBe(at(page3, i - 1).text.slice(-150));
    }
    expect(page3.map((c) => c.text).join('').length).toBeGreaterThanOrEqual(2000);
    expect(chunks.at(-1)).toEqual({ page: 4, index: 0, text: 'corto' });
  });

  it('skips empty pages', () => {
    expect(chunkPages([{ page: 1, text: '   ' }])).toEqual([]);
  });
});

describe('embedText', () => {
  it('invokes Titan V2 with 1024 normalized dimensions', async () => {
    const embedding = Array.from({ length: 1024 }, (_, i) => i / 1024);
    const send = vi.fn(async (_cmd: unknown) => ({
      body: new TextEncoder().encode(JSON.stringify({ embedding })),
    }));
    const metrics = { distribution: vi.fn() };
    const result = await embedText('bata estéril', { client: { send }, metrics });

    expect(result).toEqual(embedding);
    const input = (at(send.mock.calls, 0)[0] as { input: { modelId: string; body: string } }).input;
    expect(input.modelId).toBe(EMBED_MODEL_ID);
    expect(input.modelId).toBe('amazon.titan-embed-text-v2:0');
    expect(JSON.parse(input.body)).toEqual({
      inputText: 'bata estéril',
      dimensions: 1024,
      normalize: true,
    });
    expect(metrics.distribution).toHaveBeenCalledWith('bedrock.embed_ms', expect.any(Number));
  });
});

describe('retrieveContext', () => {
  const chunks = [0.9, 0.1, 0.3, 0.05, 0.2, 0.15, 0.25, 1.5].map((a, i) => chunk(`c${i}`, a));
  const retriever = createMemoryRetriever(chunks);
  const embed = async () => unit(0);

  it('returns at most 5 chunks by ascending distance under the threshold', async () => {
    const found = await retrieveContext('q', { embed, retriever, maxDistance: 0.35 });
    expect(found.map((c) => c.text)).toEqual(['c3', 'c1', 'c5', 'c4', 'c6']);
    for (let i = 1; i < found.length; i++) {
      expect(at(found, i).distance).toBeGreaterThanOrEqual(at(found, i - 1).distance);
    }
  });

  it('drops chunks whose distance exceeds maxDistance', async () => {
    const maxDistance = 1 - Math.cos(0.12);
    const found = await retrieveContext('q', { embed, retriever, maxDistance });
    expect(found.map((c) => c.text)).toEqual(['c3', 'c1']);
  });

  it('returns an empty list when nothing passes the threshold', async () => {
    const far = createMemoryRetriever([chunk('lejos', Math.PI / 2)]);
    expect(await retrieveContext('q', { embed, retriever: far, maxDistance: 0.35 })).toEqual([]);
  });
});

describe('createFirestoreRetriever', () => {
  it('queries findNearest on kbChunks with cosine distance', async () => {
    const get = vi.fn(async () => ({
      docs: [{ data: () => ({ text: 't', page: 2, distance: 0.1, ...SOURCE }) }],
    }));
    const findNearest = vi.fn(() => ({ get }));
    const collection = vi.fn(() => ({ findNearest }));
    const db = { collection } as unknown as Firestore;

    const found = await createFirestoreRetriever(db).search([1, 0, 0], 5);

    expect(collection).toHaveBeenCalledWith('kbChunks');
    expect(findNearest).toHaveBeenCalledWith({
      vectorField: 'embedding',
      queryVector: [1, 0, 0],
      limit: 5,
      distanceMeasure: 'COSINE',
      distanceResultField: 'distance',
    });
    expect(found).toEqual([{ text: 't', page: 2, distance: 0.1, source: SOURCE }]);
  });
});

describe('ingestKb --dry-run', () => {
  it('lists missing PDFs without touching Bedrock or Firestore', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kb-'));
    const sourcesFile = join(dir, 'sources.json');
    writeFileSync(
      sourcesFile,
      JSON.stringify({
        note: 'n',
        documents: [
          { id: 'who-safe-surgery-2009', ...SOURCE, file: 'a.pdf', language: 'en' },
          { id: 'otra-guia', ...SOURCE, file: 'b.pdf', language: 'es' },
        ],
      }),
    );
    const send = vi.fn();
    const bedrock: BedrockLike = { send };
    const collection = vi.fn();
    const doc = vi.fn();
    const batch = vi.fn();
    const db = { collection, doc, batch } as unknown as Firestore;
    const lines: string[] = [];

    await ingestKb({
      dryRun: true,
      bedrock,
      db,
      log: (l) => lines.push(l),
      sourcesFile,
      pdfDir: join(dir, 'pdfs'),
    });

    expect(lines).toEqual(['faltante: who-safe-surgery-2009', 'faltante: otra-guia']);
    expect(send).not.toHaveBeenCalled();
    expect(collection).not.toHaveBeenCalled();
    expect(doc).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });
});

describe('retrieveWithFallback', () => {
  // Banco con un fragmento correcto lejos en el espacio (distancia 0.5) y uno ruido muy cerca.
  const chunks: MemoryChunk[] = [
    { text: 'El enguantado es de técnica cerrada.', page: 4, source: SOURCE, embedding: unit(0) },
    { text: 'Texto sin relación con la consulta.', page: 9, source: SOURCE, embedding: unit(1.5) },
  ];
  // Consulta girada respecto a ambos fragmentos: nada coincide exactamente con el vector.
  const embed = async () => unit(0.7);
  const retriever = createMemoryRetriever(chunks);

  it('uses the strict threshold first and marks the result as strong', async () => {
    const found = await retrieveWithFallback('enguantado tecnica cerrada', {
      embed,
      retriever,
      maxDistance: 0.6,
      k: 2,
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]?.relevance).toBe('strong');
  });

  it('relaxes the threshold instead of returning nothing', async () => {
    const found = await retrieveWithFallback('enguantado tecnica cerrada', {
      embed,
      retriever,
      maxDistance: 0.05,
      k: 2,
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((c) => c.relevance === 'weak')).toBe(true);
  });

  it('always returns the nearest chunks when nothing passes any threshold', async () => {
    const found = await retrieveWithFallback('consulta sin relación', {
      embed,
      retriever,
      maxDistance: 0,
      k: 2,
      relaxedFactor: 1,
    });
    expect(found).toHaveLength(2);
    expect(found.every((c) => c.relevance === 'weak')).toBe(true);
  });

  it('returns an empty list only when the bank is empty', async () => {
    const found = await retrieveWithFallback('cualquier cosa', {
      embed,
      retriever: createMemoryRetriever([]),
      maxDistance: 0.3,
    });
    expect(found).toEqual([]);
  });
});

describe('rankChunks', () => {
  it('prefers a chunk that shares the query terms over a slightly closer one', () => {
    const lexical: MemoryChunk = {
      text: 'La solapa envolvente se cierra al final.',
      page: 6,
      source: SOURCE,
      embedding: unit(0),
    };
    const near: MemoryChunk = {
      text: 'Contenido genérico sobre higiene.',
      page: 1,
      source: SOURCE,
      embedding: unit(0),
    };
    const ranked = rankChunks(
      'solapa envolvente',
      [
        { text: near.text, page: near.page, distance: 0.3, source: SOURCE },
        { text: lexical.text, page: lexical.page, distance: 0.34, source: SOURCE },
      ],
      2,
    );
    expect(ranked[0]?.text).toBe(lexical.text);
  });
});
