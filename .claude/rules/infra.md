---
description: Infraestructura como código (AWS CDK v2)
paths:
  - "infra/**"
  - "scripts/deploy.sh"
  - ".github/workflows/**"
---

- Pilas: `bata-web-<stage>`, `bata-api-<stage>`, `bata-budget-<stage>`, todas con
  `env: { region: 'us-east-1' }`. Contexto: `stage`, `webOrigin`, `alertEmail`, `ddSite`,
  `firebaseProjectId`, `assistantReservedConcurrency` (0 = sin concurrencia reservada).
- Las 6 funciones usan el mismo `entry` (`services/api/src/handlers/entry.ts`) con distinto
  `handler`; runtime `NODEJS_24_X`, `ARM_64`, formato CJS, sin VPC.
- Nada de `cdk deploy`, `cdk bootstrap` ni `aws`/`gcloud` desde el agente: son pasos humanos del
  checklist de lanzamiento. `scripts/deploy.sh` sin `--apply` solo imprime y sintetiza.
- Pruebas de aserción: `new App({ context: { ...ctx, 'aws:cdk:bundling-stacks': [] } })` para no
  empaquetar; `pnpm --filter @bata/infra run synth` sí empaqueta con esbuild local.
- Cada respuesta de gateway (DEFAULT_4XX, DEFAULT_5XX, UNAUTHORIZED, ACCESS_DENIED, THROTTLED,
  QUOTA_EXCEEDED, EXPIRED_TOKEN, INVALID_SIGNATURE, MISSING_AUTHENTICATION_TOKEN) lleva
  `Access-Control-Allow-Origin` = webOrigin entre comillas simples, `Access-Control-Allow-Headers`,
  `Vary: Origin` y cuerpo JSON `{"error":{"code":…,"message":$context.error.messageString}}`.
- IAM mínimo: `secretsmanager:GetSecretValue` solo sobre los secretos de cada función;
  `bedrock:InvokeModel` solo en la función `chat`, sobre
  `arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0`.
