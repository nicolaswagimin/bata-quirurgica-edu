# ADR 0004 — gpt-oss-120b en Groq, embeddings en Bedrock, TTS en el navegador

- Estado: aceptada (2026-10-04)

## Contexto
- Groq retiró llama-3.1-8b-instant y llama-3.3-70b-versatile (anuncio 2026-06-17, apagado
  2026-08-16); reemplazos: openai/gpt-oss-20b y openai/gpt-oss-120b —
  https://console.groq.com/docs/deprecations
- Groq no ofrece API de embeddings y su TTS solo cubre inglés/árabe —
  https://console.groq.com/docs/text-to-speech
- Titan Text Embeddings V2 está disponible en us-east-1 (In-Region) —
  https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html

## Decisión
- Chat: `openai/gpt-oss-120b` (variable `GROQ_CHAT_MODEL`; respaldo documentado
  `openai/gpt-oss-20b`), temperatura 0,2, `max_completion_tokens` 700, streaming.
- STT: `whisper-large-v3-turbo`, idioma `es`.
- Embeddings: `amazon.titan-embed-text-v2:0`, 1024 dimensiones, normalizados.
- TTS: `speechSynthesis` del navegador con voz en español; el texto siempre se muestra.

## Límites a respetar
Plan gratuito de Groq: 30 RPM / 1K RPD por organización para gpt-oss; whisper 20 RPM —
https://console.groq.com/docs/rate-limits. Mitigación: cuotas por usuario y 429 con mensaje claro.

## Se revisa si
Groq retira gpt-oss-120b, o la evaluación de 30 preguntas cae por debajo del umbral.
