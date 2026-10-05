# Pruebas en dispositivos físicos — AR espejo (spike paso 3)

Puerta de aprobación humana. La completa el estudiante, no el agente constructor. No bloquea
ningún paso automatizado; su decisión se revisa en la lista de lanzamiento (blueprint §20.1).

Cómo probar: abrir el Codespace, `pnpm --filter @bata/web dev`, pestaña PORTS → puerto 5173 →
visibilidad *Public* temporalmente, abrir la URL `https://…app.github.dev/bata-ar` en el teléfono,
iniciar sesión y conceder la cámara. Anotar el FPS que muestra el indicador tras 30 s.

| Dispositivo | Navegador y versión | Modelo / SO | FPS sostenido | Delegado (GPU/CPU) | ¿Detecta pose? | Observaciones |
|---|---|---|---|---|---|---|
| iPhone | Safari | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Android | Chrome | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

Decisión: PENDIENTE

Valores válidos para la decisión: `continuar` (AR espejo se mantiene como modo principal en ambos
dispositivos) o `fallback` (en el dispositivo con < 12 fps se recomienda el modo 3D por defecto).
