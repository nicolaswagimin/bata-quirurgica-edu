# AR v2 — progreso

Rama de trabajo: `feat/ar-v2`, creada desde `main`. `main` y producción no se tocan; nada de esta
rama se despliega. Plan completo: [ar-v2-plan.md](ar-v2-plan.md).

## Tabla de fases

| Fase | Estado | Inicio | Cierre | Commits |
|---|---|---|---|---|
| 0 · Spec + captura | implementación completa · pendiente el gate de capturas | 2026-11-07 | — | 4f8cbc7 … 5801034 |
| 1 · Protocolo y pasos | pendiente | — | — | — |
| 2 · Bata skinned | pendiente | — | — | — |
| 3 · Dataset | pendiente | — | — | — |
| 4 · Modelo | pendiente | — | — | — |
| 5 · Física (opcional) | pendiente | — | — | — |

## Bitácora

### 2026-11-07 — Fase 0: implementación

- Rama `feat/ar-v2` creada desde `main`.
- Plan y este registro añadidos (`4f8cbc7`).
- Contrato de features y de captura en `packages/shared/src/perception.ts` (`f76c7c9`).
- Extractor puro normalizado al torso, con velocidades y ángulos (`c34c829`).
- Grabador de ventanas a ~15 Hz (`e38b91c`).
- Hook por frame en el bucle del AR (`a0e0fc4`).
- Modo captura dev-only con consentimiento, descarga y borrado (`44ea70e`).
- Validador y estructura de `tools/vision/` (`5801034`).

Compuerta al cerrar la implementación:

- `pnpm typecheck` ✅ · `pnpm lint` ✅ (solo avisos previos de `!important`).
- `pnpm test` ✅ 371 (48 shared, 75 api, 212 web, 36 infra).
- `pnpm test:emu` ✅ 65.
- e2e de AR ✅ (los specs existentes no cambian con las banderas apagadas).
- `python3 -m unittest discover -s tools/vision` ✅ 11.

**Gate de la fase 0 pendiente**: grabar 10 tomas válidas de 2 personas y validarlas con
`tools/vision/validate.py`. Hasta entonces la fase no se marca cerrada.

## Cómo se actualiza

Al cerrar una fase: cambiar su estado en la tabla, anotar la fecha, los commits y la evidencia de la
puerta de salida (por ejemplo, el número de tomas válidas o los FPS medidos). No se marca una fase
como cerrada sin su puerta cumplida.
