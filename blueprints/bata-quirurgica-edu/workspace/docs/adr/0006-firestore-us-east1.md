# ADR 0006 — Firestore en us-east1 (ubicación PERMANENTE)

- Estado: aceptada (2026-10-04)

## Decisión
La base `(default)` de Firestore se crea en `us-east1`, junto a AWS us-east-1 donde corren las
Lambdas y Bedrock.

## ADVERTENCIA
La ubicación de la base de datos de Firestore es PERMANENTE una vez creada. Crearla en otra región
obliga a crear un proyecto nuevo de Firebase/Google Cloud. Por eso la creación es una puerta humana
de la lista de lanzamiento y nunca un paso automatizado:

```bash
# verificar antes de ejecutar
gcloud firestore databases create --database="(default)" --location=us-east1 --project=<id>
gcloud firestore databases describe --database="(default)" --project=<id> --format="value(locationId)"
# debe imprimir: us-east1
```

## Se revisa si
Nunca para esta base; solo un proyecto nuevo permite otra ubicación.
