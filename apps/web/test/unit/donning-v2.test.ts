import { describe, expect, it } from 'vitest';
import protocol from '../../../../content/protocolos/ar-practica-v3.json';
import { buildDonningV2 } from '../../src/three/donning-v2.ts';

describe('donning v2 static models', () => {
  it('maps protocol orders 2–8 to seven ordered models and preserves their copy', () => {
    const result = buildDonningV2(protocol);
    expect(result.steps).toHaveLength(7);
    expect(result.steps.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result.steps.map((step) => step.title)).toEqual([
      'Secado de manos',
      'Tomar la bata por dentro',
      'Despliegue sin sacudir',
      'Brazos en las mangas',
      'Amarre del circulante',
      'Guantes en técnica cerrada',
      'Tarjeta de transferencia y giro',
    ]);
    expect(result.steps.map((step) => step.modelUrl)).toEqual(
      Array.from({ length: 7 }, (_, i) => `/models/v2/paso-${i + 1}.glb`),
    );
    result.steps.forEach((step, i) => {
      expect(step.action).toBe(protocol.steps[i + 1]?.action);
      expect(step.look).toBe(protocol.steps[i + 1]?.look);
    });
    expect(result.reviewNote).toBe(protocol.reviewNote);
    expect(result.status).toBe('pendiente-validacion');
  });

  it('rejects malformed protocol input', () => {
    expect(() => buildDonningV2({ ...protocol, steps: [{ order: 2 }] })).toThrow();
  });
});
