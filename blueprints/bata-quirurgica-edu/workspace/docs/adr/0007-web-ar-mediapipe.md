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

## Rechazado
Body tracking nativo con ARKit/ARCore: exige app nativa, dos plataformas y publicación en tiendas.

## Se revisa si
Las pruebas de `docs/pruebas-dispositivos.md` muestran < 12 fps sostenidos en ambos dispositivos.
