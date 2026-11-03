import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Regression: canvas code reads colours with getComputedStyle(`--color-<name>`). Tailwind v4 drops
// theme variables that no utility uses, which painted the AR gown black. Every colour read that way
// must live in an `@theme static` block or be used by a utility class somewhere in src/.
const SRC = join(import.meta.dirname, '../../src');
const css = readFileSync(join(SRC, 'styles.css'), 'utf8');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

const sources = files(SRC).map((f) => readFileSync(f, 'utf8'));
const read = new Set(
  sources.flatMap((s) =>
    [...s.matchAll(/token\('([a-z-]+)'\)|tokenColor\('([a-z-]+)'\)/g)].map(
      (m) => m[1] ?? m[2] ?? '',
    ),
  ),
);
const staticBlock = [...css.matchAll(/@theme static \{([\s\S]*?)\n\}/g)]
  .map((m) => m[1])
  .join('\n');

describe('colours read by canvas code', () => {
  it('finds the canvas colour reads', () => {
    expect(read.has('gown')).toBe(true);
  });

  it.each([...read])('--color-%s reaches the built CSS', (name) => {
    const inStatic = new RegExp(`--color-${name}:`).test(staticBlock);
    const usedByUtility = sources.some((s) =>
      new RegExp(
        `\\b(?:bg|text|border|ring|fill|stroke|outline|decoration|accent)-${name}(?![\\w-])`,
      ).test(s),
    );
    expect(inStatic || usedByUtility).toBe(true);
  });
});
