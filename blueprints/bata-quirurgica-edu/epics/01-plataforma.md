# Epic 01: Plataforma

> Al terminar existen el paquete compartido, el shell web con Auth, el spike del AR espejo, la base del API con autorizador, la infraestructura CDK sintetizable y la capa de datos de Firestore probada contra el emulador.

| | |
|---|---|
| **Epic id** | `01-plataforma` |
| **Tasks** | `E1-T1` … `E1-T6` |
| **Depends on** | nada — empezar aquí (después del Bootstrap de `blueprint.md` §10) |
| **Unlocks** | `02-producto`, `03-asistente-operacion` |
| **Parallel with** | ninguno |

No necesitas ningún otro archivo para completar este epic. Todo lo de abajo se repite aquí a propósito.

---

## Stack

Vite + React 19 SPA · TypeScript 6 · Tailwind v4 · TanStack Router/Query · Firebase Auth + Firestore · API Gateway REST + Lambda (Node 24, arm64, sin VPC) · AWS CDK v2 · MediaPipe · Vitest · Playwright · Biome.
Gestor: `pnpm` 11 (corepack). Runtime en `.nvmrc` (24). Las versiones están en el lockfile — léelo, nunca adivines una.

| Tarea | Comando |
|---|---|
| Instalar | `pnpm install --frozen-lockfile` |
| Typecheck | `pnpm typecheck` · un paquete: `pnpm --filter @bata/web typecheck` |
| Lint | `pnpm lint` |
| Test (un archivo) | `pnpm --filter @bata/api exec vitest run test/unit/base.test.ts` |
| Tests con emulador | `pnpm exec firebase emulators:exec --project demo-bata --only firestore,auth "<comando>"` (Java 21) |
| E2E (un spec) | `pnpm --filter @bata/web exec playwright test e2e/smoke.spec.ts` |
| CDK | `pnpm --filter @bata/infra run synth` · `pnpm --filter @bata/infra test` |
| Servicios locales | emuladores de Firebase, arrancados y detenidos por `firebase emulators:exec` dentro del comando |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar cualquier tarea como hecha.

Los archivos de configuración (`package.json` de cada paquete, tsconfigs, configs de vitest/playwright/vite, `biome.json`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `content/**`, `apps/web/index.html`, `apps/web/src/styles.css`, `apps/web/e2e/helpers.ts`, `apps/web/scripts/prepare-mediapipe.ts`, `infra/scripts/check-bundle.ts`) ya están en la raíz: los copió el Bootstrap desde el `workspace/` del bundle. No los reescribas.

Ninguna línea de Verify depende de `--passWithNoTests`: cada una nombra sus archivos de prueba.

## Directory subtree

```
packages/shared/
  src/schemas.ts              # NUEVO (T1)
  src/gamification.ts         # NUEVO (T1)
  test/schemas.test.ts        # NUEVO (T1)
  test/gamification.test.ts   # NUEVO (T1)
apps/web/
  test/unit/contrast.test.ts  # NUEVO (T1)
  src/main.tsx                # NUEVO (T2)
  src/router.tsx              # NUEVO (T2)
  src/lib/firebase.tsx        # NUEVO (T2)
  src/routes/public-pages.tsx # NUEVO (T2)
  e2e/smoke.spec.ts           # NUEVO (T2)
  src/ar/pose.ts              # NUEVO (T3)
  src/ar/overlay-math.ts      # NUEVO (T3)
  src/routes/bata-ar.tsx      # NUEVO (T3)
  test/unit/overlay-math.test.ts  # NUEVO (T3)
  e2e/ar-spike.spec.ts        # NUEVO (T3)
  src/styles.css  index.html  e2e/helpers.ts  scripts/prepare-mediapipe.ts   # existen, solo lectura
services/api/
  src/lib/http.ts  src/lib/config.ts  src/lib/identity.ts   # NUEVOS (T4)
  src/handlers/entry.ts       # NUEVO (T4)
  test/unit/base.test.ts      # NUEVO (T4)
  src/lib/repos.ts  src/lib/quota.ts                        # NUEVOS (T6)
  test/unit/quota.test.ts  test/emu/rules.test.ts  test/emu/repos.test.ts   # NUEVOS (T6)
infra/
  bin/app.ts  lib/web-stack.ts  lib/api-stack.ts  lib/budget-stack.ts  test/stacks.test.ts   # NUEVOS (T5)
  scripts/check-bundle.ts     # existe, solo lectura (lo usa el epic 03)
content/**  firestore.rules  firestore.indexes.json  firebase.json   # existen, solo lectura
```

Todo lo de fuera de este subárbol está fuera de alcance. Si una tarea parece requerir otro archivo, detente y repórtalo.

## Data model touched here

