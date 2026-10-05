import { pathToFileURL } from 'node:url';
import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack.ts';
import { BudgetStack } from '../lib/budget-stack.ts';
import { WebStack } from '../lib/web-stack.ts';

export interface AppContext {
  stage: string;
  webOrigin: string;
  alertEmail: string;
  ddSite: string;
  firebaseProjectId: string;
  assistantReservedConcurrency: number;
}

function requireContext(app: App, key: keyof AppContext): string {
  const value: unknown = app.node.tryGetContext(key);
  if (value === undefined || value === null || value === '') {
    throw new Error(`Falta el contexto de CDK "${key}"`);
  }
  return String(value);
}

/** Builds the three stacks; `context` overrides/extends what cdk.json provides. */
export function buildApp(context: Record<string, unknown> = {}): App {
  const app = new App({ context });
  const stage = requireContext(app, 'stage');
  const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' };

  new WebStack(app, `bata-web-${stage}`, { env, stage });
  new ApiStack(app, `bata-api-${stage}`, {
    env,
    stage,
    webOrigin: requireContext(app, 'webOrigin'),
    ddSite: requireContext(app, 'ddSite'),
    firebaseProjectId: requireContext(app, 'firebaseProjectId'),
    assistantReservedConcurrency: Number(requireContext(app, 'assistantReservedConcurrency')),
  });
  new BudgetStack(app, `bata-budget-${stage}`, {
    env,
    stage,
    alertEmail: requireContext(app, 'alertEmail'),
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildApp().synth();
}
