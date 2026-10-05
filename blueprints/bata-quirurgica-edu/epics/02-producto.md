# Epic 02: Producto

> Al terminar existen el perfil con consentimiento y grupos, el quiz transaccional con XP/racha/ranking, la UI de misiones, el ranking en vivo, el perfil, el modo 3D, los créditos y el AR espejo completo con "Ver en tu espacio".

| | |
|---|---|
| **Epic id** | `02-producto` |
| **Tasks** | `E2-T1` … `E2-T6` |
| **Depends on** | `01-plataforma` |
| **Unlocks** | `03-asistente-operacion` |
| **Parallel with** | ninguno (comparte `entry.ts` y rutas web) |

No necesitas ningún otro archivo para completar este epic. Todo lo de abajo se repite aquí a propósito.

---

## Stack

Vite + React 19 SPA · TypeScript 6 · Tailwind v4 · TanStack Router/Query · Firebase Auth + Firestore · API Gateway REST + Lambda (Node 24) · three.js + @react-three/fiber + drei · MediaPipe · model-viewer · Vitest · Playwright.
Gestor: `pnpm` 11. Runtime en `.nvmrc` (24). Versiones en el lockfile — nunca adivines una.

| Tarea | Comando |
|---|---|
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Test (un archivo) | `pnpm --filter @bata/web exec vitest run test/unit/gown-overlay.test.ts` |
| Tests API con emulador | `pnpm exec firebase emulators:exec --project demo-bata --only firestore,auth "pnpm --filter @bata/api exec vitest run --config vitest.emu.config.ts test/emu/me.test.ts"` |
| E2E con emuladores + seed + API local | `pnpm test:e2e:emu` |
| Seed local | `pnpm exec firebase emulators:exec --project demo-bata --only firestore "pnpm --filter @bata/api run seed"` |
| API local | `pnpm --filter @bata/api run dev` (127.0.0.1:3001/v1) |
| Servicios locales | emuladores Firebase (auth 9099, firestore 8080) vía `firebase emulators:exec`; Firestore requiere Java 21 |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar cualquier tarea como hecha.

`pnpm test:e2e:emu` = `firebase emulators:exec --project demo-bata --only firestore,auth "pnpm --filter @bata/web run test:e2e:emu"`, que corre el seed y luego `E2E_WITH_API=1 playwright test --grep @emu` (Playwright arranca el API local y el `vite preview`). Corre **todos** los specs `@emu` existentes, incluido el del AR: ejecuta `pnpm --filter @bata/web run mediapipe:prepare` antes.

Las líneas de Verify que comprueban la salida de un CLI la canalizan a `grep -q '<texto fijo>'`; el CLI debe imprimir ese texto exacto.

## Directory subtree

```
services/api/
  src/routes/me.ts            # NUEVO (T1)
  src/routes/quiz.ts          # NUEVO (T2)
  src/handlers/entry.ts       # existe; editar (T1: me, T2: quiz)
  scripts/set-admin.ts        # NUEVO (T1)
  scripts/seed.ts             # NUEVO (T2)
  scripts/dev-server.ts       # NUEVO (T2)
  test/emu/me.test.ts         # NUEVO (T1)
  test/emu/quiz.test.ts       # NUEVO (T2)
  src/lib/http.ts  config.ts  identity.ts  repos.ts  quota.ts   # existen, solo lectura
apps/web/
  src/lib/api.ts              # NUEVO (T3)
  src/routes/home.tsx  mision.tsx            # NUEVOS (T3)
  src/routes/ranking.tsx  perfil.tsx         # NUEVOS (T4)
  src/three/steps.ts  src/three/mannequin.tsx  src/routes/bata-3d.tsx  src/routes/creditos.tsx   # NUEVOS (T5)
  src/ar/gown-overlay.ts  src/routes/bata-espacio.tsx   # NUEVOS (T6)
  src/routes/bata-ar.tsx      # existe; editar (T6)
  e2e/quiz.spec.ts  ranking.spec.ts  perfil.spec.ts  bata-3d.spec.ts  ar-full.spec.ts   # NUEVOS
  test/unit/gown-overlay.test.ts   # NUEVO (T6)
  src/router.tsx  src/lib/firebase.tsx  src/ar/overlay-math.ts  src/ar/pose.ts  e2e/helpers.ts   # existen, solo lectura
content/questions/seed.json  content/protocolos/bata-pasos.json  content/credits.json   # existen, solo lectura
```

