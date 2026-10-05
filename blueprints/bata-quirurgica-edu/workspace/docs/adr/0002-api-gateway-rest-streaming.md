# ADR 0002 — API Gateway REST (no HTTP API) con response streaming

- Estado: aceptada (2026-10-04)

## Contexto
El asistente debe transmitir la respuesta del modelo token a token para que la latencia percibida
sea baja.

## Decisión
Una sola API REST Regional (etapa `v1`) para todo. `POST /assistant/chat` usa integración
`AWS_PROXY` con `responseTransferMode: STREAM`. Autorizador Lambda de tipo TOKEN que verifica el
ID token de Firebase con firebase-admin (`verifyIdToken`), con caché de 300 s.

## Razones
- "Response streaming is only supported for REST APIs" —
  https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode.html
  Restricciones: solo AWS_PROXY/HTTP_PROXY, sin caché de endpoint, sin codificación de contenido,
  sin VTL; hasta 15 min; tiempo de inactividad 5 min (Regional).
- Formato del stream Lambda: metadatos JSON + 8 bytes nulos —
  https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode-lambda.html
- REST no tiene autorizador JWT nativo; el autorizador TOKEN cubre el caso.
- Se rechaza Lambda Function URL: sería un endpoint público sin autenticación en el borde.

## Se revisa si
HTTP API incorpora response streaming, o el tráfico exige otra topología.
