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
- El XP de una misión se paga UNA sola vez, al aprobarla, dentro de la transacción de
  `finishAttemptTx`: respondes todo el examen y aciertas al menos `PASS_THRESHOLD`. Responder
  bien no da XP por sí solo. Un intento fallido o abandonado deja 0, y repetir una misión ya
  sellada es repaso (0 XP).
- `progress/{uid}/missions/{missionId}` guarda `sealed`, `stars` (récord 0–3) y `bestCorrect`;
  un repaso puede mejorar las estrellas aunque no pague XP.
- Desbloqueo secuencial: `POST /quiz/attempt` exige que la misión anterior (por `order`) esté
  sellada; si no, responde 403 `FORBIDDEN` (`mission_locked`).
- `users/{uid}` lleva `xpToday` y `dailyGoalDate` (Bogotá): la meta diaria se reinicia sola al
  cambiar de día. La racha (`streakDays`, `lastActiveDate`) avanza solo cuando el examen se aprueba.
- Vidas: el tercer fallo cierra el intento. El servidor lo deduce de `answered - correct`
  (`MAX_LIVES`), nunca de un campo que mande el cliente.
- Índices: el compuesto `leaderboard (groupId ASC, xp DESC)` y el vectorial de `kbChunks.embedding`
  (1024, flat) viven en `firestore.indexes.json`; agregar ahí cualquier consulta compuesta nueva.
- El contenido de `content/**` se valida con los esquemas de `@bata/shared/schemas` en
  `packages/shared/test/schemas.test.ts`; no editar JSON sin correr esa prueba.
- La ubicación de Firestore (us-east1) es PERMANENTE; ningún script crea bases de datos.
