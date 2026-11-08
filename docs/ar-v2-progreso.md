# AR v2 — progreso

Rama de trabajo: `feat/ar-v2`, creada desde `main`. `main` y producción no se tocan; nada de esta
rama se despliega. Plan completo: [ar-v2-plan.md](ar-v2-plan.md).

## Tabla de fases

| Fase | Estado | Inicio | Cierre | Commits |
|---|---|---|---|---|
| 0 · Spec + captura | cerrada con excepción de diversidad | 2026-11-07 | 2026-11-07 | 4f8cbc7 … c9fe54a |
| 1 · Protocolo y pasos | cerrada: secuencia validada + motor v2 tras `?practica=v2` | 2026-11-07 | 2026-11-07 | 28f77de … |
| 2a · Movimiento secundario | implementada · pendiente verla en dispositivo | 2026-11-08 | — | — |
| 2b · Bata 3D skinned | pendiente | — | — | — |
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

### 2026-11-07 — Cierre de la fase 0 (con excepción)

Decisión del autor: no hay más personas disponibles por ahora, así que la fase se cierra con una
sola persona. Queda registrado como excepción, no como gate completo.

**Cumplido**

- Contrato de features y captura, extractor normalizado al torso, grabador, consentimiento,
  descarga, borrado y validador de `tools/vision/`.
- 10 tomas válidas (`10 válidas · 0 con errores`), los seis pasos cubiertos y muñecas visibles en
  el 100 % de los frames.
- La captura no se puede activar en producción: `isCaptureEnabled` exige `import.meta.env.DEV`.
- Compuerta: 371 unitarias, 65 de emulador, 7 e2e de AR, 11 del validador; CI de la rama en verde.

**Excepción**

- El gate pedía 2 personas y solo hay 1. El dataset sirve para validar el pipeline y entrenar un
  primer modelo, pero **no para generalizar**.
- Mitigación obligatoria antes de la fase 4: grabar 1–2 personas más (mínimo 5 tomas cada una),
  con luz y distancia distintas, y congelar los splits **por persona**.
- No se considera el dataset final de entrenamiento.

**Fase 1 desbloqueada**: protocolo y rediseño del paso a paso. La validación del orden y de las
acciones con el director de tesis es la puerta de esa fase.

## Cómo se actualiza

Al cerrar una fase: cambiar su estado en la tabla, anotar la fecha, los commits y la evidencia de la
puerta de salida (por ejemplo, el número de tomas válidas o los FPS medidos). No se marca una fase
como cerrada sin su puerta cumplida.


### 2026-11-07 — Fase 1 iniciada: borrador de la práctica

- Esquema `ArPracticeFileSchema` en `packages/shared/src/schemas.ts`: pasos con objetivo, acción,
  qué mirar, sostén, error frecuente, corrección, debrief, voz, nota de simulación y fuente.
- Contenido borrador en `content/protocolos/ar-practica-v2.json`: **7 pasos** (mascarilla,
  preparación de manos, tomar la bata, brazos, lazos, guantes, solapa) y **4 decisiones abiertas**
  para el director.
- Pruebas: el contenido cumple el esquema, cubre los seis pasos del protocolo (`d1`–`d6`) y el
  esquema rechaza ids repetidos, órdenes fuera de secuencia y decisiones duplicadas.
- Documento para revisión: [ar-v2-practica.md](ar-v2-practica.md).

**Gate de la fase 1 pendiente**: el director de tesis debe validar la secuencia y las cuatro
decisiones. `juegoAr` no cambia hasta entonces; el motor v2 se implementará detrás de
`?practica=v2` después de la aprobación.


### 2026-11-07 — Secuencia validada por el director

El director de tesis aprobó la secuencia y las cuatro decisiones:

| Decisión | Opción aprobada |
|---|---|
| Posición de la mascarilla | Antes de la bata |
| Preparación de manos | Añadir un paso de fricción con temporizador |
| Bata | Dos pasos separados |
| Nombre del paso de manos | Secado estéril de manos |

El contenido quedó con **8 pasos** (`p1`–`p8`), `kind` por paso, `validatedBy`/`validatedAt`
(2026-11-07) y la opción elegida en cada decisión. Siguiente: motor v2 detrás de `?practica=v2`.


### 2026-11-07 — Motor v2 detrás de `?practica=v2`

- `PracticeSessionV2` en `apps/web/src/ar/practice-session-v2.ts`: despacha por `kind`, reutiliza
  las reglas geométricas del motor v1 y conserva la ventana de gracia del sostén.
- El paso de fricción exige movimiento continuo dentro de la zona estéril; el secado exige la
  posición; el cuello, las mangas, la quietud, los guantes y el giro tienen su comprobación.
- La página carga la secuencia validada solo con `?practica=v2`; sin la bandera se construye el
  `GameSession` de siempre y las pruebas actuales no cambian.
- Pruebas: 11 unitarias nuevas del motor (cada `kind`, fricción con y sin movimiento, giro,
  `handsAtNeck`, bandera) y 2 e2e (@emu) que verifican 8 pasos con la bandera y 6 sin ella.

**Fase 1 cerrada.** La puerta clínica se cumplió (validación del 2026-11-07) y el motor v2 está
aislado. Siguiente: fase 2, la bata skinned con movimiento secundario.


### 2026-11-08 — Fase 2a: movimiento secundario de la bata

- `GownSprings` en `apps/web/src/ar/gown-motion.ts`: resortes amortiguados que se atrasan en contra
  de la aceleración del torso, con aceleración suavizada y desplazamiento acotado.
- La malla ahora acepta el movimiento: el ruedo se desplaza con caída desde la cadera y las mangas
  se atrasan más cerca del puño; con movimiento neutro la malla es idéntica a la anterior.
- Bandera `?bata=vivo`; sin ella, el AR se dibuja exactamente como antes.
- Pruebas: 10 nuevas del resorte y la malla; e2e de la bandera en el espejo.
- Reducción de movimiento: con `prefers-reduced-motion` los resortes devuelven cero.

**Gate de 2a**: las pruebas pasan y el movimiento está acotado; falta verlo en un teléfono real y
decidir la amplitud. La malla 3D con glTF, colisión y materiales queda para 2b.
