import Groq from 'groq-sdk';
import { getSecretString, requireEnv } from './config.ts';
import { getDb } from './identity.ts';
import { createFirestoreRetriever, embedText, retrieveBilingual, retrieveContext } from './kb.ts';
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

const TRANSLATE_PROMPT =
  'Translate the user question into English for searching medical guidelines. ' +
  'Reply with the translated question only, without quotes or explanations.';

// Traducción para la búsqueda (no para responder): las fuentes están sobre todo en inglés.
export async function translateForSearch(model: string, question: string): Promise<string | null> {
  const groq = await getGroqClient();
  const res = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: TRANSLATE_PROMPT },
      { role: 'user', content: question },
    ],
    temperature: 0,
    reasoning_effort: 'low',
    max_completion_tokens: 300,
  });
  const text = res.choices[0]?.message?.content?.trim();
  return text && text.length <= 1000 ? text : null;
}

// Tipos estructurales de ChatDeps/TranscribeDeps (routes/assistant.ts): lib no importa de routes.
export function defaultChatDeps() {
  const metrics = createMetrics();
  const model = requireEnv('GROQ_CHAT_MODEL');
  return {
    consumeQuota: async (uid: string) => consumeQuotaTx(await getDb(), uid, 'chat', Date.now()),
    getGroq: getGroqClient,
    retrieve: async (query: string) => {
      const retriever = createFirestoreRetriever(await getDb());
      const maxDistance = Number(requireEnv('KB_MAX_DISTANCE'));
      const embed = (text: string) => embedText(text, { metrics });
      return retrieveBilingual(query, {
        search: (q) => retrieveContext(q, { embed, retriever, maxDistance }),
        translate: (q) => translateForSearch(model, q),
      });
    },
    model,
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
