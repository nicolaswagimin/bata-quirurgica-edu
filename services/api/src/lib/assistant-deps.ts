import Groq from 'groq-sdk';
import { getSecretString, requireEnv } from './config.ts';
import { getDb } from './identity.ts';
import { createFirestoreRetriever, embedText, retrieveContext } from './kb.ts';
import { createMetrics } from './metrics.ts';
import { consumeQuotaTx } from './repos.ts';

let groqPromise: Promise<Groq> | undefined;

// Una instancia por contenedor: reutiliza conexiones y el secreto cacheado entre invocaciones.
export function getGroqClient(): Promise<Groq> {
  if (!groqPromise) {
    groqPromise = (async () => {
      const apiKey =
        process.env.GROQ_API_KEY || (await getSecretString(requireEnv('GROQ_SECRET_ID')));
      return new Groq({ apiKey, maxRetries: 1, timeout: 20_000 });
    })();
    groqPromise.catch(() => {
      groqPromise = undefined;
    });
  }
  return groqPromise;
}

// Tipos estructurales de ChatDeps/TranscribeDeps (routes/assistant.ts): lib no importa de routes.
export function defaultChatDeps() {
  const metrics = createMetrics();
  return {
    consumeQuota: async (uid: string) => consumeQuotaTx(await getDb(), uid, 'chat', Date.now()),
    getGroq: getGroqClient,
    retrieve: async (query: string) =>
      retrieveContext(query, {
        embed: (text: string) => embedText(text, { metrics }),
        retriever: createFirestoreRetriever(await getDb()),
        maxDistance: Number(requireEnv('KB_MAX_DISTANCE')),
      }),
    model: requireEnv('GROQ_CHAT_MODEL'),
    metrics,
    now: Date.now,
  };
}

export function defaultTranscribeDeps() {
  return {
    consumeQuota: async (uid: string) => consumeQuotaTx(await getDb(), uid, 'stt', Date.now()),
    getGroq: getGroqClient,
    model: requireEnv('GROQ_STT_MODEL'),
    metrics: createMetrics(),
    now: Date.now,
  };
}
