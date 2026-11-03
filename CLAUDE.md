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
| Preguntas, pasos, lecciones de Aprende, créditos, fuentes KB, privacidad | `content/**` |

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

Mundo visual: **Quirófano menta** (la pared de azulejos menta del quirófano: verde quirúrgico profundo
sobre blanco cálido; el pixel art es el único adorno). Fuente única de tokens:
`apps/web/src/styles.css`. Detalle y movimiento: `DESIGN.md`.

| Rol | Token | Valor | Uso |
|---|---|---|---|
| Fondo | `bg` | `#FFFDF8` | página, paneles |
| Superficie | `surface` | `#F3EFE4` | paneles secundarios, filas en hover |
| Banda (menta, color principal) | `band` | `#A6E4C9` | cabecera y banda de inicio; encima solo tinta, nunca texto blanco |
| Texto atenuado en la banda | `on-band-muted` | `#2C4F42` | metadatos sobre la banda |
| Azulejo | `tile` | `#D3EEE1` | cuadrícula `tile-grid`, solo detrás de pixel art |
| Primario (verde quirúrgico) | `primary` | `#0C6A4C` | botones, enlaces, pestaña activa, casillas hechas |
| Primario fuerte | `primary-strong` | `#084E38` | hover/activo, pista de la barra de nivel |
| Primario suave | `primary-soft` | `#E2F5EC` | selección, fondos de íconos |
| Texto | `ink` | `#173A2F` | cuerpo; nunca negro puro |
| Texto atenuado | `muted` | `#4C5D55` | ayudas, metadatos |
| Borde | `border` | `#D9D1BF` | reglas entre filas, bordes de inputs |
| Dominada (bronce) | `seal` | `#8A5A00` | medalla y texto de misión dominada |
| XP | `xp` / `xp-soft` | `#F2B705` / `#FFEFB8` | solo en fichas y en la barra de nivel, texto `ink` encima |
| Racha | `streak` | `#E4612A` | llama pixel decorativa, siempre con número en texto |
| Éxito / Peligro / Info | `success` / `danger` / `info` | `#1B7344` / `#B3362B` / `#2A5DB8` | estados |
| Foco | `focus` / `focus-on-primary` | `#173A2F` / `#F2B705` | anillo de 3 px |

- Tipografía: Atkinson Hyperlegible Next (UI y contenido) y Atkinson Hyperlegible Mono (solo códigos
  y cifras); Pixelify Sans solo en titulares de 2–4 palabras e insignias, nunca en párrafos ni
  botones. Todas OFL, autoalojadas en `apps/web/public/fonts/`. Escala 12 / 14 / 16 / 20 / 24 / 32 px.
- Pixel art: solo como acento (íconos de misión, insignias de XP y racha, medalla, celebraciones,
  mascota **Dra. Menta**). Se dibuja por código: grillas de caracteres en `src/art/sprites.ts`
  sobre la paleta de tokens, pintadas por `components/pixel-sprite.tsx` (SVG nítido, `pixelated`).
  Nada de arte de terceros. La Dra. Menta nunca muestra una postura incorrecta.
- Espaciado base 4 px. Radio 4 px casillas, 12 px paneles, 999 px píldoras. Sin tarjetas con borde:
  reglas, sombra suave y tipografía separan el contenido.
- Íconos de interfaz (pestañas, botones): `components/pictogram.tsx` (línea 2 px, retícula 24). Sin
  emoji como ícono.
- Movimiento: duraciones y curvas solo desde tokens (`--duration-*`, `--ease-*`, `animate-medal`);
  un momento orquestado por pantalla; nada desde escala 0; utilidad `pressable` para presionar.
- Solo modo claro. Respetar `prefers-reduced-motion`.

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
