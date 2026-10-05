# Bata Quirúrgica Edu

Plataforma web gamificada (estilo Duolingo) que enseña al personal de salud en Colombia el uso
correcto de la bata quirúrgica y la bioseguridad: misiones, XP, rachas, ranking, 3D, AR espejo y un
asistente de IA con citas a normativas. Proyecto de grado.

## Commands

Todo se corre desde la raíz del proyecto. Node 24 (`.nvmrc`), pnpm 11 (`packageManager`).

| Tarea | Comando |
|---|---|
| Instalar | `pnpm install --frozen-lockfile` |
| Web dev | `pnpm --filter @bata/web dev` — http://localhost:5173 |
| API local | `pnpm --filter @bata/api run dev` — http://127.0.0.1:3001/v1 (con emuladores arriba) |
| Build web | `pnpm build` |
| Typecheck | `pnpm typecheck` |
| Lint / formato | `pnpm lint` · `pnpm format` |
| Unit tests | `pnpm test` · un archivo: `pnpm --filter @bata/api exec vitest run test/unit/base.test.ts` |
| Tests con emulador (Java 21) | `pnpm test:emu` |
| E2E sin emulador | `pnpm test:e2e` · un spec: `pnpm --filter @bata/web exec playwright test e2e/smoke.spec.ts` |
| E2E con emuladores + API | `pnpm test:e2e:emu` |
| Assets MediaPipe | `pnpm --filter @bata/web run mediapipe:prepare` |
| Seed local | `pnpm exec firebase emulators:exec --project demo-bata --only firestore "pnpm --filter @bata/api run seed"` |
| CDK synth | `pnpm synth` · pruebas: `pnpm --filter @bata/infra test` |
| Contrato handlers ↔ bundle | `pnpm --filter @bata/infra run check:bundle` |
| Admin | `pnpm --filter @bata/api run set-admin -- correo@ejemplo.com` |
| Ingesta KB | `pnpm --filter @bata/api run ingest-kb` (`-- --dry-run` sin Bedrock) |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` antes de marcar cualquier tarea como hecha;
si la tarea toca Firestore, también `pnpm test:emu`.

Versiones: en el lockfile. Nunca adivinar una.

## Stack

Vite + React 19 SPA · TypeScript · Tailwind v4 · TanStack Router/Query · Firebase Auth + Firestore ·
API Gateway REST + Lambda (Node 24, arm64) · Groq (gpt-oss-120b, whisper) · Bedrock Titan V2 ·
three.js / R3F · MediaPipe · model-viewer · Datadog · AWS CDK · S3 + CloudFront.

## Architecture

**Flujo de una petición.** Navegador → `apps/web/src/lib/api.ts` (Bearer = ID token de Firebase) →
API Gateway REST `v1` → autorizador TOKEN (`services/api/src/handlers/entry.ts#authorizer`) →
export Lambda en `entry.ts` → `src/routes/<dominio>.ts` → `src/lib/repos.ts` (firebase-admin) →
Firestore. El chat transmite NDJSON con `awslambda.streamifyResponse`.
Lecturas en vivo (ranking, progreso) van directo del navegador a Firestore con reglas de solo lectura.

| Capa | Puede importar | Nunca |
|---|---|---|
| `packages/shared/src/*` | `zod` | nada de web, api ni infra |
| `apps/web/src/**` | `@bata/shared/*`, librerías de UI | `firebase-admin`, `services/**`, escribir en Firestore |
| `services/api/src/routes/**` | `src/lib/**`, `@bata/shared/*` | React, `apps/**` |
| `services/api/src/lib/**` | SDKs, `@bata/shared/*` | `src/routes/**` |
| `infra/**` | `aws-cdk-lib`, constructs | código de runtime de `services/api` (solo la ruta del entry) |

**Dónde vive cada cosa.**

| Tema | Fuente única |
|---|---|
| Esquemas, códigos de error, mensajes HTTP | `packages/shared/src/schemas.ts` |
| Nivel, racha, fecha Bogotá | `packages/shared/src/gamification.ts` |
| Tokens de diseño | `apps/web/src/styles.css` (`@theme`) |
| Rutas web | `apps/web/src/router.tsx` |
| Respuestas HTTP + CORS | `services/api/src/lib/http.ts` |
| Env y secretos (lectura perezosa) | `services/api/src/lib/config.ts` |
| Acceso a Firestore | `services/api/src/lib/repos.ts` |
| Reglas e índices | `firestore.rules` · `firestore.indexes.json` |
| Preguntas, pasos, créditos, fuentes KB, privacidad | `content/**` |

