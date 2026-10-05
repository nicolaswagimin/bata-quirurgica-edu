# Anexo de tesis — índice de entregables

Este anexo reúne los entregables pedidos para el documento de grado. El contenido completo vive en el
blueprint del proyecto (`blueprints/bata-quirurgica-edu/blueprint.md`) y en el código fuente; aquí
solo se indica dónde está cada uno, para que exista una sola versión de cada artefacto.

| Entregable | Dónde está |
|---|---|
| (a) Arquitectura N-Tier capa por capa, diagrama y flujo de datos (AR/3D → API Gateway → Lambda → Bedrock/Firestore → Groq → respuesta en streaming; ranking por Firestore en tiempo real) | blueprint §2, subsección "Arquitectura N-Tier" |
| (b) Colecciones de Firestore con ejemplos JSON | blueprint §4, subsección "Colecciones JSON" |
| (c) Flujo de usuario paso a paso (registro y consentimiento → login → misiones → ranking → 3D → AR espejo → asistente por voz) | blueprint §6, subsección "Flujo de usuario" |
| (d) Código del asistente Groq optimizado para latencia | `services/api/src/routes/assistant.ts` (construido en el paso 14, idéntico al bloque del blueprint §5.4) |
| Decisiones de arquitectura | `docs/adr/0001` a `docs/adr/0007` |
| Pruebas en dispositivos físicos | `docs/pruebas-dispositivos.md` |
