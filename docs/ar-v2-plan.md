# AR v2 — plan de reconocimiento, bata realista y práctica guiada

Estado: **fase 2a en curso**: movimiento secundario del ruedo y las mangas tras `?bata=vivo`; la malla 3D (2b) sigue pendiente. Fases 0 y 1 cerradas. Rama `feat/ar-v2`, creada desde `main`; `main` y producción no se
tocan y nada de esta rama se despliega. Avance por fase: [ar-v2-progreso.md](ar-v2-progreso.md).

Este documento fija el diagnóstico, las correcciones al orden propuesto, la arquitectura, las fases
con su puerta de salida, la estructura en el monorepo y los riesgos. Es la referencia para no
reabrir decisiones en cada sesión.

---

## 1. Diagnóstico

El AR actual mezcla tres capas en un mismo bucle y eso explica por qué "no se siente real":

| Capa | Qué hay hoy | Por qué se siente mal |
|---|---|---|
| **Reconocimiento** | `MediaPipe Pose Landmarker Lite` (33 puntos, 1 persona, GPU/CPU) en `ar/pose.ts` | Solo hay cuerpo grueso: sin manos ni objetos. Las reglas son geométricas con umbrales fijos y no entienden secuencia ni intención |
| **Bata** | Malla 2.5D de quads dibujada en canvas desde hombros/caderas (`ar/gown-mesh.ts`) | Sin profundidad, sin inercia y sin colisión: la bata se ve pegada al cuerpo y estática |
| **Pasos** | 6 pasos de juego (`content/protocolos/bata-pasos.json#juegoAr`) contra 6 pasos del protocolo (`#donning`), mapeados a mano | El juego añade la mascarilla, no sigue el mismo orden y las acciones no coinciden con el protocolo. "Cubre d1" puede ser solo "manos al pecho" |

Consecuencia: **entrenar un modelo de pose desde cero no arregla las capas 2 y 3**, y muy
probablemente empeore la 1. La percepción no es el cuello de botella; lo son los datos disponibles,
el render y la especificación del protocolo.

## 2. Correcciones a la propuesta inicial

### 2.1 El modelo no debe ser de pose, sino de *práctica*

Reemplazar MediaPipe Pose por un modelo propio de píxeles exige decenas de miles de frames
etiquetados, GPU y MLOps, y en un móvil de gama media correría más lento que el modelo lite actual.
No es la inversión correcta.

Lo que sí se entrena es un **clasificador temporal de la práctica** encima de los landmarks:

- **Entrada**: ventana de ~1,5 s de landmarks de cuerpo (y manos cuando se activen),
  normalizados al torso, con velocidades y ángulos.
- **Salida**: `{ stepId, confidence, corrections }` — "estás en el paso 4 y te moviste", no
  "dónde está tu codo".
- **Modelo**: MLP o GRU pequeño, < 1 MB, en el navegador (TF.js u ONNX Runtime Web).
- **Datos**: 10–20 personas × 3–5 tomas × 6 pasos, grabando **landmarks, nunca video**.
- **Descarte honesto**: si en personas no vistas no supera con claridad a las reglas
  (F1 ≥ 0,85 por paso), las reglas se quedan y el aporte de tesis es el dataset + la evaluación.

Antes del modelo aprendido se añade **MediaPipe Hands** (ya está `tasks-vision`): los guantes y la
técnica cerrada necesitan dedos, no solo la muñeca.

### 2.2 El orden correcto es datos → visual → modelo

| Orden propuesto | Orden recomendado | Por qué |
|---|---|---|
| Modelo → bata → pasos | Datos → protocolo/pasos → bata → modelo → físicas | Sin datos no hay modelo; el protocolo y la bata dan más valor percibido por semana; las físicas son lo más caro y lo que menos aporta a "práctica real" |

### 2.3 El repositorio

**No se crea otro repo.** Todo vive en este monorepo:

