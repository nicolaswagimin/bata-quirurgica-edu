---
description: Convenciones del frontend (Vite + React + TanStack Router)
paths:
  - "apps/web/**"
---

- Rutas: todas declaradas en `apps/web/src/router.tsx` desde el paso 2. Las páginas públicas
  `/login`, `/registro` y `/privacidad` son exports con nombre de `src/routes/public-pages.tsx`.
  Las demás páginas son `src/routes/<nombre>.tsx` con `export default function`, cargadas con
  `import.meta.glob('./routes/*.tsx')`; si el archivo aún no existe el router muestra "Próximamente".
  Agregar una de esas páginas NO requiere editar el router.
- Mapa ruta → archivo: `/` home · `/mision/$missionId` mision · `/ranking` ranking · `/perfil` perfil ·
  `/bata-3d` bata-3d · `/bata-ar` bata-ar · `/bata-espacio` bata-espacio · `/creditos` creditos
  (pública) · `/admin/preguntas` admin-preguntas · `/admin/grupos` admin-grupos.
- El panel del asistente se monta igual: `import.meta.glob('./assistant/assistant-panel.tsx')`.
- Colores solo con utilidades generadas por los tokens de `src/styles.css` (`bg-primary`,
  `text-ink`, `border-border`, `bg-xp`…). Ningún hex en componentes.
- Formularios: react-hook-form + `schema.safeParse()` de `@bata/shared/schemas` en `handleSubmit`,
  errores con `setError` por campo, `aria-invalid` y `aria-describedby`. No usar `@hookform/resolvers`.
- Datos del servidor: TanStack Query. Lecturas de Firestore directas (reglas de solo lectura);
  escrituras SIEMPRE por `src/lib/api.ts` (nunca `setDoc`/`addDoc` desde el cliente).
- Mensajes de error HTTP: `messageForStatus()` de `@bata/shared/schemas`.
- Accesibilidad: un `h1` por página, `<label>` real en cada input, objetivos ≥ 24×24 px, foco visible,
  `aria-live="polite"` en el texto del asistente, respetar `prefers-reduced-motion`.
- Pruebas: lógica pura en `test/unit/*.test.ts` (entorno node, sin DOM). Comportamiento de UI con
  Playwright en `e2e/*.spec.ts`; las que necesitan emuladores llevan `@emu` en el título y usan
  `e2e/helpers.ts`.
