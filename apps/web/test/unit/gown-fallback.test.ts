import { describe, expect, it } from 'vitest';
import { DOWNGRADE_AFTER_MS, GownFallback, WARMUP_MS } from '../../src/ar/gown-fallback.ts';
import {
  easeLights,
  fibreHeight,
  hexToRgb,
  lightForLuma,
  normalsFromHeight,
} from '../../src/ar/nonwoven-material.ts';

describe('GownFallback', () => {
  it('ignora el arranque y baja de XPBD a resortes y luego a 2.5D si los fps no alcanzan', () => {
    const f = new GownFallback('xpbd');
    expect(f.update(10, 0)).toBe('xpbd');
    expect(f.update(10, WARMUP_MS - 1)).toBe('xpbd');
    f.update(25, WARMUP_MS);
    expect(f.update(25, WARMUP_MS + DOWNGRADE_AFTER_MS)).toBe('springs');
    f.update(15, WARMUP_MS + DOWNGRADE_AFTER_MS + 1);
    expect(f.update(15, WARMUP_MS + 2 * DOWNGRADE_AFTER_MS + 1)).toBe('2d');
  });

  it('una caída breve no baja la calidad', () => {
    const f = new GownFallback('springs');
    f.update(30, 0);
    f.update(12, WARMUP_MS);
    f.update(30, WARMUP_MS + 1000);
    expect(f.update(12, WARMUP_MS + DOWNGRADE_AFTER_MS + 500)).toBe('springs');
  });

  it('downgrade baja un nivel de inmediato', () => {
    const f = new GownFallback('xpbd');
    expect(f.downgrade()).toBe('springs');
    expect(f.downgrade()).toBe('2d');
  });

  it('un fallo va directo a 2.5D y no vuelve a subir', () => {
    const f = new GownFallback('springs');
    expect(f.fail()).toBe('2d');
    expect(f.update(60, WARMUP_MS * 3)).toBe('2d');
  });
});

describe('tela no tejida', () => {
  it('el campo de fibras es determinista y está en 0..1', () => {
    const a = fibreHeight(32);
    expect(a).toEqual(fibreHeight(32));
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...a)).toBeLessThanOrEqual(1);
  });

  it('el normal map de una superficie plana apunta hacia afuera', () => {
    const flat = new Float32Array(16).fill(0.5);
    const n = normalsFromHeight(flat, 4);
    expect([n[0], n[1], n[2]]).toEqual([128, 128, 255]);
  });

  it('la luz sube con el brillo de la cámara y se suaviza', () => {
    expect(lightForLuma(220).key).toBeGreaterThan(lightForLuma(30).key);
    const eased = easeLights(lightForLuma(30), lightForLuma(220), 0.5);
    expect(eased.key).toBeGreaterThan(lightForLuma(30).key);
    expect(eased.key).toBeLessThan(lightForLuma(220).key);
  });

  it('lee el color del token', () => {
    expect(hexToRgb('#32718e')).toEqual([0x32, 0x71, 0x8e]);
  });
});
