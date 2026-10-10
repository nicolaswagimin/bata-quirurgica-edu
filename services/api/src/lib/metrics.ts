import { createSocket } from 'node:dgram';

export const METRIC_NAMES = [
  'groq.ttft_ms',
  'groq.total_ms',
  'groq.completion_tokens',
  'kb.retrieval_ms',
  'bedrock.embed_ms',
  'assistant.quota_rejections',
  'stt.latency_ms',
] as const;
export type MetricName = (typeof METRIC_NAMES)[number];

export type Metrics = {
  distribution(name: MetricName, value: number, tags?: Record<string, string>): void;
  flush(): Promise<void>;
};

export type RecordedMetric = { name: MetricName; value: number; tags?: Record<string, string> };

function formatTags(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}

// DogStatsD por UDP hacia la extensión de Datadog; nunca bloquea la respuesta si falla.
export function createDogStatsdMetrics({
  host = '127.0.0.1',
  port = 8125,
}: {
  host?: string;
  port?: number;
} = {}): Metrics {
  const socket = createSocket('udp4');
  socket.unref();
  socket.on('error', () => {});
  const pending = new Set<Promise<void>>();
  return {
    distribution(name, value, tags = {}) {
      const all = { ...tags, stage: process.env.STAGE ?? 'dev' };
      const datagram = `${name}:${value}|d|#${formatTags(all)}`;
      const sent = new Promise<void>((resolve) => {
        socket.send(datagram, port, host, () => resolve());
      });
      pending.add(sent);
      void sent.then(() => pending.delete(sent));
    },
    async flush() {
      await Promise.all([...pending]);
    },
  };
}

export function createMemoryMetrics(): Metrics & { calls: RecordedMetric[]; flushes: number } {
  const calls: RecordedMetric[] = [];
  const metrics = {
    calls,
    flushes: 0,
    distribution(name: MetricName, value: number, tags?: Record<string, string>) {
      calls.push(tags ? { name, value, tags } : { name, value });
    },
    async flush() {
      metrics.flushes += 1;
    },
  };
  return metrics;
}

export function createMetrics(): Metrics {
  return createDogStatsdMetrics();
}