**Convención de imports:** especificadores relativos con extensión `.ts` (`./http.ts`) y paquetes del
workspace por subruta (`@bata/shared/schemas`). Sin alias `@/`, sin barrels.

## Code rules

1. Un componente por archivo, máximo 300 líneas.
2. Validar toda entrada con zod en el borde; tipos con `z.infer`, nunca duplicados.
3. Errores del API siempre `{ "error": { "code", "message" } }` con CORS (`http.ts`).
4. Leer variables de entorno dentro de la función que las usa (`requireEnv`), nunca al importar.
5. Cuota por usuario antes de cualquier llamada a Groq o Bedrock.
6. IDs de modelo solo desde env (`GROQ_CHAT_MODEL`, `GROQ_STT_MODEL`).
7. Sin dependencias nuevas sin justificarlo en el commit.
8. Textos de UI en español (Colombia); identificadores, archivos y commits en inglés.

## Design system

| Rol | Valor | Uso |
|---|---|---|
| Fondo | `#FFFFFF` | página |
| Superficie | `#F5FAF8` | tarjetas, paneles |
| Primario | `#127A5F` | botones, enlaces, barras de progreso |
| Primario fuerte | `#0E5E49` | hover/activo |
| Primario suave | `#E3F3EC` | fondos de selección |
| Texto | `#10201B` | cuerpo |
| Texto atenuado | `#55665F` | ayudas, metadatos |
| Borde | `#D5E3DD` | separadores, inputs |
| XP | `#F2B705` | píldora dorada (texto `#10201B` encima) |
| Racha | `#F2711C` | icono de llama decorativo, siempre con número en texto |
| Éxito / Peligro / Info | `#1E9E5A` / `#C93C3C` / `#2563EB` | estados; éxito solo en elementos no textuales o texto ≥ 24 px |

- Tipografía: pila del sistema (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto`), sin
  fuentes web. Escala 12 / 14 / 16 / 20 / 24 / 32 px.
- Espaciado base 4 px. Radio 12 px tarjetas, 999 px píldoras. Bordes suaves, sin sombras fuertes.
- Solo modo claro. Foco visible `#2563EB` 3 px. Respetar `prefers-reduced-motion`.

## Environment

| Variable | Requerida desde | Usada por | Fuente |
|---|---|---|---|
| `VITE_FIREBASE_*`, `VITE_USE_EMULATORS`, `VITE_API_BASE_URL` | paso 2 | `apps/web/src/lib/firebase.tsx` | consola Firebase; `.env.e2e` para pruebas |
| `VITE_DD_*`, `VITE_APP_VERSION` | paso 17 (opcional) | `apps/web/src/lib/observability.ts` | Datadog RUM |
| `STAGE`, `WEB_ORIGIN`, `FIREBASE_PROJECT_ID` | paso 4 | `services/api/src/lib/*` | CDK / `.env` |
| `FIREBASE_SA_SECRET_ID` | despliegue | `identity.ts` | Secrets Manager |
| `SHOW_DRAFT_QUESTIONS` | paso 8 | `routes/quiz.ts`, `seed.ts` | CDK / `.env` |
| `KB_MAX_DISTANCE`, `AWS_REGION` | paso 13 | `lib/kb.ts` | CDK / `.env` |
| `GROQ_API_KEY` (local) · `GROQ_SECRET_ID` (Lambda), `GROQ_CHAT_MODEL`, `GROQ_STT_MODEL` | paso 14 | `lib/assistant-deps.ts` | Groq console / Secrets Manager |

`.env.example` (en `apps/web/` y `services/api/`) se versiona; los `.env` reales nunca.

## Rules

| Archivo | Aplica a |
|---|---|
| `.claude/rules/api.md` | `services/api/**` |
| `.claude/rules/web.md` | `apps/web/**` |
| `.claude/rules/firestore.md` | reglas, índices, repos, seed, `content/**` |
| `.claude/rules/infra.md` | `infra/**`, `scripts/deploy.sh`, `.github/workflows/**` |

Orden de construcción y estado: `blueprints/bata-quirurgica-edu/tasks.json` y `epics/`.

## Non-negotiable

1. Los clientes nunca escriben en Firestore; `questionKeys` nunca es legible por un cliente.
2. Los fotogramas de la cámara nunca salen del navegador (sin uploads en el AR espejo).
3. Nunca `cdk deploy`, `aws`, `gcloud` ni `firebase deploy` desde el agente: son pasos humanos.
4. Nunca crear la base de Firestore: su ubicación (us-east1) es permanente y la crea una persona.
5. Nunca commitear secretos, `.env`, PDFs de la KB ni `public/mediapipe/`.
6. Nunca marcar una tarea como hecha con una compuerta fallando, ni editar un comando `verify`.
