#!/usr/bin/env bash
# Production deploy. `--dry-run` prints the plan and synthesizes the prod stacks;
# `--apply` runs the plan and is a human step (needs AWS credentials).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# `pnpm exec` only adds a relative ./node_modules/.bin to PATH, but CDK bundles from the repo
# root, so it would not find the infra package's esbuild without this absolute entry.
export PATH="$ROOT/infra/node_modules/.bin:$PATH"

usage() {
  cat <<'USAGE'
Uso: bash scripts/deploy.sh --dry-run | --apply

  --dry-run  Imprime el plan de despliegue y sintetiza las pilas de producción.
  --apply    Ejecuta el plan (paso humano). Requiere ALERT_EMAIL, FIREBASE_PROJECT_ID
             y apps/web/.env.production.
USAGE
}

print_plan() {
  cat <<'PLAN'
Plan de despliegue (prod):
1. pnpm --filter @bata/infra exec cdk deploy bata-web-prod -c stage=prod -c webOrigin=https://pendiente.invalid -c alertEmail="$ALERT_EMAIL" -c firebaseProjectId="$FIREBASE_PROJECT_ID" --require-approval never
2. aws cloudformation describe-stacks --stack-name bata-web-prod --query "Stacks[0].Outputs"  → BucketName, DistributionId, DistributionDomainName
3. pnpm --filter @bata/infra exec cdk deploy bata-api-prod bata-budget-prod -c stage=prod -c webOrigin="https://$DistributionDomainName" -c alertEmail="$ALERT_EMAIL" -c firebaseProjectId="$FIREBASE_PROJECT_ID" -c assistantReservedConcurrency="${ASSISTANT_RESERVED_CONCURRENCY:-5}" --require-approval never
4. aws cloudformation describe-stacks --stack-name bata-api-prod --query "Stacks[0].Outputs"  → ApiUrl
5. pnpm --filter @bata/web run mediapipe:prepare && VITE_API_BASE_URL="${ApiUrl%/}" pnpm --filter @bata/web build   (lee apps/web/.env.production)
6. aws s3 sync apps/web/dist "s3://$BucketName" --delete
7. aws cloudfront create-invalidation --distribution-id "$DistributionId" --paths '/*'
8. curl -sf "${ApiUrl%/}/health"
PLAN
}

stack_output() {
  aws cloudformation describe-stacks --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}

dry_run() {
  print_plan
  echo
  echo "Sintetizando pilas de producción (sin desplegar)…"
  pnpm --filter @bata/infra exec cdk synth --quiet -c stage=prod -c webOrigin=https://example.cloudfront.net -c alertEmail=alertas@example.com -c firebaseProjectId=demo-bata
  echo "Dry run OK."
}

apply() {
  local missing=0
  if [[ -z "${ALERT_EMAIL:-}" ]]; then
    echo "Falta ALERT_EMAIL." >&2
    missing=1
  fi
  if [[ -z "${FIREBASE_PROJECT_ID:-}" ]]; then
    echo "Falta FIREBASE_PROJECT_ID." >&2
    missing=1
  fi
  if [[ ! -f apps/web/.env.production ]]; then
    echo "Falta apps/web/.env.production." >&2
    missing=1
  fi
  if [[ "$missing" -ne 0 ]]; then
    exit 2
  fi

  print_plan
  echo

  echo "== 1. Pila web"
  pnpm --filter @bata/infra exec cdk deploy bata-web-prod -c stage=prod -c webOrigin=https://pendiente.invalid -c alertEmail="$ALERT_EMAIL" -c firebaseProjectId="$FIREBASE_PROJECT_ID" --require-approval never

  echo "== 2. Salidas de la pila web"
  local BucketName DistributionId DistributionDomainName
  BucketName="$(stack_output bata-web-prod BucketName)"
  DistributionId="$(stack_output bata-web-prod DistributionId)"
  DistributionDomainName="$(stack_output bata-web-prod DistributionDomainName)"

  echo "== 3. Pilas api y budget"
  pnpm --filter @bata/infra exec cdk deploy bata-api-prod bata-budget-prod -c stage=prod -c webOrigin="https://$DistributionDomainName" -c alertEmail="$ALERT_EMAIL" -c firebaseProjectId="$FIREBASE_PROJECT_ID" -c assistantReservedConcurrency="${ASSISTANT_RESERVED_CONCURRENCY:-5}" --require-approval never

  echo "== 4. Salidas de la pila api"
  local ApiUrl
  ApiUrl="$(stack_output bata-api-prod ApiUrl)"

  echo "== 5. Build web"
  pnpm --filter @bata/web run mediapipe:prepare
  VITE_API_BASE_URL="${ApiUrl%/}" pnpm --filter @bata/web build

  echo "== 6. Subir a S3"
  aws s3 sync apps/web/dist "s3://$BucketName" --delete

  echo "== 7. Invalidar CloudFront"
  aws cloudfront create-invalidation --distribution-id "$DistributionId" --paths '/*'

  echo "== 8. Health check"
  curl -sf "${ApiUrl%/}/health"
  echo
  echo "Despliegue completo: https://$DistributionDomainName"
}

case "${1:-}" in
  --dry-run) dry_run ;;
  --apply) apply ;;
  *)
    usage
    exit 2
    ;;
esac
