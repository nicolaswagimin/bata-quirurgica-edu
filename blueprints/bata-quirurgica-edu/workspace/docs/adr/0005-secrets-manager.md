# ADR 0005 — AWS Secrets Manager en lugar de SSM Parameter Store

- Estado: aceptada (2026-10-04)

## Decisión
Los secretos viven en Secrets Manager con nombres `/bata/<stage>/groq-api-key`,
`/bata/<stage>/firebase-service-account` (JSON) y `/bata/<stage>/datadog-api-key`. Los crea el
estudiante; las Lambdas los leen al arrancar en frío y los cachean en memoria. Cada función recibe
`secretsmanager:GetSecretValue` solo sobre los secretos que usa.

## Razones
El constructo de Datadog consume `apiKeySecretArn` directamente; costo aproximado USD 1,20/mes por
los tres secretos; rotación administrada si se necesita.

## Se revisa si
El costo de secretos supera el 10 % del presupuesto mensual.
