import { createSocket, type Socket } from 'node:dgram';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDatadogLambdaMetrics,
  createDogStatsdMetrics,
  createMemoryMetrics,
  createMetrics,
} from '../../src/lib/metrics.ts';

function listen(port: number): Promise<Socket | null> {
  return new Promise((resolve) => {
    const socket = createSocket('udp4');
    socket.once('error', () => {
      socket.close();
      resolve(null);
    });
    socket.bind(port, '127.0.0.1', () => resolve(socket));
  });
}

function nextDatagram(socket: Socket): Promise<string> {
  return new Promise((resolve) => socket.once('message', (msg) => resolve(msg.toString())));
}

describe('metrics', () => {
  let socket: Socket | null = null;

  beforeEach(() => {
    vi.stubEnv('STAGE', 'test');
    vi.stubEnv('DD_LAMBDA_HANDLER', '');
  });

  afterEach(() => {
    socket?.close();
    socket = null;
    vi.unstubAllEnvs();
  });

  it('sends a DogStatsD distribution datagram over UDP (ephemeral port)', async () => {
    socket = await listen(0);
    if (!socket) throw new Error('No se pudo abrir un socket UDP local');
    const received = nextDatagram(socket);
    const metrics = createDogStatsdMetrics({ port: socket.address().port });
    metrics.distribution('groq.ttft_ms', 123, { model: 'openai/gpt-oss-120b' });
    await metrics.flush();
    expect(await received).toBe('groq.ttft_ms:123|d|#model:openai/gpt-oss-120b,stage:test');
  });

  it('defaults to 127.0.0.1:8125 when that port is free', async (ctx) => {
    const bound = await listen(8125);
    if (!bound) return ctx.skip();
    socket = bound;
    const received = nextDatagram(bound);
    const metrics = createDogStatsdMetrics();
    metrics.distribution('groq.ttft_ms', 123, { model: 'openai/gpt-oss-120b' });
    await metrics.flush();
    expect(await received).toBe('groq.ttft_ms:123|d|#model:openai/gpt-oss-120b,stage:test');
  });

  it('sends key:value tags through datadog-lambda-js', () => {
    const send = vi.fn();
    const metrics = createDatadogLambdaMetrics(send);
    metrics.distribution('stt.latency_ms', 42, { model: 'whisper-large-v3-turbo' });
    expect(send).toHaveBeenCalledWith(
      'stt.latency_ms',
      42,
      'model:whisper-large-v3-turbo',
      'stage:test',
    );
  });

  it('selects the datadog-lambda-js sink only when DD_LAMBDA_HANDLER is set', async () => {
    const send = vi.fn();
    vi.stubEnv('DD_LAMBDA_HANDLER', 'index.transcribe');
    createMetrics({ send }).distribution('kb.retrieval_ms', 7);
    expect(send).toHaveBeenCalledWith('kb.retrieval_ms', 7, 'stage:test');

    vi.stubEnv('DD_LAMBDA_HANDLER', '');
    socket = await listen(0);
    const other = vi.fn();
    const dogstatsd = createMetrics({ send: other });
    dogstatsd.distribution('kb.retrieval_ms', 7);
    await dogstatsd.flush();
    expect(other).not.toHaveBeenCalled();
  });

  it('rejects metric names outside METRIC_NAMES at compile time', () => {
    const metrics = createMemoryMetrics();
    // @ts-expect-error: 'groq.unknown_ms' no es un MetricName.
    metrics.distribution('groq.unknown_ms', 1);
    expect(metrics.calls).toHaveLength(1);
  });
});
