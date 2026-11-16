# Portada (landing) — registro de tareas

Rama `feat/landing`. Claude diseña, especifica, revisa e integra; Codex implementa.
Contrato de dirección: `apps/web/.impeccable/surfaces/src-routes-landing-tsx.md`.

Decisiones del usuario (2026-11-16): ilustraciones de "Cómo funciona" en pixel art propio (sin
capturas); `/login` redirige a `/ingresar` conservando `?redirect=`; flujo Codex implementa.

| Tarea | Spec resumida | Resultado | Correcciones |
|---|---|---|---|
| L1 rutas | `/` decide portada o inicio según sesión; `/ingresar` reemplaza `/login` (redirección); enlaces, pruebas y regla web actualizados | Codex: router con `IndexGate` (carga diferida de home/landing), `/login` → `/ingresar` con `redirect`, cierre de sesión a `/`; compuerta + 10/10 smoke | ninguna |
| L2 portada | Dra. Menta animada, diálogo letra a letra accesible, 6 secciones, sprites propios, e2e | pendiente | — |
