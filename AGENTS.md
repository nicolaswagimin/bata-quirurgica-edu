# Bata Quirúrgica Edu — instrucciones para agentes

Plataforma web gamificada para enseñar el uso correcto de la bata quirúrgica y la bioseguridad.

## Commands

| Tarea | Comando |
|---|---|
| Instalar | `pnpm install --frozen-lockfile` |
| Typecheck · Lint | `pnpm typecheck` · `pnpm lint` |
| Unit tests | `pnpm test` |
| Tests con emulador (Java 21) | `pnpm test:emu` |
| E2E | `pnpm test:e2e` · `pnpm test:e2e:emu` |
| Build web · CDK synth | `pnpm build` · `pnpm synth` |

Gate: `pnpm typecheck && pnpm lint && pnpm test`.

## Non-negotiable

1. Los clientes nunca escriben en Firestore; `questionKeys` nunca es legible por un cliente.
2. Los fotogramas de la cámara nunca salen del navegador.
3. Nunca `cdk deploy`, `aws`, `gcloud` ni `firebase deploy` desde el agente.
4. Nunca crear la base de Firestore (ubicación us-east1 permanente).
5. Nunca commitear secretos, `.env`, PDFs de la KB ni `public/mediapipe/`.
6. Nunca marcar una tarea como hecha con una compuerta fallando.

Arquitectura completa, límites de capas y tokens de diseño: `CLAUDE.md` en este directorio.