Las páginas nuevas se registran solas: el router carga `src/routes/<nombre>.tsx` (export default) por `import.meta.glob`. No edites `router.tsx`. Si una tarea parece requerir otro archivo, detente y repórtalo.

## Data model touched here

| Entidad | Campos que este epic escribe o lee | Notas |
|---|---|---|
| `users/{uid}` | todos | creado por `POST /me`; xp/level/streakDays/lastActiveDate por el quiz |
| `groups/{groupId}` | name, joinCode | unión por código (`POST /me`, `POST /me/group`) |
| `missions`, `questions`, `questionKeys`, `appConfig/flags` | todos | escritos por el seed |
| `progress/{uid}/attempts/{id}` | questionId, missionId, selectedOptionIds, correct, xpAwarded, createdAt | uno por respuesta |
| `progress/{uid}/missions/{missionId}` | answeredCorrectIds, completed, completedAt | completada cuando todas sus `questionIds` están respondidas bien |
| `leaderboard/{uid}` | displayName, xp, level, groupId, updatedAt | índice compuesto `groupId ASC, xp DESC` |

Nivel = `floor(sqrt(xp / 50)) + 1`; racha = días consecutivos (America/Bogota) con al menos una correcta; XP solo en la primera respuesta correcta por `(uid, questionId)`.

## Contracts

**Consumed:**

| De | Interfaz | Garantía |
|---|---|---|
| `01-plataforma` | `@bata/shared/schemas` (`CreateProfileSchema`, `JoinGroupSchema`, `AnswerRequestSchema`, `AnswerResponseSchema`, `SeedFileSchema`, `BataPasosSchema`, `CreditsSchema`, `POLICY_VERSION`, `messageForStatus`) | esquemas zod estrictos |
| `01-plataforma` | `@bata/shared/gamification` (`levelForXp`, `bogotaDate`, `nextStreak`, `sameSet`) | puros |
| `01-plataforma` | `services/api/src/lib/http.ts` (`json`, `errorResponse`, `HttpError`, `parseJsonBody`, `readAuthContext`, `withJsonHandler`) | CORS en toda respuesta |
| `01-plataforma` | `services/api/src/lib/identity.ts` (`getDb`, `getAdminAuth`) | emulador si hay variables de emulador |
| `01-plataforma` | `services/api/src/lib/repos.ts` (`getUser`, `createProfileBatch`, `findGroupByCode`, `setUserGroup`, `deleteUserData`) | |
| `01-plataforma` | `entry.ts` exports `authorizer`, `notImplemented` (una línea `export const` por export) | autorizador TOKEN |
| `01-plataforma` | `apps/web/src/lib/firebase.tsx` (`auth`, `db`, `env`, `useAuth`) · `overlay-math.ts` (`computeGownAnchor`, `FpsMonitor`) · `pose.ts` (`createPoseLandmarker`) | |

**Produced:**

| Export | Firma | Usado por |
|---|---|---|
| `services/api/src/routes/me.ts` → `handleMe` | `(event, deps?) => Promise<APIGatewayProxyResult>` | entry `me` |
| `services/api/src/routes/quiz.ts` → `handleQuiz` | `(event, deps?: { now: () => Date }) => Promise<APIGatewayProxyResult>` | entry `quiz` |
| `services/api/scripts/seed.ts` → `seedContent` | `(db, file) => Promise<void>` | `03` (pruebas admin), e2e |
| `services/api/scripts/set-admin.ts` → `setAdmin` | `(email: string) => Promise<void>` | lanzamiento |
| `services/api/scripts/dev-server.ts` | HTTP 127.0.0.1:3001, prefijo `/v1`, despacha a los exports de `entry.ts` | e2e de 02 y 03 |
| `apps/web/src/lib/api.ts` → `apiFetch`, `ApiError` | `<T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>` | 03 |
| `apps/web/src/ar/gown-overlay.ts` → `gownGeometry`, `drawGown` | `(anchor \| null) => GownGeometry` | — |

