---
description: Modelo de datos y reglas de Firestore
paths:
  - "firestore.rules"
  - "firestore.indexes.json"
  - "services/api/src/lib/repos.ts"
  - "services/api/scripts/seed.ts"
  - "content/**"
---

- Los clientes nunca escriben. `firestore.rules` termina en `match /{document=**}` con
  `allow read, write: if false`; cualquier colección nueva es solo-servidor hasta que una regla diga
  lo contrario y una prueba en `services/api/test/emu/rules.test.ts` lo cubra.
- `questionKeys/{questionId}` (respuestas correctas) jamás es legible por un cliente.
- Fechas: strings ISO-8601 UTC (`createdAt`, `updatedAt`, `validatedAt`); `lastActiveDate` es
  `YYYY-MM-DD` en America/Bogota (UTC−5, sin horario de verano).
- Nivel = `floor(sqrt(xp / 50)) + 1` (función `levelForXp` de `@bata/shared/gamification`).
- XP solo en la PRIMERA respuesta correcta por `(uid, questionId)`, dentro de una transacción.
- Índices: el compuesto `leaderboard (groupId ASC, xp DESC)` y el vectorial de `kbChunks.embedding`
  (1024, flat) viven en `firestore.indexes.json`; agregar ahí cualquier consulta compuesta nueva.
- El contenido de `content/**` se valida con los esquemas de `@bata/shared/schemas` en
  `packages/shared/test/schemas.test.ts`; no editar JSON sin correr esa prueba.
- La ubicación de Firestore (us-east1) es PERMANENTE; ningún script crea bases de datos.
