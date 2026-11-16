import Groq from 'groq-sdk';
import { getSecretString, requireEnv } from './config.ts';
import { getDb } from './identity.ts';
import {
  createFirestoreRetriever,
  embedText,
  retrieveBilingual,
  retrieveWithFallback,
} from './kb.ts';
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

// Búsqueda web integrada de Groq (browser search, servidor de Groq). Sólo se invoca cuando el
// protocolo cargado no cubre la pregunta.
const BROWSE_PROMPT = [
  'Eres el asistente educativo de Bata Quirúrgica Edu para personal de salud en Colombia.',
  'Busca en la web y responde en español, en máximo 5 oraciones.',
  'Prioriza fuentes oficiales: OMS, OPS, CDC, Ministerio de Salud de Colombia, INS e instituciones hospitalarias.',
  'Nombra la fuente que uses. No inventes cifras ni normativa que no aparezca en los resultados.',
  'No pidas ni proporciones datos de pacientes: es material educativo, no una consulta clínica.',
].join('\n');

export async function browseWeb(model: string, question: string): Promise<string | null> {
  const groq = await getGroqClient();
  const completion = (await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: BROWSE_PROMPT },
      { role: 'user', content: question },
    ],
    tools: [{ type: 'browser_search' }],
    tool_choice: 'required',
    temperature: 0.2,
    max_completion_tokens: 500,
    reasoning_effort: 'low',
    stream: false,
  } as never)) as { choices?: { message?: { content?: string | null } }[] };
  const text = completion.choices?.[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : null;
}

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
      // Tres niveles: estricto, relajado y respaldo. Sólo devuelve vacío si el banco no tiene
      // fragmentos, y en ese caso el asistente responde igual con conocimiento general.
      return retrieveBilingual(query, {
        search: (q) => retrieveWithFallback(q, { embed, retriever, maxDistance, k: 6 }),
        translate: (q) => translateForSearch(model, q),
        k: 6,
      });
    },
    browse: (question: string) => browseWeb(model, question),
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