## Conventions that bite in this area

- `entry.ts`: cada export es una línea `export const <nombre> = …` que usa `await import('../routes/<x>.ts')` para que cada Lambda evalúe solo su código (la prueba CDK del paso 5 lee esos nombres).
- Las rutas del API se enrutan por `event.httpMethod` + `event.path` (sin `/v1`).
- El cliente nunca escribe en Firestore; todo cambio pasa por `apiFetch`.
- Preguntas en el cliente: si `appConfig/flags.showDraftQuestions` es true, consultar `where('missionId','==',id)`; si no, agregar `where('status','==','validated')` (las reglas no filtran, rechazan).
- Specs con emuladores llevan `@emu` en el título y usan `e2e/helpers.ts` (`createEmulatorUser`, `loginViaUi`, `uniqueEmail`, `TEST_PASSWORD`).
- Sin `dangerouslySetInnerHTML`; colores solo por tokens.

Reglas completas: `CLAUDE.md`. Reglas por área: `.claude/rules/*.md`.

---

## Tasks

### `E2-T1` — Add profile, consent, group join, account deletion, set-admin

**Depends on:** E1-T6 · **Priority:** p0

`handleMe` enruta `POST /me` (`CreateProfileSchema` — `{ displayName 2–60, consent: { policyVersion: POLICY_VERSION, accepted: true }, groupCode?: /^[A-Z0-9]{6}$/ }`; 409 `CONFLICT` si el perfil existe; escribe `users/{uid}` y `leaderboard/{uid}` en un batch con `email` del token o vacío), `GET /me`, `DELETE /me` (`deleteUserData` + `getAdminAuth().deleteUser(uid)` → 204) y `POST /me/group` (`JoinGroupSchema` `{ groupCode }`). `set-admin.ts` exporta `setAdmin(email)` y como CLI: con `--help` imprime **exactamente** la línea `Uso: set-admin <correo>` y sale 0; sin argumento imprime esa misma línea y sale 2; ignora un `--` literal en `argv`; ejecuta `main` solo si `import.meta.url === pathToFileURL(process.argv[1] ?? '').href`. La línea de uso es la que verifica el `grep` del Verify, así que no la traduzcas ni la adornes. La prueba crea usuarios con `getAdminAuth().createUser` y construye eventos con `requestContext.authorizer`.

**Files**
- `services/api/src/routes/me.ts` — nuevo
- `services/api/src/handlers/entry.ts` — editar: `me` real
- `services/api/scripts/set-admin.ts` — nuevo
- `services/api/test/emu/me.test.ts` — nuevo

**Acceptance**

1. WHEN `POST /me` arrives with `{ displayName, consent: { policyVersion: POLICY_VERSION, accepted: true } }` THE SYSTEM SHALL create `users/{uid}` with role `student`, xp 0, level 1, streakDays 0, `consent.policyVersion` and `consent.acceptedAt`, and respond 201 with the profile.
2. WHEN `POST /me` arrives without consent, with `accepted: false` or with a different `policyVersion` THE SYSTEM SHALL respond 422 `VALIDATION_ERROR` and create no document.
3. WHEN `POST /me` or `POST /me/group` carries a `groupCode` that matches a group THE SYSTEM SHALL set `groupId` on `users/{uid}` and `leaderboard/{uid}`, and WHEN no group matches THE SYSTEM SHALL respond 404 `NOT_FOUND`.
4. WHEN `GET /me` is called by a user without a profile THE SYSTEM SHALL respond 404 `NOT_FOUND`, and by a user with a profile THE SYSTEM SHALL respond 200 with it.
5. WHEN `DELETE /me` is called THE SYSTEM SHALL delete `users/{uid}`, everything under `progress/{uid}`, `leaderboard/{uid}`, `quotas/{uid}` and the Firebase Auth user, and respond 204.
6. WHEN `setAdmin(email)` runs against the emulator THE SYSTEM SHALL set the custom claim `role: 'admin'` on that Auth user and `role: 'admin'` on `users/{uid}` when it exists, and `pnpm --filter @bata/api run set-admin -- --help` SHALL print `Uso: set-admin <correo>`.

