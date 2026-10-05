---
description: Convenciones del backend serverless (Lambda + API Gateway REST)
paths:
  - "services/api/**"
---

- Handlers Lambda: SOLO en `services/api/src/handlers/entry.ts` (exports `authorizer`, `me`, `quiz`,
  `chat`, `transcribe`, `admin`). La lógica vive en `src/routes/*.ts` y `src/lib/*.ts`, importada con
  `await import(...)` dentro de cada export para que cada función evalúe solo su código.
- Enrutamiento interno por `event.httpMethod` + `event.path` (sin prefijo de etapa `/v1`).
- Toda respuesta (éxito o error) sale por `src/lib/http.ts`: `json()` / `errorResponse()` agregan
  `Access-Control-Allow-Origin: <WEB_ORIGIN>`, `Vary: Origin` y el sobre
  `{ "error": { "code", "message" } }`. Nunca `*` como origen.
- Validar el cuerpo con el esquema zod de `@bata/shared/schemas` vía `parseJsonBody()` → 422
  `VALIDATION_ERROR`.
- Variables de entorno: leerlas con `requireEnv()` de `src/lib/config.ts` DENTRO de la función que
  las usa, nunca al cargar el módulo (las pruebas de pasos tempranos no tienen las de pasos tardíos).
- Secretos: `getSecretString(id)` cachea en memoria; nunca loguear su valor.
- Cuota antes de cualquier llamada a Groq o Bedrock. Ninguna excepción.
- Pruebas unitarias: `test/unit/*.test.ts` con dependencias inyectadas (sin red, sin emuladores).
  Pruebas con emulador: `test/emu/*.test.ts`, limpian Firestore y Auth en `beforeEach` con
  `DELETE http://127.0.0.1:8080/emulator/v1/projects/demo-bata/databases/(default)/documents` y
  `DELETE http://127.0.0.1:9099/emulator/v1/projects/demo-bata/accounts`.
- Scripts (`scripts/*.ts`) exportan su función principal y solo la ejecutan si
  `import.meta.url === pathToFileURL(process.argv[1] ?? '').href`; ignoran un argumento `--` literal.
