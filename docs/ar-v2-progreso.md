# AR v2 — progreso

Rama de trabajo: `feat/ar-v2`, creada desde `main`. `main` y producción no se tocan; nada de esta
rama se despliega. Plan completo: [ar-v2-plan.md](ar-v2-plan.md).

## Tabla de fases

| Fase | Estado | Inicio | Cierre | Commits |
|---|---|---|---|---|
| 0 · Spec + captura | cerrada con excepción de diversidad | 2026-11-07 | 2026-11-07 | 4f8cbc7 … c9fe54a |
| 1 · Protocolo y pasos | cerrada: secuencia validada + motor v2 tras `?practica=v2` | 2026-11-07 | 2026-11-07 | 28f77de … |
| 2a · Movimiento secundario | implementada · pendiente verla en dispositivo | 2026-11-08 | — | — |
| 2b · Bata 3D skinned | en curso: activo, esqueleto y renderer; glTF y colisión pendientes | 2026-11-08 | — | — |
| 1b · Secuencia v3 (video de referencia) | implementada · pendiente de validación del director y de tu aprobación | 2026-11-08 | — | — |
| 2c · Ayudas visuales (`?practica=v2`) | implementada · pendiente de tu aprobación | 2026-11-08 | — | — |
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


### 2026-11-08 — Fase 2b, primera rebanada: bata 3D con esqueleto

- `gown-3d-mesh.ts`: geometría canónica de la bata (cuerpo de 6 anillos × 12 segmentos y dos
  mangas), 11 huesos (raíz, columna, hombros, codos, muñecas y tres de ruedo), pesos de piel
  normalizados y `boneTargets` que proyectan el cuerpo real a ese espacio.
- `gown-3d.ts`: `SkinnedMesh` en three.js con `MeshStandardMaterial`, luz de estudio y cámara
  ortográfica en píxeles; el grupo aplica posición, giro y ancho de hombros del jugador. Los
  resortes de 2a mueven los huesos del ruedo y las muñecas. Si no hay WebGL, `ok=false` y la bata
  2.5D sigue dibujándose.
- `?bata=3d`: canvas WebGL debajo del canvas 2D; el 2D deja de pintar la bata puesta pero conserva
  máscara, guantes, lazos, avisos y cursor.
- Pruebas: 5 nuevas del activo/esqueleto y e2e de la bandera. 406 unitarias en total.
- La tela usa el mismo tile SMS del 2D como `CanvasTexture`, con luz de estudio y tono ACES; el
  ruedo se ensancha y la cintura se entalla. Para revisarla sin recorrer la práctica: 
  `?bata=3d&simularPose=1&simularBataPuesta=1` (QA).
- Pendiente: sustituir la malla procedural por el glTF, colisión con cápsulas, cuello/puños/cintas
  en 3D, iluminación de las mangas y medir los 30 fps en un teléfono real. La primera captura de
  QA muestra la malla con textura, pero todavía no es el acabado final.


### 2026-11-08 — Fase 1b: secuencia v3 según el video de referencia

Nuevo encargo: rehacer los pasos siguiendo la guía de movimiento del video de un fabricante (bata
genérica, sin marcas). La guía vive en `tools/bata-3d/referencia/guia-video.md`, **ignorada por
git** (material derivado del video), y está **NO verificada contra el video**: todavía no hay
capturas. La técnica cerrada de guantes no sale en el video y se agregó desde el protocolo.

- `content/protocolos/ar-practica-v3.json` (`status: pendiente-validacion`): secado de manos,
  tomar la bata por la cara interna, despliegue sin sacudir, brazos en las mangas (manos en los
  puños), amarre del circulante (solo sus manos), guantes en técnica cerrada, y tarjeta de
  transferencia y giro. Cada paso trae instrucción, qué mirar, error frecuente y corrección.
- La v2 validada el 2026-11-07 se conserva intacta en `ar-practica-v2.json` como historial.
- Puntos abiertos configurables (`config` del contenido, y por URL para QA):
  `?giro=cuarto|360`, `?mascarilla=1|0`, `?secado=1|0`. Por defecto: cuarto de vuelta, sin
  mascarilla y con secado → 7 pasos. Cierre del cuello (Velcro o lazo) y secuencia de guantes
  quedan como decisiones de texto en `decisions`.
