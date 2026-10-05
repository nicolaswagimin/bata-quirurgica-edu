# ADR 0001 — Lambdas sin VPC

- Estado: aceptada (2026-10-04)

## Contexto
Las funciones Lambda solo hablan con APIs públicas HTTPS: Groq, Firestore (Google Cloud),
Amazon Bedrock y Datadog. No existe ningún recurso privado (RDS, ElastiCache, EFS).

## Decisión
Las Lambdas se despliegan sin VPC.

## Razones
- Una VPC con salida a Internet exige NAT Gateway: USD 0,045/h ≈ USD 32,85/mes más datos
  (https://aws.amazon.com/vpc/pricing/), más que todo el presupuesto mensual del proyecto (USD 20).
- Agrega latencia de arranque en frío y complejidad operativa para un solo estudiante.
- Function URLs con streaming no son el camino elegido (ver ADR 0002), así que la VPC no aporta nada.

## Controles de seguridad que la reemplazan
IAM de mínimo privilegio por función, AWS Secrets Manager, autorizador Lambda con verificación de
ID token de Firebase, throttling por etapa y por método, cuotas por usuario en Firestore y
concurrencia reservada en las funciones del asistente.

## Se revisa si
Se agrega RDS/ElastiCache u otro recurso privado, o se exige filtrado de egreso o IP estática.
