---
name: add-api-route
description: Usar al agregar o cambiar un endpoint del API (services/api) — p. ej. "agrega un endpoint", "nueva ruta POST", "exponer X en la API". Cubre esquema zod, ruta, export Lambda, CDK y pruebas.
---

# Agregar una ruta al API

## Cuándo usar
Cualquier endpoint nuevo o cambio de contrato en `services/api`.

## Pasos
1. Esquema de entrada/salida en `packages/shared/src/schemas.ts` (+ caso en `packages/shared/test/schemas.test.ts`).
2. Lógica en `services/api/src/routes/<dominio>.ts`, enrutada por `event.httpMethod` + `event.path`,
   respondiendo solo con `json()` / `errorResponse()` de `src/lib/http.ts`.
3. Si es un dominio nuevo, export en `src/handlers/entry.ts` con `await import('../routes/<dominio>.ts')`.
4. Recurso y método en `infra/lib/api-stack.ts` con el autorizador TOKEN (salvo `/health`), y su
   aserción en `infra/test/stacks.test.ts`.
5. Prueba: unitaria con dependencias inyectadas o `test/emu/<dominio>.test.ts` si toca Firestore.

## Verify
```bash
pnpm --filter @bata/api typecheck                      # expect: exit 0
pnpm --filter @bata/api test                           # expect: exit 0, 0 failed
pnpm --filter @bata/infra exec vitest run test/stacks.test.ts                         # expect: exit 0
pnpm test:emu                                          # expect: exit 0 (requiere Java 21)
```

## No hacer
- Leer `process.env` al cargar el módulo, devolver errores sin CORS, o llamar a Groq/Bedrock antes de la cuota.
