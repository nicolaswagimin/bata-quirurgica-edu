# AR v2 — progreso

Rama de trabajo: `feat/ar-v2`, creada desde `main`. `main` y producción no se tocan; nada de esta
rama se despliega. Plan completo: [ar-v2-plan.md](ar-v2-plan.md).

## Tabla de fases

| Fase | Estado | Inicio | Cierre | Commits |
|---|---|---|---|---|
| 0 · Spec + captura | 10 tomas válidas · pendiente la segunda persona | 2026-11-07 | — | 4f8cbc7 … fb28d35 |
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

### 2026-11-07 — Primeras capturas

10 tomas descargadas por el autor y validadas con `tools/vision/validate.py`: **10 válidas, 0 con
errores**, en `tools/vision/data/` (gitignored). Cubren los seis pasos:

| Paso | Tomas |
|---|---|
| `g1-mascarilla` | 2 |
| `g2-manos` | 2 |
| `g3-bata` | 1 |
| `g4-lazos` | 1 |
| `g5-guantes` | 2 |
| `g6-solapa` | 2 |

Calidad interna: muñecas visibles en el 100 % de los frames, confianza media 0,69–0,87 y ancho de
hombros de 54–66 px. Las tomas son de una sola sesión (03:17–03:22 UTC), así que la diversidad de
personas del gate sigue pendiente; además conviene acercarse un poco para que los hombros ocupen
más píxeles en la próxima tanda.

**Gate de la fase 0 pendiente**: falta la segunda persona (2–3 tomas bastan) además de estas 10.
Hasta entonces la fase no se marca cerrada.

## Cómo se actualiza

Al cerrar una fase: cambiar su estado en la tabla, anotar la fecha, los commits y la evidencia de la
puerta de salida (por ejemplo, el número de tomas válidas o los FPS medidos). No se marca una fase
como cerrada sin su puerta cumplida.
