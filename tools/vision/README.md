# tools/vision — dataset del AR v2

Pipeline de datos de la fase 0 del [plan AR v2](../../docs/ar-v2-plan.md). No entrena nada todavía:
recibe las capturas de landmarks, las valida y las deja listas para la fase 3.

## Privacidad

- Solo se graban **coordenadas del cuerpo** (puntos, ángulos y velocidades), nunca video ni
  imágenes.
- La captura ocurre en el navegador (`/bata-ar?captura=1`, solo en desarrollo) y el archivo se
  descarga al equipo de quien graba. Este directorio no se sube a ningún servicio.
- `data/` está en `.gitignore`: las capturas no se versionan.

## Grabar una toma

1. En desarrollo: `pnpm --filter @bata/web dev`.
2. Abre `http://localhost:5173/bata-ar?captura=1`.
3. Acepta el consentimiento, elige el paso y pulsa **Grabar 2 s**. Repite 3–5 veces por paso.
4. Pulsa **Descargar** en cada toma y guárdala en `tools/vision/data/`.
5. **Borrar tomas** elimina lo grabado en esa sesión.

## Validar

```bash
python3 tools/vision/validate.py tools/vision/data
python3 tools/vision/validate.py tools/vision/data/ar-captura-g3-bata-*.json
```

Sale con código 1 si algún archivo no cumple el contrato. El formato está en
[el plan](../../docs/ar-v2-plan.md#6-formato-de-captura) y el esquema autoritativo es
`packages/shared/src/perception.ts`.

## Pruebas del validador

```bash
python3 -m unittest discover -s tools/vision
```

## Estructura

```
tools/vision/
  README.md          Este archivo
  validate.py        Validador del JSON de captura (stdlib, sin dependencias)
  test_validate.py   Pruebas del validador
  data/              Capturas locales (gitignored)
```

## Después de la fase 0

- Fase 3: congelar los splits **por persona** (ninguna persona en train y test) y documentar la
  composición del dataset.
- Fase 4: entrenar el clasificador temporal, exportarlo a `apps/web/public/models/` y evaluarlo
  contra las reglas con personas no vistas.
