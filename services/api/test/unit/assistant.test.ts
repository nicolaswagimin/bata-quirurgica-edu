import { createSocket } from 'node:dgram';
import { PassThrough, type Writable } from 'node:stream';
import { StreamEventSchema } from '@bata/shared/schemas';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type Groq from 'groq-sdk';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as entry from '../../src/handlers/entry.ts';
import type { RetrievedChunk } from '../../src/lib/kb.ts';
import { createDogStatsdMetrics, createMemoryMetrics } from '../../src/lib/metrics.ts';
import {
  type ChatDeps,
  handleChatStream,
  handleTranscribe,
  MAX_AUDIO_BYTES,
  REFUSAL_TEXT,
  SYSTEM_PROMPT,
  type TranscribeDeps,
} from '../../src/routes/assistant.ts';

const ORIGIN = 'http://localhost:4173';
const SEPARATOR = Buffer.alloc(8);

const CHUNKS: RetrievedChunk[] = [
  {
    text: 'La bata se ata por detrás.',
    page: 12,
    distance: 0.1,
    source: { title: 'Guía de bioseguridad', org: 'MinSalud', year: 2020 },
  },
  {
    text: 'Higiene de manos antes de vestir.',
    page: 3,
    distance: 0.2,
    source: { title: 'Directrices', org: 'OMS', year: 2009 },
  },
];

// Shim del runtime: escribe el preludio JSON + 8 bytes nulos y devuelve el mismo stream.
beforeAll(() => {
  const shim = {
    streamifyResponse: (fn: unknown) => fn,
    HttpResponseStream: {
      from(stream: Writable, metadata: Record<string, unknown>) {
        stream.write(JSON.stringify(metadata));
        stream.write(SEPARATOR);
        return stream;
      },
    },
  };
  (globalThis as Record<string, unknown>).awslambda = shim;
});
afterAll(() => {
  delete (globalThis as Record<string, unknown>).awslambda;
});

function makeEvent(body: unknown, uid: string | null = 'u1'): APIGatewayProxyEvent {
  return {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    requestContext: { authorizer: uid ? { uid, role: 'student' } : null },
  } as unknown as APIGatewayProxyEvent;
}

const VALID = { messages: [{ role: 'user', content: '¿Cómo se ata la bata?' }] };

type Parsed = { metadata: Record<string, unknown>; body: string };

async function capture(run: (stream: Writable) => Promise<void>): Promise<Parsed> {
  const stream = new PassThrough();
  const parts: Buffer[] = [];
  stream.on('data', (d: Buffer | string) => parts.push(Buffer.from(d)));
  const ended = new Promise<void>((resolve) => stream.on('end', () => resolve()));
  await run(stream);
  await ended;
  const all = Buffer.concat(parts);
  const sep = all.indexOf(SEPARATOR);
  expect(sep).toBeGreaterThan(0);
  return {
    metadata: JSON.parse(all.subarray(0, sep).toString('utf8')) as Record<string, unknown>,
    body: all.subarray(sep + SEPARATOR.length).toString('utf8'),
  };
}

function events(body: string) {
  return body
    .split('\n')
    .filter(Boolean)
    .map((line) => StreamEventSchema.parse(JSON.parse(line)));
}

function groqChat(chunks: unknown[], failAfter?: number) {
  const create = vi.fn(async (_params: Record<string, unknown>) => ({
    async *[Symbol.asyncIterator]() {
      for (const [i, c] of chunks.entries()) {
        if (failAfter !== undefined && i === failAfter) throw new Error('upstream');
        yield c;
      }
    },
  }));
  const client = { chat: { completions: { create } } } as unknown as Groq;
  return { client, create };
}

function chatDeps(overrides: Partial<ChatDeps> = {}) {
  const groq = groqChat([
    { choices: [{ delta: { content: 'Se ata ' } }] },
    { choices: [{ delta: { content: 'por detrás [1].' } }] },
    { choices: [{ delta: {} }], x_groq: { usage: { completion_tokens: 9 } } },
  ]);
  const metrics = createMemoryMetrics();
  let t = 1000;
  const deps: ChatDeps = {
    consumeQuota: vi.fn(async () => true),
    getGroq: vi.fn(async () => groq.client),
    retrieve: vi.fn(async () => CHUNKS),
    model: 'openai/gpt-oss-120b',
    metrics,
    now: () => {
      t += 5;
      return t;
    },
    ...overrides,
  };
  return { deps, metrics, create: groq.create };
}

