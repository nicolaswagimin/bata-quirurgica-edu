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

## Activo 3D de "Ver en tu espacio" (2026-11-02)
`apps/web/public/models/paso-6-ar.glb`: la figura con la bata completa del paso 6 de colocación,
exportada por `tools/bata-3d` junto con `paso-6.glb` pero con texturas JPEG/PNG en vez de WebP, porque
Scene Viewer y Quick Look no garantizan WebP. En metros y con origen en los pies, así el AR la pone a
escala real sobre el piso; Draco con decodificador en `public/draco/`
(`ModelViewerElement.dracoDecoderLocation`). Sustituye al `bata.glb` del maniquí procedural
(2026-10-28), que se eliminó junto con su exportador.

## Modelos por paso en /bata-3d (2026-11-02)
La colocación usa `public/models/paso-1.glb` … `paso-6.glb`: figura humana de MPFB (assets CC0) posada
según `content/protocolos/bata-pasos.json`, con la bata simulada en Blender y congelada como malla
estática (`tools/bata-3d`; `source env.sh && blender --background --python build_step.py -- <n> export`).
Límites: 80 000 triángulos y 3 MB por archivo, Draco y WebP. El decodificador Draco se autoaloja en
`public/draco/` y la CSP permite `blob:` en `connect-src` para las texturas embebidas. El retiro sigue
con el maniquí procedural hasta que existan sus poses.

## Rechazado
Body tracking nativo con ARKit/ARCore: exige app nativa, dos plataformas y publicación en tiendas.

Modelo CC-BY de Sketchfab → rig en Mixamo → Blender: no apareció un modelo libre de bata quirúrgica,
y el rig no lo usa ningún consumidor (además la conversión a USDZ de Quick Look es más fiable con
modelos estáticos).

## Se revisa si
Las pruebas de `docs/pruebas-dispositivos.md` muestran < 12 fps sostenidos en ambos dispositivos.