| Entidad | Campos | Notas |
|---|---|---|
| `users/{uid}` | uid, displayName, email, role, groupId, xp, level, streakDays, lastActiveDate, consent{policyVersion, acceptedAt}, createdAt, updatedAt | solo lectura propia (reglas) |
| `progress/{uid}/attempts`, `progress/{uid}/missions` | ver blueprint §4 | lectura propia; borrado recursivo |
| `leaderboard/{uid}` | displayName, xp, level, groupId, updatedAt | lectura autenticada |
| `questions/{id}` | … status `draft`/`validated` | drafts solo con `appConfig/flags.showDraftQuestions == true` |
| `questionKeys`, `quotas`, `groups`, `kbChunks`, `kbDocuments` | — | solo servidor |
| `quotas/{uid}` | chatHourStart, chatHourCount, chatDayStart, chatDayCount, sttHourStart, sttHourCount | límites chat 30/h, 100/día; stt 30/h |

Nivel = `floor(sqrt(xp / 50)) + 1`. Fechas ISO-8601 UTC; `lastActiveDate` `YYYY-MM-DD` en America/Bogota (UTC−5 fijo).

## Contracts

**Consumed:** nada de otros epics.

**Produced** — los epics siguientes dependen de estas firmas:

| Export | Firma | Usado por |
|---|---|---|
| `@bata/shared/schemas` → `POLICY_VERSION` | `'2026-10-04'` | 02, 03 |
| `@bata/shared/schemas` → `messageForStatus` | `(status: number) => string` | 02, 03 |
| `@bata/shared/schemas` → esquemas | `CreateProfileSchema`, `JoinGroupSchema`, `QuestionSchema`, `QuestionInputSchema`, `AnswerRequestSchema`, `AnswerResponseSchema`, `ChatRequestSchema`, `ChatMessage`, `CitationSchema`/`Citation`, `StreamEventSchema`/`StreamEvent`, `TranscribeRequestSchema`, `SeedFileSchema`, `BataPasosSchema`, `CreditsSchema`, `KbSourcesSchema`, `PrivacyPolicySchema`, `ERROR_CODES`, `ERROR_STATUS` | 02, 03 |
| `@bata/shared/gamification` | `levelForXp(xp)`, `bogotaDate(d)`, `previousDay(ymd)`, `nextStreak({ lastActiveDate, streakDays }, today)`, `sameSet(a, b)` | 02 |
| `apps/web/src/lib/firebase.tsx` | `auth`, `db`, `env`, `AuthProvider`, `useAuth()` → `{ user, role, loading }` | 02, 03 |
| `apps/web/src/router.tsx` | rutas de §6 del blueprint; páginas por glob `./routes/*.tsx` (default export); asistente por glob `./assistant/assistant-panel.tsx` | 02, 03 |
| `apps/web/src/ar/overlay-math.ts` | `computeGownAnchor(landmarks, size) => Anchor \| null`, `class FpsMonitor` | 02 |
| `services/api/src/lib/http.ts` | `HttpError`, `corsHeaders()`, `json()`, `errorResponse()`, `toHttpError()`, `parseJsonBody()`, `readAuthContext()`, `withJsonHandler()` | 02, 03 |
| `services/api/src/lib/config.ts` | `requireEnv(name)`, `getSecretString(id)`, `getProjectId()` | 02, 03 |
| `services/api/src/lib/identity.ts` | `getDb()`, `getAdminAuth()`, `createAuthorizer(deps)` | 02, 03 |
| `services/api/src/handlers/entry.ts` | `export const notImplemented`, `authorizer`, `me`, `quiz`, `chat`, `transcribe`, `admin` (cada uno en su propia línea `export const <nombre>`) | 02, 03, infra |
| `services/api/src/lib/repos.ts` | `getUser`, `createProfileBatch`, `findGroupByCode`, `createGroup`, `setUserGroup`, `deleteUserData`, `consumeQuotaTx(db, uid, kind, nowMs)` | 02, 03 |
| `services/api/src/lib/quota.ts` | `QUOTA_LIMITS`, `consumeQuota(doc, kind, nowMs) => { allowed, next }` | 03 |
| `infra/bin/app.ts` | pilas `bata-web-<stage>`, `bata-api-<stage>`, `bata-budget-<stage>`; `buildApp(context)` | 03 |

## Conventions that bite in this area

- Imports relativos con extensión `.ts` (`'../lib/http.ts'`) y `@bata/shared/<módulo>`; sin alias ni barrels. Funciona en Vite, tsc, vitest, tsx, esbuild y Playwright con las configs emitidas.
- Las variables de entorno se leen **dentro** de la función que las usa (`requireEnv`), nunca al cargar el módulo: así ningún paso exige variables de pasos posteriores.
- Ninguna escritura de cliente en Firestore; `questionKeys` jamás legible.
- Pruebas web en entorno node (sin DOM): la UI se prueba con Playwright. Specs que necesitan emuladores llevan `@emu` en el título.
- `pnpm --filter @bata/infra test` no empaqueta (contexto `'aws:cdk:bundling-stacks': []`); `synth` sí, con el esbuild local.
- `cdk.json` trae `stage=dev`: cualquier despliegue real pasa `-c stage=prod` (lo hace `scripts/deploy.sh`, epic 03).
- Colores solo con utilidades de los tokens de `apps/web/src/styles.css`.

