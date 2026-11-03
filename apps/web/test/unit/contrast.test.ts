import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, '../../src/styles.css'), 'utf8');
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
);

function color(name: string): string {
  const hex = tokens[name];
  if (!hex) throw new Error(`Token --color-${name} no encontrado en styles.css`);
  return hex;
}

// Luminancia relativa WCAG 2.x.
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(color(fg)), luminance(color(bg))].sort((a, b) => b - a);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe('contraste de tokens de color', () => {
  it.each([
    ['ink', 'bg'],
    ['muted', 'bg'],
    ['primary', 'bg'],
    ['primary-strong', 'bg'],
    ['danger', 'bg'],
    ['info', 'bg'],
    ['success', 'bg'],
    ['seal', 'bg'],
    ['seal', 'seal-soft'],
    ['bg', 'primary'],
    ['bg', 'primary-strong'],
    ['ink', 'surface'],
    ['muted', 'surface'],
    ['primary', 'surface'],
    ['ink', 'primary-soft'],
    ['primary', 'primary-soft'],
    ['muted', 'primary-soft'],
    // The mint band carries ink and deep green, never white text.
    ['ink', 'band'],
    ['on-band-muted', 'band'],
    ['primary-strong', 'band'],
    ['ink', 'tile'],
    ['ink', 'xp'],
    ['ink', 'xp-soft'],
  ])('%s sobre %s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['muted', 'bg'],
    ['focus', 'bg'],
    ['focus', 'band'],
    ['focus-on-primary', 'primary'],
    ['primary', 'bg'],
    ['primary', 'band'],
    ['streak', 'bg'],
  ])('%s sobre %s ≥ 3:1 (elementos no textuales: bordes, foco, casillas)', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});