**Verify**

```bash
pnpm exec firebase emulators:exec --project demo-bata --only firestore,auth "pnpm --filter @bata/api exec vitest run --config vitest.emu.config.ts test/emu/me.test.ts"
pnpm --filter @bata/api run set-admin -- --help | grep -q 'Uso: set-admin <correo>'
pnpm --filter @bata/api typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T1: add profile, consent, group join, account deletion, set-admin"
git tag step-07-profile
```

### `E2-T2` — Add seed script, transactional quiz answers and local API

**Depends on:** E2-T1 · **Priority:** p0

`seedContent(db, file)` valida con `SeedFileSchema` y escribe `missions/{id}` (con `questionIds` derivados en orden), `questions/{id}` (`status: 'draft'`, `createdBy: 'seed'`, `validatedBy: null`, `validatedAt: null`), `questionKeys/{id}` y `appConfig/flags` (`showDraftQuestions = process.env.SHOW_DRAFT_QUESTIONS === 'true'`) con `set` (idempotente). El CLI se niega a correr sin `FIRESTORE_EMULATOR_HOST` salvo con `--allow-remote`. `handleQuiz` hace todo en `db.runTransaction`: lecturas primero (pregunta → 404 si no existe o es draft sin `SHOW_DRAFT_QUESTIONS === 'true'`; clave; usuario → 404 sin perfil; misión; progreso), luego escrituras (intento, progreso, usuario con `xp`, `level = levelForXp(xp)`, racha con `nextStreak` solo si es correcta, `leaderboard/{uid}`). Respuesta `{ correct, explanation, source, xpAwarded, totalXp, level, streakDays }`, nunca `correctOptionIds`. El reloj se inyecta (`deps.now`) para probar la racha. `dev-server.ts`: `node:http` en `127.0.0.1:3001`; `OPTIONS` → 204 con CORS; `GET /v1/health` → 200 `{"ok":true}`; demás rutas: quita `/v1`, invoca el export `authorizer` con `{ type: 'TOKEN', authorizationToken, methodArn: 'arn:aws:execute-api:us-east-1:000000000000:local/v1/<METHOD>/<path>' }` (fallo → 401 con el sobre), arma el `APIGatewayProxyEvent` con `requestContext.authorizer` y despacha por prefijo (`/me`→`me`, `/quiz`→`quiz`, `/assistant/chat`→`chat`, `/assistant/transcribe`→`transcribe`, `/admin`→`admin`). Antes de importar `entry.ts` instala `globalThis.awslambda = { streamifyResponse: (fn) => fn, HttpResponseStream: { from: (res, meta) => { res.writeHead(meta.statusCode, meta.headers); return res; } } }` (el servidor local hace de gateway: sin preludio). `WEB_ORIGIN` por defecto `http://localhost:5173`. Con `--smoke`: escucha, pide `/v1/health`, exige 200 y `{"ok":true}`, cierra y sale 0 (si no, 1).

**Files**
- `services/api/scripts/seed.ts` — nuevo
- `services/api/src/routes/quiz.ts` — nuevo
- `services/api/src/handlers/entry.ts` — editar: `quiz` real
- `services/api/scripts/dev-server.ts` — nuevo
- `services/api/test/emu/quiz.test.ts` — nuevo

**Acceptance**