Reglas completas: `CLAUDE.md`. Reglas por área: `.claude/rules/*.md`. Ambas en la raíz del proyecto.

---

## Tasks

En el mismo orden que `tasks.json`. Ese orden es el orden de construcción.

### `E1-T1` — Add shared schemas, gamification rules and token contrast test

**Depends on:** nothing · **Priority:** p0 — metadato para recortes de alcance, no un orden

Escribe los esquemas zod como única fuente de verdad del contrato (API, contenido y stream). `SeedFileSchema` necesita `superRefine` para ids únicos, `correctOptionIds` ⊆ opciones, exactamente una correcta en `single`/`truefalse` y `missionId` existente; el JSON de seed tiene además `reviewNote`. `PrivacyPolicySchema.policyVersion` debe ser `z.literal(POLICY_VERSION)`. `messageForStatus`: 401 "Tu sesión expiró, vuelve a iniciar sesión"; 429 "Alcanzaste el límite de mensajes; intenta más tarde"; ≥500 "Algo falló en el servidor. Intenta de nuevo en unos minutos."; 403 "No tienes permiso para esta acción."; 404 "No encontramos lo que buscas."; 422 "Revisa los datos enviados."; otro "Ocurrió un error inesperado.". `bogotaDate` resta 5 h fijas (Colombia no tiene horario de verano) en vez de depender de ICU. La prueba de contraste parsea `styles.css` con regex y calcula la luminancia relativa WCAG; no la toques para "hacerla pasar": si falla, el token está mal. El script `test` de `@bata/shared` es `vitest run` sin `--passWithNoTests`: si no encuentra pruebas, falla.

**Files**
- `packages/shared/src/schemas.ts` — nuevo
- `packages/shared/src/gamification.ts` — nuevo
- `packages/shared/test/schemas.test.ts` — nuevo
- `packages/shared/test/gamification.test.ts` — nuevo
- `apps/web/test/unit/contrast.test.ts` — nuevo

**Acceptance**

Copiados de `tasks.json`. Cada uno lo decide un comando de abajo.

1. WHEN `pnpm install --frozen-lockfile` runs after the Bootstrap block THE SYSTEM SHALL exit 0 without modifying `pnpm-lock.yaml`.
2. WHEN `pnpm lint` and `pnpm typecheck` run from the project root with `blueprints/` present THE SYSTEM SHALL exit 0 for both.
3. WHEN `packages/shared/test/schemas.test.ts` parses `content/questions/seed.json`, `content/protocolos/bata-pasos.json`, `content/credits.json`, `content/kb/sources.json` and `content/legal/privacidad.json` with their schemas THE SYSTEM SHALL accept all five, and SHALL reject a seed question whose `correctOptionIds` names an option id that does not exist.
4. WHEN `levelForXp` receives 0, 49, 50, 200 and 450 THE SYSTEM SHALL return 1, 1, 2, 3 and 4.
5. WHEN `nextStreak` receives a last active date equal to yesterday, today or two days ago THE SYSTEM SHALL return the streak plus one, the same streak, and 1 respectively, and `bogotaDate(new Date('2026-01-01T04:59:00Z'))` SHALL return `2025-12-31`.
6. WHEN `apps/web/test/unit/contrast.test.ts` reads the `--color-*` tokens from `apps/web/src/styles.css` THE SYSTEM SHALL assert a contrast ratio of at least 4.5:1 for ink, muted, primary, primary-strong, danger and info on bg, for bg on primary and for ink on xp, and of at least 3:1 for success on bg.

