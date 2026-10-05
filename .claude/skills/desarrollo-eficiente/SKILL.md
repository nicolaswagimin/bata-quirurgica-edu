---
name: desarrollo-eficiente
description: Flujo de trabajo para implementar, corregir o probar código en el proyecto bata-quirurgica-edu gastando la menor cantidad de tokens posible. Úsala siempre que vayas a implementar una tarea de tasks.json, corregir un error, ejecutar pruebas o modificar código en este repositorio, y cuando el usuario diga "siguiente tarea", "continúa", "implementa" o "arregla", aunque no mencione la skill.
---

# Desarrollo eficiente

Objetivo: terminar cada tarea con el mínimo de lectura, salida de comandos y texto generado, sin saltarse las verificaciones.

## 1. Una tarea por sesión

- Implementa una sola tarea de `blueprints/bata-quirurgica-edu/tasks.json` y detente.
- No adelantes trabajo de tareas futuras ni refactorices código que la tarea no toca.

## 2. Leer lo mínimo

- `CLAUDE.md` ya está cargado: no lo vuelvas a leer.
- No leas `tasks.json` completo. Extrae solo la tarea pendiente con `jq`. Si no conoces la estructura, mira primero `jq 'keys' tasks.json` o `head -n 40`.
- No leas `blueprint.md` completo. Busca la sección que cita la tarea con `grep -n` y lee solo ese rango de líneas.
- Antes de abrir un archivo, búscalo: `rg -n "patrón"` o `rg -l "patrón"`. Si pasa de 200 líneas, lee solo el rango que necesitas.
- Nunca leas `node_modules/`, `dist/`, `build/`, `.turbo/`, `coverage/` ni `pnpm-lock.yaml`.

## 3. Editar en vez de reescribir

- Usa ediciones puntuales. Reescribe un archivo completo solo si es nuevo o si cambia más de la mitad.
- No muestres en el chat el código que acabas de escribir; ya está en el archivo.

## 4. Comandos con salida corta

- Limita la salida: `comando 2>&1 | tail -n 40`. Si falla, busca el error con `grep -n -i "error" | head -n 20` antes de pedir más salida.
- Prueba solo el paquete afectado: `pnpm --filter <paquete> test` en lugar de todo el monorepo. La verificación completa va solo al cierre de la tarea.
- Usa modos silenciosos cuando existan (`--silent`, `--reporter=dot`).
- Instala dependencias una sola vez por tarea, no después de cada cambio.

## 5. Web solo si hace falta

- Para versiones de paquetes usa `npm view <paquete> version` o `npm view <paquete> time --json | tail -n 5`, no páginas web.
- Si necesitas documentación, ve a la página específica (no a la portada) y extrae solo lo necesario.
- No uses subagentes salvo que el usuario lo pida.

## 6. Límite a los intentos

- Si el mismo error persiste tras 3 intentos de corrección, detente y reporta: el error, qué probaste y tu hipótesis. No sigas probando a ciegas.

## 7. Cierre de la tarea

1. Ejecuta los comandos de verificación de la tarea, con salida limitada.
2. Si pasan, marca la tarea como completada en `tasks.json`.
3. Haz commit: `git add -A && git commit -m "<ID-tarea>: <resumen corto>"`.
4. Responde en máximo 6 líneas: tarea, archivos cambiados, resultado de las verificaciones, pendientes y siguiente tarea.
5. Recuerda al usuario escribir `/clear` antes de la siguiente tarea.