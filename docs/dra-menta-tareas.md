# Dra. Menta compañera y asistente — registro de tareas

Rama `feat/dra-menta` (desde `main`). Claude planifica, especifica, revisa y corre la compuerta;
Codex implementa. Sin merge ni despliegue.

| Tarea | Spec resumida | Resultado | Correcciones |
|---|---|---|---|
| P1-A lógica | Mensajes puros: racha (Bogotá), "¿Sabías que…?" solo de `keyPoints` con fuente, motivación, planificador (saludo, 5 min, silencio) | Codex: `menta-messages.ts` (23 datos con fuente), `menta-events.ts`, 15 pruebas | ninguna |
| P1-B compañera | Menta flotante abajo a la derecha, globo con cerrar/silenciar, región viva, eventos de misión y nivel, interruptor en Perfil, e2e @emu | Codex: `menta-companion.tsx`, `menta-bubble.tsx`, interruptor en Perfil, evento en misión, 5 e2e @emu | Claude: import JSON en e2e. Revisión Codex: cola con globo abierto, estado por UID, foco al cerrar, JSON corrupto (corregido por Codex) |