1. WHEN `seed` runs twice against the emulator THE SYSTEM SHALL leave exactly one `missions` doc per mission and one `questions` doc plus one `questionKeys` doc per question listed in `content/questions/seed.json`, every question with status `draft`.
2. WHEN `POST /quiz/answer` receives the correct option ids for a question for the first time THE SYSTEM SHALL respond 200 with `correct: true`, `xpAwarded` equal to the question's `xp`, `totalXp`, `level` computed by `levelForXp`, `streakDays`, `explanation` and `source`, and SHALL write one attempt and update `leaderboard/{uid}`.
3. WHEN the same user answers the same question correctly a second time THE SYSTEM SHALL respond `xpAwarded: 0` and leave `users/{uid}.xp` unchanged.
4. WHEN the answer is wrong THE SYSTEM SHALL respond `correct: false` and `xpAwarded: 0`, and no response SHALL ever include `correctOptionIds`.
5. WHEN a user answers correctly on consecutive America/Bogota days THE SYSTEM SHALL increase `streakDays` by one per day, and SHALL reset it to 1 after a day without a correct answer.
6. WHEN `pnpm --filter @bata/api run dev:smoke` runs inside the emulators THE SYSTEM SHALL start the local API on 127.0.0.1:3001, receive 200 `{ "ok": true }` from `/v1/health` and exit 0.

**Verify**

```bash
pnpm exec firebase emulators:exec --project demo-bata --only firestore,auth "pnpm --filter @bata/api exec vitest run --config vitest.emu.config.ts test/emu/quiz.test.ts"
pnpm exec firebase emulators:exec --project demo-bata --only firestore "pnpm --filter @bata/api run seed && pnpm --filter @bata/api run seed"
pnpm exec firebase emulators:exec --project demo-bata --only firestore,auth "pnpm --filter @bata/api run dev:smoke"
pnpm --filter @bata/api typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T2: add seed script, transactional quiz answers and local API"
git tag step-08-quiz-api
```

### `E2-T3` — Build mission map, onboarding consent and quiz UI

**Depends on:** E2-T2, E1-T3 · **Priority:** p0

`api.ts`: `apiFetch` con `env.VITE_API_BASE_URL`, `Authorization: Bearer <getIdToken()>`; ante 401 reintenta una vez tras `getIdToken(true)`; si vuelve 401, `signOut(auth)` y lanza `ApiError(401, messageForStatus(401))`; otros errores → `ApiError(status, messageForStatus(status))`. `home.tsx`: `ProfileGate` (`GET /me` con TanStack Query; 404 → formulario de consentimiento con la casilla premarcada si existe `sessionStorage['bata.pendingConsent']`, nombre visible y código de grupo opcional → `POST /me` → borrar la clave de sessionStorage); con perfil: misiones (`getDocs(query(collection(db,'missions'), orderBy('order')))`), progreso, píldora de XP (`bg-xp text-ink`), nivel y racha (llama `aria-hidden` + número). `mision.tsx`: preguntas de la misión, radios o checkboxes según `type`, badge "Borrador", al responder `POST /quiz/answer` y mostrar "¡Correcto!"/"Incorrecto", explicación, fuente y "+N XP"; invalida `['me']` y `['progress']`. El spec `@emu` registra, completa el onboarding, responde la primera pregunta de `m1-fundamentos` con su respuesta correcta (`q01` → `b`) y verifica la píldora; el caso 401 usa `page.route('**/v1/**', r => r.fulfill({ status: 401, … }))`.

**Files**
- `apps/web/src/lib/api.ts` — nuevo
- `apps/web/src/routes/home.tsx` — nuevo
- `apps/web/src/routes/mision.tsx` — nuevo
- `apps/web/e2e/quiz.spec.ts` — nuevo

**Acceptance**

1. WHEN a signed-in user without a profile opens `/` THE SYSTEM SHALL show the consent form, prefilled as accepted when `/registro` stored the acceptance, and on submit SHALL call `POST /me` and then render the mission map.
2. WHEN a user with a profile opens `/` THE SYSTEM SHALL list the seeded missions by `order` with their titles and show the XP pill, the level and the streak count from `users/{uid}`.
3. WHEN the user answers a question in `/mision/$missionId` THE SYSTEM SHALL show `¡Correcto!` or `Incorrecto`, the explanation, the source (`org`, `title`, `year`, `section`) and the XP gained, and the XP pill SHALL show the new total.
4. WHEN a question has status `draft` THE SYSTEM SHALL show the badge `Borrador` next to its prompt.
5. WHEN an API call receives 401 again after a forced token refresh THE SYSTEM SHALL sign the user out and show `Tu sesión expiró, vuelve a iniciar sesión`.

