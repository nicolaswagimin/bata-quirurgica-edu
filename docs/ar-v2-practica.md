# AR v2 — especificación de la práctica guiada (borrador)

Estado: **borrador para validación del director de tesis**. No es guía clínica ni fuente de la
aplicación hasta que se apruebe. La secuencia actual del juego (`juegoAr`) no cambia.

- Contenido: [`content/protocolos/ar-practica-v2.json`](../content/protocolos/ar-practica-v2.json)
- Esquema: `ArPracticeFileSchema` en [`packages/shared/src/schemas.ts`](../packages/shared/src/schemas.ts)
- Plan general: [ar-v2-plan.md](ar-v2-plan.md)

## 1. Por qué existe

La práctica actual mezcla pasos y no cuenta la misma historia que el protocolo: el juego empieza por
la mascarilla, el protocolo empieza por las manos; `g2-manos` se llama “Manos sobre la cintura” pero
la regla pide las manos por encima de la cintura; y `g3-bata` junta dos acciones distintas (tomar la
bata y meter los brazos). Este borrador separa cada paso, le da un objetivo, un error frecuente y
una corrección, y deja explícitas las decisiones clínicas que no puede tomar el código.

## 2. Secuencia propuesta (7 pasos)

| # | Paso | Practica | Sostén | Acción |
|---|---|---|---|---|
| 1 | `p1-mascarilla` | — (no está en el protocolo actual) | 0,6 s | Llevar las manos a la cara y ajustar la mascarilla |
| 2 | `p2-manos` | `d1` | 1,5 s | Manos al frente del pecho, por encima de la cintura |
| 3 | `p3-tomar-bata` | `d2` | 1,2 s | Tomar la bata por dentro, a la altura del cuello |
| 4 | `p4-brazos` | `d3` | 1,5 s | Meter un brazo y luego el otro sin sacar las manos |
| 5 | `p5-lazos` | `d4` | 3,5 s | Quieto con las manos al frente mientras el circulante amarra |
| 6 | `p6-guantes` | `d5` | 1,2 s | Manos juntas dentro de los puños (técnica cerrada) |
| 7 | `p7-solapa` | `d6` | 1,2 s | Cuarto de vuelta y regreso al frente |

Cada paso del JSON lleva además: `goal` (para qué sirve), `look` (dónde mirar), `commonError`,
`correction`, `debrief` (frase de cierre) y `voice` (lo que dice la voz). Los pasos que el AR no
puede reproducir físicamente llevan `simulation` (por ejemplo, la fricción real de manos).

## 3. Qué cambia frente al juego actual

| Actual | v2 | Motivo |
|---|---|---|
| `g2-manos` “Manos sobre la cintura” | `p2-manos` “Preparación de manos” | El título contradecía la regla (manos por encima de la cintura) |
| `g3-bata` (tomar + brazos) | `p3-tomar-bata` + `p4-brazos` | Son dos acciones y dos errores distintos |
| La mascarilla no está en el protocolo | `p1-mascarilla` con la decisión abierta | Hay que definir si va antes o después de la bata |
| Sin debrief | `debrief` por paso | El cierre explica qué corregir, no solo “terminaste” |

## 4. Decisiones que debe tomar el director

Están en el JSON (`decisions`) y repetidas aquí para revisarlas juntas:

1. **Posición de la mascarilla.** Propuesta: antes de la bata, como hoy. Alternativas: después de la
   bata y antes de los guantes (secuencia de las guías OMS) o fuera de la práctica AR.
2. **Preparación de manos.** Propuesta: solo se practica la posición en la zona estéril; la fricción
   y el secado reales se hacen fuera del AR. Alternativas: añadir un paso con temporizador o solo
   mencionarlo en la lección.
3. **¿Tomar la bata y meter los brazos son dos pasos?** Propuesta: sí, separados. Alternativa: un
   solo paso combinado, como hoy.
4. **Nombre del paso de manos.** Propuesta: “Preparación de manos”. Alternativas: “Secado estéril de
   manos” o “Manos frente al pecho”.

## 5. Cómo se valida

1. El director revisa la secuencia y cada decisión.
2. Se corrige el JSON con su respuesta.
3. `reviewNote` pasa a decir quién validó y cuándo; `decisions` queda vacío.
4. Se actualiza este documento con la secuencia aprobada.

La validación es una puerta humana: ninguna fase posterior cambia la secuencia sin ella.

## 6. Qué pasa después de la aprobación

- El motor v2 se implementa **detrás de `?practica=v2`**: sin la bandera, el AR sigue exactamente
  como hoy y las pruebas actuales no cambian.
- `juegoAr` se mantiene como está hasta que el motor v2 esté probado con la secuencia aprobada.
- Recién entonces se alinean los textos de la app (`g2`), la voz y el debrief final.

## 7. Fuentes

Las citas de cada paso son las mismas que usa el protocolo actual:

- OMS, *WHO Guidelines for Safe Surgery* (2009), objetivo 6: prevención de la infección del sitio
  quirúrgico (bata, mascarilla, lazos, guantes, solapa).
- OMS, *Global Guidelines for the Prevention of Surgical Site Infection* (2018), preparación
  quirúrgica de las manos.

Ningún paso inventa una indicación clínica: describe la secuencia y el error frecuente con la fuente
que ya respalda el protocolo.
