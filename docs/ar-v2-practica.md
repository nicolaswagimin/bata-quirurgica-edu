# AR v2 — especificación de la práctica guiada

Estado: **validada por el director de tesis el 2026-11-07**. La secuencia y las cuatro decisiones
quedaron cerradas en [`content/protocolos/ar-practica-v2.json`](../content/protocolos/ar-practica-v2.json).
Sigue siendo material educativo: no sustituye el protocolo institucional.

- Esquema: `ArPracticeFileSchema` en [`packages/shared/src/schemas.ts`](../packages/shared/src/schemas.ts)
- Plan general: [ar-v2-plan.md](ar-v2-plan.md)
- Avance: [ar-v2-progreso.md](ar-v2-progreso.md)

## 1. Por qué existe

La práctica anterior mezclaba pasos y no contaba la misma historia que el protocolo: el juego
empezaba por la mascarilla, el protocolo por las manos; `g2-manos` se llamaba “Manos sobre la
cintura” pero la regla pedía las manos por encima de la cintura; y `g3-bata` juntaba dos acciones
distintas. La v2 separa cada paso, le da objetivo, error frecuente, corrección y debrief, y deja
explícitas las decisiones clínicas.

## 2. Secuencia aprobada (8 pasos)

| # | Paso | Tipo | Protocolo | Sostén |
|---|---|---|---|---|
| 1 | Mascarilla | `mask` | — | 0,6 s |
| 2 | Fricción de manos | `friction` | — | 20 s |
| 3 | Secado estéril de manos | `band` | `d1` | 1,5 s |
| 4 | Tomar la bata por dentro | `neck` | `d2` | 1,2 s |
| 5 | Brazos en las mangas | `sleeves` | `d3` | 1,5 s |
| 6 | Lazos posteriores | `still` | `d4` | 3,5 s |
| 7 | Guantes en técnica cerrada | `gloves` | `d5` | 1,2 s |
| 8 | Cierre de la solapa | `turn` | `d6` | 1,2 s |

El `kind` es lo que el motor v2 sabe evaluar: `mask` manos a la cara, `friction` movimiento continuo
en la zona estéril con temporizador, `band` manos en la zona estéril, `neck` manos al cuello,
`sleeves` puños en las mangas y brazos al frente, `still` quietud, `gloves` manos juntas y `turn`
cuarto de vuelta y regreso.

Cada paso lleva también `goal`, `look`, `commonError`, `correction`, `debrief`, `voice`,
`simulation` (cuando el AR no puede reproducir la acción real) y `source`.

## 3. Decisiones del director (2026-11-07)

| Decisión | Opción aprobada |
|---|---|
| Posición de la mascarilla | **Antes de la bata**: la mascarilla no es estéril y se pone primero |
| Preparación de manos | **Añadir un paso de fricción con temporizador** |
| ¿Tomar la bata y meter los brazos? | **Dos pasos separados** |
| Nombre del paso de manos | **Secado estéril de manos** |

Consecuencias en el contenido: la práctica pasa de 6 a 8 pasos; el paso 2 es la fricción con
temporizador (20 s de práctica, con nota de que la duración real la define el protocolo
institucional) y el paso 3 es el secado estéril con las manos en la zona estéril.

## 4. Qué cambia frente al juego anterior

| Antes | v2 | Motivo |
|---|---|---|
| `g2-manos` “Manos sobre la cintura” | `p2-friccion` + `p3-secado` | La fricción y el secado son acciones distintas; el título anterior contradecía la regla |
| `g3-bata` (tomar + brazos) | `p4-tomar-bata` + `p5-brazos` | Dos acciones y dos errores distintos |
| La mascarilla no estaba en el protocolo | `p1-mascarilla` | El director la mantiene antes de la bata |
| Sin debrief | `debrief` por paso | El cierre dice qué corregir, no solo “terminaste” |

## 5. Cómo se consume

- El motor v2 lee este archivo y se activa con **`?practica=v2`**; sin la bandera, el AR sigue
  exactamente como hoy.
- `juegoAr` se mantiene intacto hasta que el motor v2 esté probado con esta secuencia.
- El texto de la interfaz, la voz y el debrief salen de los campos del JSON, no de cadenas
  duplicadas en el código.

## 6. Fuentes

- OMS, *WHO Guidelines for Safe Surgery* (2009), objetivo 6: prevención de la infección del sitio
  quirúrgico (mascarilla, bata, lazos, guantes, solapa).
- OMS, *Global Guidelines for the Prevention of Surgical Site Infection* (2018), preparación
  quirúrgica de las manos (fricción y secado).

Ningún paso inventa una indicación clínica: describe la secuencia y el error frecuente con la fuente
que ya respalda el protocolo.
