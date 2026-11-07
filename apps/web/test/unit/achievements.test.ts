import { describe, expect, it } from 'vitest';
import { achievementsFor } from '../../src/lib/achievements.ts';

const base = { level: 1, streakDays: 0, missionsSealed: 0, perfectMissions: 0, totalMissions: 5 };

describe('achievementsFor', () => {
  it('empieza sin ningún logro', () => {
    expect(achievementsFor(base).every((a) => !a.earned)).toBe(true);
  });

  it('gana todos los logros cuando se cumplen sus condiciones', () => {
    const all = achievementsFor({
      level: 2,
      streakDays: 7,
      missionsSealed: 5,
      perfectMissions: 1,
      totalMissions: 5,
    });
    expect(all.every((a) => a.earned)).toBe(true);
  });

  it('no completa "quirófano completo" sin misiones', () => {
    const result = achievementsFor({ ...base, totalMissions: 0 });
    expect(result.find((a) => a.id === 'all-missions')?.earned).toBe(false);
  });

  it('la estrella pide una misión perfecta, no solo aprobada', () => {
    const approved = achievementsFor({ ...base, missionsSealed: 3, perfectMissions: 0 });
    expect(approved.find((a) => a.id === 'perfect')?.earned).toBe(false);
    const perfect = achievementsFor({ ...base, missionsSealed: 3, perfectMissions: 1 });
    expect(perfect.find((a) => a.id === 'perfect')?.earned).toBe(true);
  });
});