**Verify** — desde la raíz del proyecto; cada línea sale con 0 si la tarea es correcta.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm --filter @bata/shared exec vitest run test/schemas.test.ts test/gamification.test.ts
pnpm --filter @bata/web exec vitest run test/unit/contrast.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T1: add shared schemas, gamification rules and token contrast test"
git tag step-01-foundation
```

### `E1-T2` — Build web shell, router, Firebase Auth client and public pages

**Depends on:** E1-T1 · **Priority:** p0

`firebase.tsx` valida `import.meta.env` con zod y conecta a los emuladores (`http://127.0.0.1:9099`, `127.0.0.1:8080`) si `VITE_USE_EMULATORS === 'true'`. El router (TanStack Router por código) declara **todas** las rutas ya: `/login`, `/registro`, `/privacidad` desde `public-pages.tsx`; el resto (`/` home, `/mision/$missionId` mision, `/ranking`, `/perfil`, `/bata-3d`, `/bata-ar`, `/bata-espacio`, `/creditos` pública, `/admin/preguntas`, `/admin/grupos`) con `import.meta.glob('./routes/*.tsx')` + `lazyRouteComponent` y un "Próximamente" si el archivo no existe, para que los pasos siguientes agreguen páginas sin editar el router. `RequireAuth` redirige a `/login?redirect=…`. El layout tiene enlace "Saltar al contenido", `<nav>` a la **derecha** del encabezado (Inicio, Ranking, 3D, AR espejo, Perfil — el avatar del asistente irá fijo arriba a la izquierda) y `AssistantSlot` por glob de `./assistant/assistant-panel.tsx`. El registro exige la casilla de consentimiento y guarda `{ policyVersion, acceptedAt }` en `sessionStorage['bata.pendingConsent']`. Validar formularios con `schema.safeParse` en `handleSubmit` + `setError` (no hay `@hookform/resolvers`). El smoke spec no lleva `@emu`.

**Files**
- `apps/web/src/main.tsx` — nuevo
- `apps/web/src/router.tsx` — nuevo
- `apps/web/src/lib/firebase.tsx` — nuevo
- `apps/web/src/routes/public-pages.tsx` — nuevo
- `apps/web/e2e/smoke.spec.ts` — nuevo

**Acceptance**

1. WHEN `pnpm --filter @bata/web build` runs THE SYSTEM SHALL exit 0 and write `apps/web/dist/index.html`.
2. WHEN the smoke spec opens `/login`, `/registro` and `/privacidad` on the `vite preview` server THE SYSTEM SHALL answer HTTP 200 and render exactly one `h1` on each page.
3. WHEN an anonymous visitor opens `/` or `/perfil` THE SYSTEM SHALL redirect to `/login`.
4. WHEN `/registro` is submitted with the consent checkbox unchecked THE SYSTEM SHALL show the field error `Debes aceptar la política de tratamiento de datos para continuar` and SHALL send no request to Firebase Auth.
5. WHEN `/login` renders THE SYSTEM SHALL expose inputs labelled `Correo electrónico` and `Contraseña` and a button named `Iniciar sesión`.
6. WHEN `/privacidad` renders THE SYSTEM SHALL show every section heading from `content/legal/privacidad.json` and the text `Ninguna imagen ni video se envía a ningún servidor`.

**Verify**

```bash
pnpm --filter @bata/web typecheck
pnpm --filter @bata/web build
test -f apps/web/dist/index.html
pnpm --filter @bata/web exec playwright test e2e/smoke.spec.ts
pnpm lint
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T2: build web shell, router, Firebase Auth client and public pages"
git tag step-02-web-shell
```

### `E1-T3` — Spike the AR mirror: camera, PoseLandmarker, FPS, privacy

**Depends on:** E1-T2 · **Priority:** p0

Riesgo #1 del proyecto, por eso va temprano. `pose.ts` crea el `PoseLandmarker` desde el origen propio (`FilesetResolver.forVisionTasks('/mediapipe/wasm')`, `modelAssetPath: '/mediapipe/pose_landmarker_lite.task'`, `runningMode: 'VIDEO'`, `numPoses: 1`), con delegado `GPU` y reintento en `CPU` si falla (en Chromium headless suele caer a CPU: ese es el camino que se prueba). `overlay-math.ts` es puro: `computeGownAnchor` con landmarks 11/12/23/24 (visibilidad < 0,5 → `null`) y `FpsMonitor` (5 s continuos bajo 12 fps → `lowPerformance`). En `bata-ar.tsx` el estado `[data-testid=ar-status]` pasa por "Cargando modelo" → "Detectando" (el bucle con `detectForVideo` está activo, haya o no persona; la cámara falsa no muestra una persona) → "Pose encontrada". El spec (`@emu`) crea el usuario con `createEmulatorUser`, entra con `loginViaUi`, empieza a registrar `page.on('request')` y navega con el enlace "AR espejo" del `<nav>` (navegación del cliente, sin recargar, para no mezclar tráfico de Auth); el segundo caso sustituye `getUserMedia` con `addInitScript` para que rechace. Antes del spec corre `mediapipe:prepare` (necesita red una vez para el modelo). **Puerta humana, no de construcción:** el estudiante prueba en iPhone Safari y Android Chrome por el puerto HTTPS de Codespaces y llena `docs/pruebas-dispositivos.md`; no esperes a eso para seguir.

**Files**
- `apps/web/src/ar/pose.ts` — nuevo
- `apps/web/src/ar/overlay-math.ts` — nuevo
- `apps/web/src/routes/bata-ar.tsx` — nuevo
- `apps/web/test/unit/overlay-math.test.ts` — nuevo
- `apps/web/e2e/ar-spike.spec.ts` — nuevo

