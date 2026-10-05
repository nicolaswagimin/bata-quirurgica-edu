// Bundles the Lambda entry the same way NodejsFunction does (esbuild, CJS, node24, same externals)
// and loads the output in plain Node to prove the six handler exports exist. This is the contract
// between services/api/src/handlers/entry.ts and the `handler` names in infra/lib/api-stack.ts.
// Output goes to infra/cdk.out/ (gitignored).
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const HANDLERS = ['authorizer', 'me', 'quiz', 'chat', 'transcribe', 'admin'] as const;

const infraRoot = resolve(import.meta.dirname, '..');
const entry = resolve(infraRoot, '..', 'services', 'api', 'src', 'handlers', 'entry.ts');
const outfile = join(infraRoot, 'cdk.out', 'entry-check.cjs');

async function main(): Promise<void> {
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    external: ['datadog-lambda-js', 'dd-trace'],
    outfile,
    logLevel: 'warning',
  });
  const require = createRequire(import.meta.url);
  const mod = require(outfile) as Record<string, unknown>;
  const missing = HANDLERS.filter((name) => typeof mod[name] !== 'function');
  if (missing.length > 0) {
    console.error(`Faltan exports en el bundle: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`Bundle OK: ${HANDLERS.join(', ')}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