**Verify**

```bash
pnpm --filter @bata/web typecheck
pnpm --filter @bata/web run mediapipe:prepare
pnpm test:e2e:emu
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T3: build mission map, onboarding consent and quiz UI"
git tag step-09-quiz-ui
```

### `E2-T4` — Build realtime ranking and profile page

**Depends on:** E2-T3 · **Priority:** p1

`ranking.tsx`: pestañas "Global" (`query(collection(db,'leaderboard'), orderBy('xp','desc'), limit(20))`) y "Mi grupo" (solo si el perfil tiene `groupId`: `where('groupId','==',groupId)` + mismo orden), suscripción `onSnapshot` en un efecto con limpieza al desmontar o cambiar de pestaña; estado vacío exacto. `perfil.tsx`: datos del perfil, formulario de código de grupo (`POST /me/group`; 404 → "No encontramos un grupo con ese código"; 200 → "Te uniste al grupo") y "Eliminar mi cuenta" con diálogo accesible (foco atrapado, Escape cierra) → `DELETE /me` → `signOut` → `/login`. En los specs `@emu`, los grupos se crean por REST del emulador: `POST http://127.0.0.1:8080/v1/projects/demo-bata/databases/(default)/documents/groups?documentId=<id>` con `Authorization: Bearer owner` y cuerpo `{ "fields": { "name": { "stringValue": "…" }, "joinCode": { "stringValue": "ABC123" } } }`; el cambio de XP de otro usuario se provoca con `request.post('http://127.0.0.1:3001/v1/quiz/answer', …)` usando el `idToken` de `createEmulatorUser` (antes `POST /v1/me`).

**Files**
- `apps/web/src/routes/ranking.tsx` — nuevo
- `apps/web/src/routes/perfil.tsx` — nuevo
- `apps/web/e2e/ranking.spec.ts` — nuevo
- `apps/web/e2e/perfil.spec.ts` — nuevo

**Acceptance**

1. WHEN `/ranking` is open and another user's XP changes in `leaderboard` THE SYSTEM SHALL update the list without a reload, ordered by `xp` descending, showing at most 20 rows.
2. WHEN the user belongs to a group THE SYSTEM SHALL offer a `Mi grupo` tab listing only leaderboard entries with that `groupId`.
3. WHEN the ranking has no entries THE SYSTEM SHALL show `Aún no hay puntajes. ¡Responde tu primera misión!`.
4. WHEN the user submits an existing 6-character code in `/perfil` THE SYSTEM SHALL call `POST /me/group` and show `Te uniste al grupo`, and WHEN the code does not exist THE SYSTEM SHALL show `No encontramos un grupo con ese código`.
5. WHEN the user confirms `Eliminar mi cuenta` THE SYSTEM SHALL call `DELETE /me`, sign out and land on `/login`, and a later login with the same credentials SHALL fail.

**Verify**

```bash
pnpm --filter @bata/web typecheck
pnpm test:e2e:emu
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T4: build realtime ranking and profile page"
git tag step-10-ranking-profile
```

### `E2-T5` — Build didactic 3D mode and credits page

**Depends on:** E1-T2 · **Priority:** p1

`steps.ts`: `buildTimeline(pasos, mode)` ordena por `order` y asigna a cada paso un progreso de la bata (0 → 1 en colocación, 1 → 0 en retiro) y sus hotspots. `mannequin.tsx`: maniquí con primitivas (cápsulas/cilindros/esfera) y bata (cilindro abierto + dos mangas) en `@react-three/fiber`; anima con `useFrame` hacia el progreso del paso actual salvo con `prefers-reduced-motion` (salto directo); hotspots con `Html` de drei. Activo real opcional: si algún día existe `/models/bata.glb` se carga con `useGLTF`; ningún gate lo necesita. `bata-3d.tsx`: lienzo con `aria-label`, pestañas "Colocación"/"Retiro", lista de pasos en HTML, botones "Anterior"/"Siguiente", región `aria-live="polite"` con el título del paso, botones de hotspots (etiquetas de `bata-pasos.json`, p. ej. "Zona estéril frontal") que muestran su descripción, contenedor con `data-animate="true|false"`. `creditos.tsx` es pública (fuera de `RequireAuth`, ya declarado en el router). El spec es `@emu` por el login; usa `page.emulateMedia({ reducedMotion: 'reduce' })` para el último criterio.

