import type { StreamEvent } from '@bata/shared/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readNdjson, StreamHttpError, streamChat } from '../../src/assistant/stream.ts';
import { pickRecorderMimeType, pickSpanishVoice } from '../../src/assistant/voice.ts';

const EVENTS: StreamEvent[] = [
  { type: 'delta', text: 'La bata se ' },
  { type: 'delta', text: 'amarra atrás — ñandú 🧪' },
  { type: 'citations', items: [{ n: 1, title: 'Guía', org: 'MinSalud', section: '4.2' }] },
  { type: 'done', latencyMs: 120 },
];

function bodyFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function splitAt(bytes: Uint8Array, cuts: number[]): Uint8Array[] {
  const out: Uint8Array[] = [];
  let start = 0;
  for (const cut of [...cuts, bytes.length]) {
    out.push(bytes.slice(start, cut));
    start = cut;
  }
  return out;
}

async function collect(body: ReadableStream<Uint8Array>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of readNdjson(body)) events.push(event);
  return events;
}

const ndjson = new TextEncoder().encode(EVENTS.map((e) => `${JSON.stringify(e)}\n`).join(''));

describe('readNdjson', () => {
  it('yields every event once and in order for every single split point', async () => {
    for (let cut = 1; cut < ndjson.length; cut++) {
      expect(await collect(bodyFromChunks(splitAt(ndjson, [cut])))).toEqual(EVENTS);
    }
  });

  it('handles one byte per chunk, including multi-byte characters', async () => {
    const chunks = Array.from(ndjson, (b) => Uint8Array.of(b));
    expect(await collect(bodyFromChunks(chunks))).toEqual(EVENTS);
  });

  it('holds a trailing partial line until it completes', async () => {
    const line = JSON.stringify(EVENTS[0]);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    const iterator = readNdjson(body);
    const enc = new TextEncoder();
    controller.enqueue(enc.encode(line.slice(0, 10)));
    const pending = iterator.next();
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);
    controller.enqueue(enc.encode(`${line.slice(10)}\n`));
    expect((await pending).value).toEqual(EVENTS[0]);
    controller.close();
    expect((await iterator.next()).done).toBe(true);
  });

  it('accepts a final line without a trailing newline', async () => {
    const text = `${JSON.stringify(EVENTS[0])}\n${JSON.stringify(EVENTS[3])}`;
    const events = await collect(bodyFromChunks([new TextEncoder().encode(text)]));
    expect(events).toEqual([EVENTS[0], EVENTS[3]]);
  });
});

describe('streamChat', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts with the injected token and forwards events', async () => {
    const fetchMock = vi.fn(async () => new Response(bodyFromChunks([ndjson]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const seen: StreamEvent[] = [];
    await streamChat(
      {
        baseUrl: 'https://api.test/v1',
        idToken: 'tok',
        messages: [{ role: 'user', content: 'hola' }],
      },
      (e) => seen.push(e),
    );
    expect(seen).toEqual(EVENTS);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/v1/assistant/chat');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it.each([
    [401, 'Tu sesión expiró, vuelve a iniciar sesión'],
    [429, 'Alcanzaste el límite de mensajes; intenta más tarde'],
  ])('throws the Spanish message for HTTP %i', async (status, message) => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status }));
    const call = streamChat(
      { baseUrl: 'x', idToken: 't', messages: [{ role: 'user', content: 'hola' }] },
      () => undefined,
    );
    await expect(call).rejects.toBeInstanceOf(StreamHttpError);
    await expect(call).rejects.toMatchObject({ status, message });
  });
});

describe('voice helpers', () => {
  it('picks audio/webm when opus is supported, else audio/mp4', () => {
    expect(pickRecorderMimeType((t) => t === 'audio/webm;codecs=opus')).toBe('audio/webm');
    expect(pickRecorderMimeType(() => false)).toBe('audio/mp4');
  });

  it('prefers es-CO, then any es voice, else null', () => {
    const esCo = { lang: 'es-CO', name: 'co' };
    const esEs = { lang: 'es-ES', name: 'es' };
    const en = { lang: 'en-US', name: 'en' };
    expect(pickSpanishVoice([en, esEs, esCo])).toBe(esCo);
    expect(pickSpanishVoice([en, esEs])).toBe(esEs);
    expect(pickSpanishVoice([en])).toBeNull();
    expect(pickSpanishVoice([])).toBeNull();
  });
});