**Acceptance**

1. WHEN `pnpm --filter @bata/web run mediapipe:prepare` runs THE SYSTEM SHALL exit 0 and leave `apps/web/public/mediapipe/pose_landmarker_lite.task` and the directory `apps/web/public/mediapipe/wasm/` on disk.
2. WHEN `computeGownAnchor` receives shoulders (landmarks 11 and 12) and hips (landmarks 23 and 24) in normalized coordinates THE SYSTEM SHALL return a center between them, a width proportional to the shoulder width and a rotation equal to the shoulder angle, and SHALL return `null` when any of the four landmarks has visibility below 0.5.
3. WHEN `FpsMonitor` records frames below 12 fps for 5 continuous seconds THE SYSTEM SHALL report `lowPerformance: true`, and SHALL report `false` when the drop lasts less than 5 seconds.
4. WHEN a signed-in user opens `/bata-ar` in Chromium with a fake camera THE SYSTEM SHALL show the status text `Detectando` in the element `[data-testid=ar-status]` within 30 seconds.
5. WHEN the AR session runs for 5 seconds after reaching `Detectando` THE SYSTEM SHALL issue zero requests whose method is not GET and zero requests to any origin other than the page origin.
6. WHEN `getUserMedia` rejects THE SYSTEM SHALL show the message `No pudimos acceder a la cámara` with a link to `/bata-3d`.

**Verify**

```bash
pnpm --filter @bata/web run mediapipe:prepare
test -f apps/web/public/mediapipe/pose_landmarker_lite.task
test -d apps/web/public/mediapipe/wasm
pnpm --filter @bata/web exec vitest run test/unit/overlay-math.test.ts
pnpm exec firebase emulators:exec --project demo-bata --only auth "pnpm --filter @bata/web exec playwright test e2e/ar-spike.spec.ts"
pnpm --filter @bata/web typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T3: spike the AR mirror: camera, PoseLandmarker, FPS, privacy"
git tag step-03-ar-spike
```

### `E1-T4` — Add API handler kit, CORS error envelope and token authorizer

**Depends on:** E1-T1 · **Priority:** p0

Todas las respuestas pasan por `http.ts`: `corsHeaders()` lee `WEB_ORIGIN` al llamarse y devuelve `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers: Authorization,Content-Type` y `Vary: Origin` (nunca `*`). `toHttpError` convierte errores desconocidos en 500 `INTERNAL` sin stack. `readAuthContext` lee `event.requestContext.authorizer.{uid, role, groupId}`; sin uid → 401. `identity.ts`: en emulador (`FIRESTORE_EMULATOR_HOST` o `FIREBASE_AUTH_EMULATOR_HOST` presentes) `initializeApp({ projectId })`; si no, credencial desde el secreto `FIREBASE_SA_SECRET_ID`. `createAuthorizer({ verify, loadGroupId })` permite inyectar el verificador: la prueba **no** importa firebase-admin real. La política Allow cubre `<arn-de-api>/v1/*/*` (necesario porque la caché de 300 s se comparte entre rutas); un token malo lanza `Error('Unauthorized')`. En `entry.ts` cada export es una línea propia `export const <nombre> = …` (la prueba del paso 5 los lee con `/^export const (\w+)/gm`) y carga su módulo con `await import(...)`; `me`, `quiz`, `chat`, `transcribe`, `admin` son por ahora `notImplemented`, y la prueba ejercita `notImplemented` directamente (no esos exports, que cambian en pasos posteriores).

**Files**
- `services/api/src/lib/http.ts` — nuevo
- `services/api/src/lib/config.ts` — nuevo
- `services/api/src/lib/identity.ts` — nuevo
- `services/api/src/handlers/entry.ts` — nuevo
- `services/api/test/unit/base.test.ts` — nuevo

**Acceptance**

1. WHEN `errorResponse` builds any error THE SYSTEM SHALL return the status mapped to its code, the body `{ "error": { "code", "message" } }`, and the headers `Access-Control-Allow-Origin` equal to `WEB_ORIGIN`, `Access-Control-Allow-Headers: Authorization,Content-Type` and `Vary: Origin`.
2. WHEN `parseJsonBody` receives malformed JSON or a body that fails its zod schema THE SYSTEM SHALL throw an `HttpError` with status 422 and code `VALIDATION_ERROR`.
3. WHEN the authorizer receives `Bearer <token>` that the injected verifier accepts THE SYSTEM SHALL return an Allow policy for every method and path of the calling API stage (`<api-arn>/v1/*/*`) whose context carries `uid`, `role` and `groupId` as strings.
4. WHEN the authorizer receives a missing, non-Bearer or rejected token THE SYSTEM SHALL throw `Error('Unauthorized')` so API Gateway answers 401.
5. WHEN the verified token has no `role` claim THE SYSTEM SHALL put `role: 'student'` in the context, and SHALL put `role: 'admin'` only when the token carries the custom claim `role === 'admin'`.
6. WHEN the `notImplemented` handler exported by `services/api/src/handlers/entry.ts` is invoked THE SYSTEM SHALL return 501 with code `NOT_IMPLEMENTED` and the CORS headers.