**Files**
- `apps/web/src/three/steps.ts` — nuevo
- `apps/web/src/three/mannequin.tsx` — nuevo
- `apps/web/src/routes/bata-3d.tsx` — nuevo
- `apps/web/src/routes/creditos.tsx` — nuevo
- `apps/web/e2e/bata-3d.spec.ts` — nuevo

**Acceptance**

1. WHEN a signed-in user opens `/bata-3d` THE SYSTEM SHALL render a WebGL canvas with the procedural mannequin and gown and a list `Colocación` with every `donning` step of `content/protocolos/bata-pasos.json` in `order`.
2. WHEN the user presses `Siguiente` THE SYSTEM SHALL advance to the next step and announce its title in an `aria-live` region, and the `Retiro` tab SHALL switch the list to the `doffing` steps.
3. WHEN the user activates the hotspot button `Zona estéril frontal` THE SYSTEM SHALL show its description from `content/protocolos/bata-pasos.json`.
4. WHEN `/creditos` is opened without signing in THE SYSTEM SHALL list every asset in `content/credits.json` with title, author, license and modifications.
5. WHEN `prefers-reduced-motion: reduce` is emulated THE SYSTEM SHALL change steps without animation, exposing `data-animate="false"` on the 3D container.

**Verify**

```bash
pnpm --filter @bata/web typecheck
pnpm exec firebase emulators:exec --project demo-bata --only auth "pnpm --filter @bata/web exec playwright test e2e/bata-3d.spec.ts"
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T5: build didactic 3D mode and credits page"
git tag step-11-3d-mode
```

### `E2-T6` — Complete AR mirror overlay and model-viewer space view

**Depends on:** E1-T3, E2-T5 · **Priority:** p1

`gown-overlay.ts` es puro: `gownGeometry(anchor)` devuelve el contorno de la bata (de hombros a caderas, ancho 1,4× el de hombros, mangas desde los hombros) y las posiciones de `cuello`, `punos`, `zona-esteril`, `mangas`, `cierre-posterior`, todo rotado por el ángulo de hombros; con `null` devuelve `{ shapes: [], hotspots: [] }`. `drawGown(ctx, geometry)` dibuja en el canvas (separado para que la prueba unitaria no necesite DOM). Editar `bata-ar.tsx`: dibuja la bata semitransparente con `--color-primary`, chips de hotspots con su descripción, guía "Colócate de frente a la cámara, con hombros y caderas visibles" cuando no hay ancla, aviso de FPS con enlace a `/bata-3d`; con `import.meta.env.MODE === 'e2e'` y `?simularFpsBajo=1` fuerza `lowPerformance` (gancho de prueba). Conserva el estado `[data-testid=ar-status]` del spike. `bata-espacio.tsx`: `import '@google/model-viewer'`; `fetch('/models/bata.glb', { method: 'HEAD' })`; si existe, `<model-viewer src="/models/bata.glb" ar ar-modes="webxr scene-viewer quick-look" camera-controls alt="Bata quirúrgica en 3D">`; si no, el aviso exacto con enlace a `/bata-3d`. El spec `@emu` reutiliza el patrón de privacidad del spike (registrar peticiones tras la navegación por el `<nav>`).

**Files**
- `apps/web/src/ar/gown-overlay.ts` — nuevo
- `apps/web/src/routes/bata-ar.tsx` — editar
- `apps/web/src/routes/bata-espacio.tsx` — nuevo
- `apps/web/test/unit/gown-overlay.test.ts` — nuevo
- `apps/web/e2e/ar-full.spec.ts` — nuevo

**Acceptance**

