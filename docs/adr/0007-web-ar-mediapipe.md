# ADR 0007 — Web en lugar de app móvil; AR espejo con MediaPipe (2.5D) + model-viewer

- Estado: aceptada (2026-10-04)

## Decisión
- Producto web (SPA) para llegar a cualquier dispositivo sin tiendas de aplicaciones.
- AR espejo: cámara frontal + `PoseLandmarker` de MediaPipe (modelo lite, modo VIDEO, delegado GPU
  con respaldo CPU), runtime WASM y modelo autoalojados en `/mediapipe/`. Superposición 2.5D de la
  bata anclada a hombros (11, 12) y caderas (23, 24). Los fotogramas nunca salen del navegador.
- "Ver en tu espacio": `@google/model-viewer` con `ar-modes="webxr scene-viewer quick-look"`.
  En iOS se usa Quick Look (USDZ autogenerado); WebXR no está disponible en Safari iOS —
  https://caniuse.com/webxr
- Si el FPS cae por debajo de 12 durante 5 s se sugiere el modo 3D.

## Activo 3D (2026-10-28)
`apps/web/public/models/bata.glb` es un modelo propio generado por código: el maniquí procedural de
`src/three/mannequin-parts.ts` con una bata estilizada (`src/three/bata-model.ts`: manga larga con
puños de punto, largo a media pierna, sin cuello ni bolsillos, cierre cruzado atrás con amarres en
cintura y cuello, colores de los tokens de `styles.css`). `pnpm --filter @bata/web run model:export`
lo regenera con `GLTFExporter`; es determinista y `test/unit/bata-model.test.ts` falla si el archivo
versionado difiere de la salida del script. Estático (sin rig, animaciones ni texturas), en metros,
origen en los pies, < 2 MB (≈ 0,3 MB, ≈ 11 000 triángulos). Ningún consumidor necesita esqueleto:
model-viewer lo muestra tal cual y el AR espejo dibuja su propia silueta 2D.

## Rechazado
Body tracking nativo con ARKit/ARCore: exige app nativa, dos plataformas y publicación en tiendas.

Modelo CC-BY de Sketchfab → rig en Mixamo → Blender: no apareció un modelo libre de bata quirúrgica,
y el rig no lo usa ningún consumidor (además la conversión a USDZ de Quick Look es más fiable con
modelos estáticos).

## Se revisa si
Las pruebas de `docs/pruebas-dispositivos.md` muestran < 12 fps sostenidos en ambos dispositivos.