describe('handleChatStream', () => {
  it('streams prelude, deltas, citations and done', async () => {
    const { deps, metrics, create } = chatDeps();
    const out = await capture((s) => handleChatStream(makeEvent(VALID), s, deps));
    expect(out.metadata).toMatchObject({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Access-Control-Allow-Origin': ORIGIN,
        Vary: 'Origin',
      },
    });
    const evs = events(out.body);
    expect(evs.filter((e) => e.type === 'delta').map((e) => e.type === 'delta' && e.text)).toEqual([
      'Se ata ',
      'por detrás [1].',
    ]);
    expect(evs.at(-2)).toEqual({
      type: 'citations',
      items: [
        { n: 1, title: 'Guía de bioseguridad', org: 'MinSalud', section: 'pág. 12' },
        { n: 2, title: 'Directrices', org: 'OMS', section: 'pág. 3' },
      ],
    });
    expect(evs.at(-1)).toMatchObject({ type: 'done', latencyMs: expect.any(Number) });

    expect(create).toHaveBeenCalledOnce();
    const params = create.mock.calls[0]?.[0] ?? {};
    expect(params).toMatchObject({
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      max_completion_tokens: 700,
      stream: true,
    });
    expect(Object.keys(params).sort()).toEqual(
      ['max_completion_tokens', 'messages', 'model', 'stream', 'temperature'].sort(),
    );
    const msgs = params.messages as { role: string; content: string }[];
    expect(msgs[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
    expect(msgs[1]?.content).toContain('[1] MinSalud — Guía de bioseguridad (2020), pág. 12');

    const names = metrics.calls.map((c) => c.name);
    for (const n of ['groq.ttft_ms', 'groq.total_ms', 'kb.retrieval_ms'] as const) {
      expect(names).toContain(n);
    }
    expect(metrics.calls.find((c) => c.name === 'groq.completion_tokens')?.value).toBe(9);
    expect(metrics.flushes).toBeGreaterThan(0);
  });

  it('answers 429 when quota is exhausted without Groq or retrieval', async () => {
    const { deps, metrics, create } = chatDeps({ consumeQuota: vi.fn(async () => false) });
    const out = await capture((s) => handleChatStream(makeEvent(VALID), s, deps));
    expect(out.metadata).toMatchObject({
      statusCode: 429,
      headers: { 'Access-Control-Allow-Origin': ORIGIN },
    });
    expect(JSON.parse(out.body)).toMatchObject({ error: { code: 'QUOTA_EXCEEDED' } });
    expect(metrics.calls.map((c) => c.name)).toContain('assistant.quota_rejections');
    expect(create).not.toHaveBeenCalled();
    expect(deps.retrieve).not.toHaveBeenCalled();
  });

  it('refuses without calling Groq when retrieval finds nothing', async () => {
    const { deps, create } = chatDeps({ retrieve: vi.fn(async () => []) });
    const out = await capture((s) => handleChatStream(makeEvent(VALID), s, deps));
    const evs = events(out.body);
    expect(evs).toEqual([
      { type: 'delta', text: REFUSAL_TEXT },
      { type: 'citations', items: [] },
      { type: 'done', latencyMs: expect.any(Number) },
    ]);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['no authorizer', makeEvent(VALID, null), 401, 'UNAUTHORIZED'],
    [
      'more than 10 messages',
      makeEvent({ messages: Array.from({ length: 11 }, () => VALID.messages[0]) }),
      422,
      'VALIDATION_ERROR',
    ],
    [
      'message over 2000 chars',
      makeEvent({ messages: [{ role: 'user', content: 'a'.repeat(2001) }] }),
      422,
      'VALIDATION_ERROR',
    ],
  ])('rejects %s', async (_label, event, status, code) => {
    const { deps } = chatDeps();
    const out = await capture((s) => handleChatStream(event, s, deps));
    expect(out.metadata).toMatchObject({
      statusCode: status,
      headers: { 'Access-Control-Allow-Origin': ORIGIN },
    });
    expect(JSON.parse(out.body)).toMatchObject({ error: { code } });
    expect(deps.consumeQuota).not.toHaveBeenCalled();
  });

  it('emits UPSTREAM_ERROR when Groq fails mid-stream', async () => {
    const groq = groqChat([{ choices: [{ delta: { content: 'Hola' } }] }, {}], 1);
    const { deps } = chatDeps({ getGroq: async () => groq.client });
    const out = await capture((s) => handleChatStream(makeEvent(VALID), s, deps));
    const evs = events(out.body);
    expect(evs.at(0)).toEqual({ type: 'delta', text: 'Hola' });
    expect(evs.at(-1)).toEqual({ type: 'error', code: 'UPSTREAM_ERROR' });
  });
});

function transcribeDeps(overrides: Partial<TranscribeDeps> = {}) {
  const create = vi.fn(async (_params: Record<string, unknown>) => ({ text: 'hola bata' }));
  const client = { audio: { transcriptions: { create } } } as unknown as Groq;
  const metrics = createMemoryMetrics();
  const deps: TranscribeDeps = {
    consumeQuota: vi.fn(async () => true),
    getGroq: async () => client,
    model: 'whisper-large-v3-turbo',
    metrics,
    now: Date.now,
    ...overrides,
  };
  return { deps, create, metrics };
}

const AUDIO = {
  mimeType: 'audio/webm',
  audioBase64: Buffer.from('fake-audio').toString('base64'),
};

describe('handleTranscribe', () => {
  it('transcribes valid audio in Spanish', async () => {
    const { deps, create, metrics } = transcribeDeps();
    const res = await handleTranscribe(makeEvent(AUDIO), deps);
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe(ORIGIN);
    expect(JSON.parse(res.body)).toEqual({ text: 'hola bata' });
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: 'whisper-large-v3-turbo',
      language: 'es',
    });
    expect(metrics.calls.map((c) => c.name)).toContain('stt.latency_ms');
  });

  it('answers 413 when decoded audio exceeds 2 MB', async () => {
    const { deps, create } = transcribeDeps();
    const big = Buffer.alloc(MAX_AUDIO_BYTES + 1).toString('base64');
    const res = await handleTranscribe(
      makeEvent({ mimeType: 'audio/mp4', audioBase64: big }),
      deps,
    );
    expect(res.statusCode).toBe(413);
    expect(JSON.parse(res.body)).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('answers 429 when stt quota is exhausted', async () => {
    const { deps, create, metrics } = transcribeDeps({ consumeQuota: vi.fn(async () => false) });
    const res = await handleTranscribe(makeEvent(AUDIO), deps);
    expect(res.statusCode).toBe(429);
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe(ORIGIN);
    expect(JSON.parse(res.body)).toMatchObject({ error: { code: 'QUOTA_EXCEEDED' } });
    expect(create).not.toHaveBeenCalled();
    expect(metrics.calls).toContainEqual(
      expect.objectContaining({ name: 'assistant.quota_rejections', tags: { kind: 'stt' } }),
    );
  });
});

describe('metrics', () => {
  it('sends DogStatsD distributions with stage tag', async () => {
    const server = createSocket('udp4');
    const received = new Promise<string>((resolve) =>
      server.on('message', (msg) => resolve(msg.toString())),
    );
    await new Promise<void>((resolve) => server.bind(0, '127.0.0.1', () => resolve()));
    const metrics = createDogStatsdMetrics({ port: server.address().port });
    metrics.distribution('groq.ttft_ms', 42, { model: 'm' });
    await metrics.flush();
    expect(await received).toBe('groq.ttft_ms:42|d|#model:m,stage:test');
    server.close();
  });
});

describe('entry', () => {
  it('exports chat and transcribe as functions', () => {
    expect(typeof entry.chat).toBe('function');
    expect(typeof entry.transcribe).toBe('function');
  });
});