**Verify**

```bash
pnpm --filter @bata/api exec vitest run test/unit/base.test.ts
pnpm --filter @bata/api typecheck
pnpm lint
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T4: add API handler kit, CORS error envelope and token authorizer"
git tag step-04-api-base
```

### `E1-T5` — Define CDK stacks: web, REST API with streaming, budget

**Depends on:** E1-T4 · **Priority:** p1

`bin/app.ts` exporta `buildApp(context)` y crea `bata-web-<stage>`, `bata-api-<stage>`, `bata-budget-<stage>` con `env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' }` (región explícita: el synth no necesita credenciales). Las 6 funciones comparten `entry: services/api/src/handlers/entry.ts` con `handler` `authorizer|me|quiz|chat|transcribe|admin`, `NODEJS_24_X`, `ARM_64`, CJS, `target: 'node24'`, `externalModules: ['datadog-lambda-js', 'dd-trace']`. Secretos `/bata/<stage>/groq-api-key`, `/bata/<stage>/firebase-service-account`, `/bata/<stage>/datadog-api-key` con `Secret.fromSecretNameV2` + `grantRead` solo donde se usan; `bedrock:InvokeModel` solo en chat sobre `arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0`. API: `RestApi` Regional, etapa `v1`, throttling 50/100 y 5/10 en `/assistant/chat/POST` y `/assistant/transcribe/POST` (`methodOptions`); `TokenAuthorizer` con TTL 300 s asignado **método a método** (no `defaultMethodOptions`, para que el preflight OPTIONS quede sin autorizador); `defaultCorsPreflightOptions` con `allowOrigins: [webOrigin]`; `/health` con `MockIntegration` `{"ok":true}`; chat con `new LambdaIntegration(fn, { responseTransferMode: ResponseTransferMode.STREAM, timeout: Duration.seconds(60) })`. Gateway responses: DEFAULT_4XX `BAD_REQUEST`, DEFAULT_5XX `INTERNAL`, UNAUTHORIZED `UNAUTHORIZED`, ACCESS_DENIED `FORBIDDEN`, THROTTLED `THROTTLED`, QUOTA_EXCEEDED `QUOTA_EXCEEDED`, EXPIRED_TOKEN `UNAUTHORIZED`, INVALID_SIGNATURE `FORBIDDEN`, MISSING_AUTHENTICATION_TOKEN `NOT_FOUND` con estado `404`; cabeceras con valores entre comillas simples (`"'http://localhost:5173'"`, `"'Authorization,Content-Type'"`, `"'Origin'"`) y plantilla `{"error":{"code":"…","message":$context.error.messageString}}`. Concurrencia reservada en chat y transcribe solo si el contexto `assistantReservedConcurrency` > 0. Datadog: `DatadogLambda` (`nodeLayerVersion: 143`, `extensionLayerVersion: 99`, `site: ddSite`, `apiKeySecretArn`, `captureLambdaPayload: false`) sobre todas menos chat; chat recibe solo la capa `arn:aws:lambda:us-east-1:464622532012:layer:Datadog-Extension-ARM:99` y las variables `DD_*`. Si `synth` falla con "Unsupported runtime" del constructo, aplicar a todas el patrón manual de chat y anotarlo en el commit (alternativa autorizada; entonces todas quedan con `Handler` = `index.<nombre>`). Web: bucket privado sin `autoDeleteObjects`, CloudFront con OAC, 403/404 → 200 `/index.html`, cabeceras de seguridad con la CSP `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://*.execute-api.us-east-1.amazonaws.com https://*.googleapis.com https://*.datadoghq.com https://*.browser-intake-datadoghq.com; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://*.firebaseapp.com; style-src 'self' 'unsafe-inline'`, salidas `BucketName`, `DistributionId`, `DistributionDomainName`; API salida `ApiUrl`. Presupuesto `CfnBudget` 20 USD/mes, notificaciones ACTUAL > 5, 10, 20 USD al `alertEmail`. Pruebas con `'aws:cdk:bundling-stacks': []` en el contexto. **Contrato entry ↔ CDK (análisis estático, el bundle no se genera en estas pruebas):** la prueba lee `services/api/src/handlers/entry.ts` como texto, extrae los nombres con `/^export const (\w+)/gm` y comprueba que cada función de `bata-api-dev` apunta a `index.<nombre>` de ese conjunto — en `Handler`, o en la variable `DD_LAMBDA_HANDLER` cuando el constructo de Datadog reemplaza el `Handler` por su wrapper.