```
tools/vision/                 Pipeline de datos y modelo (Python)
  data/                       Capturas JSON (gitignored; nunca video)
  validate.py                 Validador del formato de captura
apps/web/public/models/       Artefacto exportado (.onnx / .task), versionado
apps/web/src/ar/perception/   Contrato de features y runtime del modelo
```

Razones: el modelo y el contrato de features cambian juntos; el CI puede comprobar que el
artefacto carga; app y modelo se despliegan en el mismo commit. Un repo aparte solo tendría sentido
si el reconocimiento se convirtiera en API para terceros, y eso choca con la regla de que **los
fotogramas nunca salen del navegador**. Para investigación se usa una rama o un spike, no un repo.

## 3. Arquitectura por capas

1. **Percepción** (`apps/web/src/ar/perception/`): MediaPipe Pose (+ Hands) → landmarks →
   features normalizados al torso, velocidades y ángulos. Contrato versionado en
   `packages/shared/src/perception.ts` para que app, captura y validador hablen el mismo idioma.
2. **Protocolo / estado**: máquina de estados dirigida por una especificación (`content/`), con
   precondiciones, tiempos de sostén, correcciones y debrief. El modelo o las reglas producen
   señales; la máquina decide.
3. **Render**: bata skinned (glTF) con movimiento secundario por huesos de resorte, colisión con
   cápsulas y materiales; física XPBD opcional como modo de alta calidad.

La regla de oro: **cada capa se puede probar sola**. La percepción es pura (node), el protocolo es
puro y el render se valida con capturas y FPS.

## 4. Fases y puertas de salida

| Fase | Semanas | Entregable | Puerta de salida |
|---|---|---|---|
| **0 · Spec + captura** | 1–2 | Contrato de features, modo captura con consentimiento, validador en `tools/vision/` | JSON válido de 2 personas y 10 tomas; captura desactivada en producción |
| **1 · Protocolo y pasos** | 1–2 | Protocolo validado, pasos rediseñados, debrief | El director de tesis aprueba la secuencia y las acciones |
| **2a · Movimiento secundario** | 1 | Resortes amortiguados en ruedo y mangas, `?bata=vivo` | Sin tirones, reduced motion respetado, pruebas del resorte y de la malla |
| **2b · Bata 3D skinned** | 2–3 | glTF + huesos de resorte + colisión + materiales, `?bata=3d` | 30 fps en gama media, sin interpenetración visible |
| **3 · Dataset** | 2 (paralelo) | 50–100 tomas etiquetadas y splits por persona | Splits congelados; ninguna persona en train y test |
| **4 · Modelo** | 3–4 | Clasificador exportado + evaluación | F1 ≥ 0,85 por paso en personas no vistas y latencia < 50 ms |
| **5 · Física (opcional)** | 1–2 | Modo tela XPBD | 30 fps sostenidos o se queda apagado |

Total realista: 8–12 semanas en secuencia; 6–8 si el dataset corre en paralelo con la bata.

> **Nota de cierre de la fase 0.** Se cerró con 10 tomas válidas de una sola persona porque no había
> más disponibles. El pipeline está validado, pero antes de la fase 4 hay que grabar 1–2 personas
> más y congelar los splits por persona; hasta entonces no es un dataset de entrenamiento final.

Cada fase se desarrolla detrás de bandera y no cambia el comportamiento por defecto:

| Bandera | Qué activa | Dónde |
|---|---|---|
| `?captura=1` | Modo captura de landmarks, solo en desarrollo | `bata-ar` |
| `?percepcion=modelo` | Clasificador aprendido en lugar de las reglas | `bata-ar` |
| `?bata=vivo` | Movimiento secundario del ruedo y las mangas (2a) | `bata-ar` |
| `?bata=3d` | Bata 3D skinned con colisión (2b) | `bata-ar` |

Sin bandera, el AR se comporta exactamente como hoy y las pruebas actuales deben seguir pasando.

