import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8');

const ci = read('.github/workflows/ci.yml');
const nvmrc = read('.nvmrc');
const deploy = read('scripts/deploy.sh');

describe('.github/workflows/ci.yml', () => {
  it('pins Node from .nvmrc (24) and Java 21', () => {
    expect(ci).toContain('node-version-file: .nvmrc');
    expect(nvmrc.trim()).toBe('24');
    expect(ci).toContain("java-version: '21'");
  });

  it.each([
    'pnpm install --frozen-lockfile',
    'pnpm lint',
    'pnpm typecheck',
    'pnpm test',
    'pnpm test:emu',
    'pnpm synth',
    'pnpm --filter @bata/web run mediapipe:prepare',
    'pnpm test:e2e',
    'pnpm test:e2e:emu',
  ])('runs `%s`', (command) => {
    const runLines = ci.split('\n').map((line) => line.trim().replace(/^- run: /, ''));
    expect(runLines).toContain(command);
  });
});

describe('scripts/deploy.sh', () => {
  const lines = deploy.split('\n');

  it('passes -c stage=prod on every cdk deploy/synth line', () => {
    const cdkLines = lines.filter((line) => /cdk (deploy|synth)/.test(line));
    expect(cdkLines.length).toBeGreaterThan(0);
    for (const line of cdkLines) expect(line).toContain('-c stage=prod');
  });

  it('guards --apply on ALERT_EMAIL, FIREBASE_PROJECT_ID and apps/web/.env.production', () => {
    const start = deploy.indexOf('apply() {');
    const firstDeploy = deploy.indexOf('cdk deploy', deploy.indexOf('print_plan\n', start));
    expect(start).toBeGreaterThan(-1);
    const guard = deploy.slice(start, firstDeploy);
    expect(guard).toMatch(/-z "\$\{ALERT_EMAIL:-\}"/);
    expect(guard).toMatch(/-z "\$\{FIREBASE_PROJECT_ID:-\}"/);
    expect(guard).toMatch(/! -f apps\/web\/\.env\.production/);
    expect(guard).toContain('exit 2');
    expect(deploy).toMatch(/--apply\) apply ;;/);
  });

  it('prints usage without cdk commands and exits 2 for unknown arguments', () => {
    const usage = deploy.slice(deploy.indexOf('usage() {'), deploy.indexOf('USAGE\n}'));
    expect(usage).not.toContain('cdk');
    expect(deploy).toMatch(/\*\)\s+usage\s+exit 2/);
  });
});