**Files**
- `infra/bin/app.ts` — nuevo
- `infra/lib/web-stack.ts` — nuevo
- `infra/lib/api-stack.ts` — nuevo
- `infra/lib/budget-stack.ts` — nuevo
- `infra/test/stacks.test.ts` — nuevo

**Acceptance**

1. WHEN `pnpm --filter @bata/infra run synth` runs with the `infra/cdk.json` defaults THE SYSTEM SHALL exit 0 and write `infra/cdk.out/bata-api-dev.template.json`, `infra/cdk.out/bata-web-dev.template.json` and `infra/cdk.out/bata-budget-dev.template.json`.
2. WHEN the assertion tests inspect `bata-api-dev` THE SYSTEM SHALL find each of DEFAULT_4XX, DEFAULT_5XX, UNAUTHORIZED, ACCESS_DENIED, THROTTLED, QUOTA_EXCEEDED, EXPIRED_TOKEN, INVALID_SIGNATURE and MISSING_AUTHENTICATION_TOKEN as an `AWS::ApiGateway::GatewayResponse` whose `Access-Control-Allow-Origin` is `'http://localhost:5173'` and whose `Vary` is `'Origin'`.
3. WHEN the assertion tests inspect the REST API THE SYSTEM SHALL find on `POST /assistant/chat` an `AWS_PROXY` integration with `ResponseTransferMode` `STREAM` and `TimeoutInMillis` 60000, a TOKEN authorizer with a 300-second result TTL, stage `v1` throttling of rate 50 and burst 100, and method throttling of rate 5 and burst 10 on `POST /assistant/chat` and `POST /assistant/transcribe`.
4. WHEN `assistantReservedConcurrency` is 5 THE SYSTEM SHALL set `ReservedConcurrentExecutions: 5` on the chat and transcribe functions, and WHEN it is 0 THE SYSTEM SHALL omit that property.
5. WHEN the assertion tests list every `AWS::Lambda::Function` in `bata-api-dev` THE SYSTEM SHALL find none with `VpcConfig`, all with runtime `nodejs24.x` and architecture `arm64`, each pointing at `index.<name>` (in `Handler`, or in the `DD_LAMBDA_HANDLER` variable when the Datadog construct wraps it) where `<name>` is one of the `export const` names parsed from `services/api/src/handlers/entry.ts`, and exactly one IAM policy statement granting `bedrock:InvokeModel`, on `arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0`.
6. WHEN the assertion tests inspect `bata-web-dev` and `bata-budget-dev` THE SYSTEM SHALL find a bucket with all four public-access blocks true served by CloudFront through origin access control with 403 and 404 mapped to `/index.html` with status 200, and a monthly 20 USD cost budget with ACTUAL notifications at 5, 10 and 20 USD.

**Verify**

```bash
pnpm --filter @bata/infra exec vitest run test/stacks.test.ts
pnpm --filter @bata/infra run synth
test -f infra/cdk.out/bata-api-dev.template.json
test -f infra/cdk.out/bata-web-dev.template.json
test -f infra/cdk.out/bata-budget-dev.template.json
pnpm --filter @bata/infra typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T5: define CDK stacks: web, REST API with streaming, budget"
git tag step-05-infra
```

### `E1-T6` — Add Firestore repositories, quotas and rules tests

**Depends on:** E1-T4 · **Priority:** p0

`quota.ts` es puro (ventanas fijas de 3 600 000 ms y 86 400 000 ms; `QUOTA_LIMITS = { chatHour: 30, chatDay: 100, sttHour: 30 }`), así se prueba sin emulador; `consumeQuotaTx` en `repos.ts` lo envuelve en una transacción. `deleteUserData` usa `db.recursiveDelete(db.doc('progress/' + uid))` (el documento padre puede no existir; las subcolecciones sí). `createGroup` genera códigos de 6 caracteres `A-Z0-9` y reintenta si chocan. `rules.test.ts` usa `@firebase/rules-unit-testing` con `initializeTestEnvironment({ projectId: 'demo-bata', firestore: { rules: readFileSync(resolve(import.meta.dirname, '../../../../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 } })` y siembra con `withSecurityRulesDisabled`. Las pruebas de emulador limpian en `beforeEach` con `DELETE http://127.0.0.1:8080/emulator/v1/projects/demo-bata/databases/(default)/documents` y `DELETE http://127.0.0.1:9099/emulator/v1/projects/demo-bata/accounts`. Requiere Java 21.