## 5. Estructura en el monorepo

```
packages/shared/src/perception.ts      Contrato de features y esquema de captura (zod)
apps/web/src/ar/perception/
  features.ts                          Landmarks → features normalizados al torso
  capture.ts                           Grabador de ventanas + bandera de desarrollo
  capture-panel.tsx                    Consentimiento, grabación, descarga y borrado
tools/vision/
  README.md                            Cómo grabar, validar y qué se entrena después
  validate.py                          Validador del JSON de captura (stdlib)
  test_validate.py                     Pruebas del validador
  data/                                Capturas locales (gitignored)
```

## 6. Formato de captura

Un archivo por toma, `ar-captura-<paso>-<marca>.json`:

```json
{
  "version": 1,
  "label": "g3-bata",
  "source": "ar-espejo",
  "capturedAt": "2026-11-07T20:00:00.000Z",
  "durationMs": 2000,
  "sampleHz": 15,
  "frames": [
    {
      "t": 0,
      "points": [{ "x": 0.0, "y": 0.0, "z": 0.0, "visibility": 0.98 }],
      "velocities": [{ "x": 0.0, "y": 0.0 }],
      "angles": { "leftElbow": 3.14, "rightElbow": 3.14, "leftShoulder": 1.57, "rightShoulder": 1.57, "torsoTilt": 0.0 },
      "torso": { "centerX": 500, "centerY": 400, "shoulderWidth": 200, "torsoHeight": 180, "angleRad": 0.0 },
      "hands": []
    }
  ]
}
```

- `points` va en el orden de `BODY_POINTS` (13 puntos) y en **unidades de ancho de hombros**, con
  origen en el punto medio de los hombros, `x` a lo largo de la línea de hombros y `y` hacia las
  caderas.
- `velocities` va en anchos de hombros por segundo y usa el mismo orden.
- `angles` va en radianes; `-1` significa "no disponible" (landmark ocluido).
- `hands` queda vacío hasta activar MediaPipe Hands; el esquema ya reserva 21 puntos por mano.
- `torso` conserva píxeles para diagnóstico y reconstrucción.

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Sesgo de datos (luz, tono de piel, talla, ropa) | El modelo falla en quien más lo usa | Evaluar por subgrupos; grabar diversidad desde la fase 3 |
| Brecha sintético → real | Métricas infladas en entrenamiento | Entrenar con real; sintético solo como refuerzo |
| Consentimiento y Ley 1581 | Datos biométricos | Consentimiento explícito, solo landmarks, borrado local, sin subidas |
| Rendimiento en gama media | El AR se vuelve injugable | Presupuesto de 30 fps por fase; medir en dispositivo real |
| Validez clínica del orden de pasos | Enseñar una secuencia incorrecta | El protocolo lo valida el director de tesis antes de la fase 1 |
| Deriva de alcance (físicas) | Se come el tiempo del modelo | Física es fase opcional con bandera y presupuesto medido |

## 8. Decisiones abiertas

1. Semanas disponibles para la entrega (decide si la fase 5 entra).
2. Acceso a 10–20 voluntarios y a un Android de gama media.
3. GPU para entrenar (Colab gratuito o Pro sirven para un MLP/GRU pequeño).
4. Si el aporte de tesis es el modelo o la plataforma completa.

## 9. Primer paso operativo

Fase 0, implementación completa y pendiente del gate de capturas:

1. Contrato de features en `packages/shared/src/perception.ts`.
2. Extractor puro en `apps/web/src/ar/perception/features.ts`.
3. Grabador y bandera de desarrollo en `apps/web/src/ar/perception/capture.ts`.
4. Panel de consentimiento y captura en `apps/web/src/ar/perception/capture-panel.tsx`.
5. Validador en `tools/vision/validate.py`.

Al terminar: grabar 10 tomas de 2 personas, validarlas y congelar el formato antes de la fase 1.