1. WHEN `gownGeometry` receives an anchor THE SYSTEM SHALL return the gown outline and the positions of the five hotspots `cuello`, `punos`, `zona-esteril`, `mangas` and `cierre-posterior` in canvas pixels, scaled by the shoulder width and rotated by the shoulder angle.
2. WHEN `gownGeometry` receives `null` THE SYSTEM SHALL return no shapes, and `/bata-ar` SHALL show `Colócate de frente a la cámara, con hombros y caderas visibles`.
3. WHEN the user activates a hotspot chip on `/bata-ar` THE SYSTEM SHALL show that hotspot's description from `content/protocolos/bata-pasos.json`.
4. WHEN the FPS monitor reports low performance THE SYSTEM SHALL show `Tu dispositivo va lento con la cámara. Prueba el modo 3D` with a link to `/bata-3d`.
5. WHEN `/bata-espacio` opens THE SYSTEM SHALL define the `model-viewer` custom element with `ar-modes="webxr scene-viewer quick-look"`, and WHEN `/models/bata.glb` is absent THE SYSTEM SHALL show `El modelo 3D definitivo aún no está disponible` with a link to `/bata-3d`.
6. WHEN the complete AR session runs for 5 seconds THE SYSTEM SHALL still issue zero requests whose method is not GET and zero requests to any origin other than the page origin.

**Verify**

```bash
pnpm --filter @bata/web exec vitest run test/unit/gown-overlay.test.ts
pnpm --filter @bata/web run mediapipe:prepare
pnpm exec firebase emulators:exec --project demo-bata --only auth "pnpm --filter @bata/web exec playwright test e2e/ar-full.spec.ts e2e/ar-spike.spec.ts"
pnpm --filter @bata/web typecheck
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T6: complete AR mirror overlay and model-viewer space view"
git tag step-12-ar-full
```

---

## Epic acceptance

El epic está hecho cuando todas sus tareas están `done` **y**:

1. WHEN a new user registers, completes onboarding, answers a seeded question and opens `/ranking` THE SYSTEM SHALL show that user's XP in the live ranking.
2. WHEN the AR and 3D specs run THE SYSTEM SHALL keep every request same-origin and GET-only during the AR session.

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @bata/web run mediapipe:prepare
pnpm test:e2e:emu
pnpm exec firebase emulators:exec --project demo-bata --only firestore,auth "pnpm --filter @bata/api run test:emu"
```

## Pitfalls

- **Reglas no son filtros** — una consulta de `questions` sin `status == 'validated'` falla entera si los borradores no están habilitados.
- **Transacciones de Firestore** — todas las lecturas antes de cualquier escritura; si no, el SDK lanza.
- **`onSnapshot` sin limpieza** — fuga de listeners y cobro de lecturas; devuelve el `unsubscribe` en el efecto.
- **Recargar la página en specs de privacidad** — mezcla tráfico de Auth; navega con el `<nav>`.
- **WebGL en headless** — Chromium usa SwiftShader; asserta el `<canvas>` y la lista HTML, no píxeles.
- **model-viewer sin activo** — nunca pongas `src` a un archivo inexistente: el aviso es el comportamiento correcto hasta la tarea humana del activo.
- **Textos de CLI verificados por `grep`** — `Uso: set-admin <correo>` es un contrato; cambiarlo rompe el Verify de E2-T1.

## Before moving on

- [ ] Toda tarea de este epic está `done` en `tasks.json` — ninguna `in_progress`.
- [ ] Pasaron todos los comandos `verify` de cada tarea, no solo el primero.
- [ ] Ningún comando `verify` fue editado ni omitido.
- [ ] Cada tarea tiene su etiqueta (`step-07-profile` … `step-12-ar-full`).
- [ ] El gate pasa limpio desde la raíz del proyecto.
- [ ] Cada contrato "Produced" existe con la firma indicada.
- [ ] Ningún archivo fuera del subárbol fue modificado.
- [ ] `.env.example` sin cambios (este epic no agrega variables).
- [ ] Un commit por tarea, con prefijo de id y seguido de su etiqueta.