**Files**
- `services/api/src/lib/repos.ts` — nuevo
- `services/api/src/lib/quota.ts` — nuevo
- `services/api/test/unit/quota.test.ts` — nuevo
- `services/api/test/emu/rules.test.ts` — nuevo
- `services/api/test/emu/repos.test.ts` — nuevo

**Acceptance**

1. WHEN an authenticated client reads its own `users/{uid}` or `progress/{uid}/missions/{missionId}` THE SYSTEM SHALL allow it, and WHEN it reads another user's THE SYSTEM SHALL deny it.
2. WHEN any client attempts a write to any collection, or a read of `questionKeys`, `quotas`, `groups`, `kbChunks` or `kbDocuments` THE SYSTEM SHALL deny it.
3. WHEN a signed-in client reads a `draft` question while `appConfig/flags.showDraftQuestions` is false or missing THE SYSTEM SHALL deny it and SHALL allow it when the flag is true, and SHALL always allow signed-in clients to read `validated` questions.
4. WHEN `consumeQuota` is applied to a quota holding 30 chat requests in the current hour, 100 chat requests in the current day, or 30 stt requests in the current hour THE SYSTEM SHALL return `allowed: false`, and SHALL reset the hourly counter once 3600 seconds have passed since its window start.
5. WHEN `consumeQuotaTx` runs 31 times for one user and kind `chat` against the emulator THE SYSTEM SHALL allow the first 30 and reject the 31st, leaving `quotas/{uid}.chatHourCount` at 30.
6. WHEN `deleteUserData` runs for a user with a profile, attempts, mission progress, a leaderboard entry and a quota doc THE SYSTEM SHALL leave none of those documents in the emulator.

**Verify**

```bash
pnpm --filter @bata/api exec vitest run test/unit/quota.test.ts
pnpm exec firebase emulators:exec --project demo-bata --only firestore,auth "pnpm --filter @bata/api exec vitest run --config vitest.emu.config.ts test/emu/rules.test.ts test/emu/repos.test.ts"
pnpm --filter @bata/api typecheck
pnpm lint
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T6: add Firestore repositories, quotas and rules tests"
git tag step-06-data-layer
```

---

## Epic acceptance

El epic está hecho cuando todas sus tareas están `done` **y**:

1. WHEN the epic gate runs THE SYSTEM SHALL exit 0 for typecheck, lint, unit tests, CDK synth and the emulator-backed data-layer tests.
2. WHEN `/bata-ar` runs with a fake camera THE SYSTEM SHALL keep the camera frames in the browser, issuing only same-origin GET requests.

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @bata/infra run synth
pnpm exec firebase emulators:exec --project demo-bata --only firestore,auth "pnpm --filter @bata/api run test:emu"
pnpm exec firebase emulators:exec --project demo-bata --only auth "pnpm --filter @bata/web exec playwright test e2e/ar-spike.spec.ts"
```

## Pitfalls

- **ERR_PNPM_IGNORED_BUILDS** — si aparece un paquete nuevo con scripts de build, agrégalo a `allowBuilds` en `pnpm-workspace.yaml` con `true` (si lo necesita) o `false`; nunca `dangerouslyAllowAllBuilds`.
- **Biome y Tailwind** — `css.parser.tailwindDirectives` ya está activo en `biome.json`; no desactives el lint CSS.
- **`noUncheckedIndexedAccess`** — `array[0]` es `T | undefined`; usa `.at()` y guardas.
- **El preflight CORS con autorizador** — si asignas el autorizador por `defaultMethodOptions`, OPTIONS devolverá 401 y el navegador no verá nada.
- **esbuild para `synth`** — se resuelve desde `infra/node_modules/.bin` porque el script corre con `pnpm --filter @bata/infra run synth`; correr `cdk` fuera de pnpm cae a Docker y falla.
- **Emulador de Firestore** — exige Java 21; `ECONNREFUSED 127.0.0.1:8080` casi siempre es Java ausente.
- **Exports de `entry.ts`** — una declaración `export const` por línea; agruparlos (`export { a, b }`) rompe la extracción por regex de la prueba del paso 5.

## Before moving on

- [ ] Toda tarea de este epic está `done` en `tasks.json` — ninguna `in_progress`.
- [ ] Pasaron todos los comandos `verify` de cada tarea, no solo el primero.
- [ ] Ningún comando `verify` fue editado ni omitido.
- [ ] Cada tarea tiene su etiqueta (`git tag -l 'step-*'` lista `step-01-foundation` … `step-06-data-layer`).
- [ ] El gate pasa limpio desde la raíz del proyecto.
- [ ] Cada contrato "Produced" existe con la firma indicada.
- [ ] Ningún archivo fuera del subárbol fue modificado.
- [ ] `.env.example` sin cambios (este epic no agrega variables nuevas a los ejemplos).
- [ ] Un commit por tarea, con prefijo de id y seguido de su etiqueta.
