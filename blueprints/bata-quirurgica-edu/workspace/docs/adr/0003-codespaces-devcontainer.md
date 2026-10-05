# ADR 0003 — GitHub Codespaces + devcontainer en lugar de Project IDX / Firebase Studio

- Estado: aceptada (2026-10-04)

## Contexto
https://firebase.google.com/docs/studio/migrating-project (actualizado 2026-10-01): "As of June 22,
2026, new workspace creation and new user signup for Firebase Studio are disabled." y "Firebase
Studio is sunsetting on March 22, 2027."

## Decisión
Entorno de desarrollo en GitHub Codespaces con `.devcontainer/devcontainer.json` (Node 24, Java 21
para los emuladores de Firebase, pnpm vía corepack). El mismo devcontainer funciona localmente en
VS Code.

## Razones
Codespaces expone puertos por HTTPS (`*.app.github.dev`), requisito para usar la cámara en
iPhone/Android durante las pruebas del AR espejo; Java 21 queda disponible para el emulador de
Firestore.

## Se revisa si
GitHub cambia las condiciones de Codespaces para estudiantes o el equipo pasa a otro IDE remoto.