- Motor: nuevo `kind` `unfold` (manos separadas a la altura de los hombros y quietas; sacudir no
  cuenta) y detector de giro `practice-turn.ts`, que cuenta perfiles: un cuarto de vuelta = 1 perfil
  y 360° = 2 perfiles (la espalda se ve tan ancha como el frente).
- `?practica=v2` carga la v3 resuelta y muestra la ficha «Secuencia en revisión». Sin la bandera el
  juego v1 no cambia.
- Esquema: `status`, `reference`, `config`, `turnText` y `toggle` por paso; una secuencia pendiente
  no puede llevar `validatedBy` y una validada lo exige.

Pendiente detectado para la fase 2: `ar-results.tsx` siempre envía los 6 pasos `d1`–`d6` al
backend. «Saltar paso» (sin puntos) va a necesitar que el API acepte prácticas incompletas.

Redacción del contenido v3: los textos de los pasos los escribió Codex (`codex:codex-rescue`)
desde la guía y los validó contra `ArPracticeFileSchema`. Claude los revisó y ajustó tres puntos
para que coincidan con lo que mide el motor: la mascarilla pide acercar las manos sin tocar (el
motor detecta las manos cerca de la cara), «qué mirar» de tomar la bata indica las manos juntas al
centro, y se corrigió la redacción del cuarto de vuelta. La revisión de Codex del motor encontró 4
problemas (perfil con un solo frame, dos cuartos que pasaban por 360°, final sin volver de frente y
despliegue con manos apiladas o a los lados); los cuatro se corrigieron con pruebas negativas.


### 2026-11-08 — Fase 2c: ayudas visuales para la postura

Fase 1b aprobada por el autor con capturas. Todo sigue solo con `?practica=v2`.

- **Silueta fantasma**: la pose objetivo del paso, translúcida, con hombros y caderas del propio
  jugador (`pose-targets.ts`, `assist-overlay.ts`). Si el dispositivo va lento no se dibuja.
- **Articulaciones en color**: verde (≤ 0,2 anchos de hombro del objetivo), ámbar (≤ 0,5) y rojo,
  con flecha hacia el objetivo. Solo muñecas; los codos solo en mangas y despliegue, donde el motor
  sí los mira.
- **Anillo de sostén** sobre la cabeza mientras se mantiene la postura.
- **Ayuda progresiva** (`assist-timeline.ts`, `practice-assist.ts`, `ar-assist.tsx`): a los 8 s una
  pista en texto y voz con la articulación a corregir (se dice una vez por paso); a los 15 s una
  miniatura que reproduce en bucle el capítulo del paso en el modelo 3D de `/bata-3d` (carga
  perezosa: three.js solo baja si hace falta; con movimiento reducido, cuadro fijo); a los 25 s
  «Saltar paso», activable sosteniendo la mano 1 s. El reloj se detiene si no hay cuerpo.
- **Saltar paso**: el paso queda como no completado (`skippedIds`), la escena avanza para que el
  siguiente paso tenga sentido y la práctica **no se envía al backend**: «esta práctica no suma
  XP». No hubo que cambiar el API.
- **Guía de encuadre**: mensajes concretos (`framing-advice.ts`): sin cuerpo, pies, cabeza, muy
  cerca, muy lejos y descentrado, con el espejo resuelto desde la perspectiva del usuario.
- Módulos aislados escritos por Codex (`codex:codex-rescue`): `pose-targets.ts`,
  `assist-overlay.ts`, `assist-timeline.ts` y `framing-advice.ts`, con sus pruebas. Claude escribió
  la integración (hook, página, motor, resultados, miniatura) y filtró los codos.

Revisión de Codex de la fase 2c: 5 hallazgos válidos, todos corregidos con prueba. El aviso de voz
ya no se pierde si a los 8 s el jugador estaba sosteniendo; «Saltar paso» lleva el id del paso
mostrado y no salta el siguiente si el actual terminó en el mismo frame; en v2 la cuenta atrás espera
a que el consejo de encuadre esté bien; el e2e recorre la práctica saltando pasos (con la bandera de
QA `simularAyudaRapida`, solo en la build e2e) y verifica que **no** se hace `POST /quiz/practice`;
y se corrigió una prueba unitaria vacía. Verificado aparte: la miniatura 3D está en un chunk propio
(`procedure-viewer`, 89 kB gzip) que solo se descarga a los 15 s.
