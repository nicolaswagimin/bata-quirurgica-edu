---
name: run-emulator-gates
description: Usar cuando una verificación necesita los emuladores de Firebase (Firestore/Auth) — p. ej. "corre las pruebas de reglas", "pruebas con emulador", "e2e @emu", o un error ECONNREFUSED 127.0.0.1:8080 / 9099.
---

# Correr compuertas con emuladores

## Cuándo usar
Pruebas en `services/api/test/emu/`, specs Playwright con `@emu`, o el seed local.

## Pasos
1. Confirmar Java 21: `java -version` (el devcontainer lo trae; el emulador de Firestore lo exige).
2. Nunca arrancar emuladores sueltos para una compuerta: usar `emulators:exec`, que los inicia, corre
   el comando con `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST` y los apaga.
3. El proyecto es siempre `demo-bata` (prefijo `demo-`: no toca ningún proyecto real).

## Verify
```bash
pnpm test:emu                       # expect: exit 0 — pruebas de services/api/test/emu
pnpm test:e2e:emu                   # expect: exit 0 — seed + specs @emu con API local
```

## No hacer
- Apuntar pruebas a un proyecto real o quitar el prefijo `demo-`.
- Reintentar a ciegas un `ECONNREFUSED`: casi siempre es Java ausente o un puerto ocupado.
