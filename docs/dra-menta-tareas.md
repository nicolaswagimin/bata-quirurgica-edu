# Dra. Menta compañera y asistente — registro de tareas

Rama `feat/dra-menta` (desde `main`). Claude planifica, especifica, revisa y corre la compuerta;
Codex implementa. Sin merge ni despliegue.

| Tarea | Spec resumida | Resultado | Correcciones |
|---|---|---|---|
| P1-A lógica | Mensajes puros: racha (Bogotá), "¿Sabías que…?" solo de `keyPoints` con fuente, motivación, planificador (saludo, 5 min, silencio) | Codex: `menta-messages.ts` (23 datos con fuente), `menta-events.ts`, 15 pruebas | ninguna |
| P1-B compañera | Menta flotante abajo a la derecha, globo con cerrar/silenciar, región viva, eventos de misión y nivel, interruptor en Perfil, e2e @emu | Codex: `menta-companion.tsx`, `menta-bubble.tsx`, interruptor en Perfil, evento en misión, 5 e2e @emu | Claude: import JSON en e2e. Revisión Codex: cola con globo abierto, estado por UID, foco al cerrar, JSON corrupto (corregido por Codex) |
| P1-C compacto | Datos ≤ 140 caracteres (punto clave o su primera frase textual), fuente corta, íconos, 8 s | Codex | Claude: ancho del globo y firma en una línea |
| P2-A hook | `use-assistant-chat.ts` con `speaking` (stream o voz) | Codex | — |
| P2-B asistente | Menta abre el chat (sin "Pregúntale"), panel con Menta grande, animación de crecer/encoger | Codex (cupo agotado a mitad; retomado) | Codex: cierre del dialog con Espacio. Claude: aserción e2e. Revisión Codex: envío durante transcripción, grabación tras cerrar, franja vacía (corregido por Codex) |
| P3-A lámina | 11 parejas incorrecto/correcto a doble resolución, zona resaltada, lámina HTML para aprobar | Codex | Usuario aprobó con 3 mejoras |
| P3-B integración | Figuras más grandes, indicador y puños más claros, `MistakePair` en Aprende, e2e | Codex | Revisión Codex: sin hallazgos materiales |
