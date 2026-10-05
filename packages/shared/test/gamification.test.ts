import { describe, expect, it } from 'vitest';
import { bogotaDate, levelForXp, nextStreak, previousDay, sameSet } from '../src/gamification.ts';

describe('levelForXp', () => {
  it('sigue floor(sqrt(xp / 50)) + 1', () => {
    expect([0, 49, 50, 200, 450].map(levelForXp)).toEqual([1, 1, 2, 3, 4]);
  });
});

describe('bogotaDate', () => {
  it('resta 5 horas fijas', () => {
    expect(bogotaDate(new Date('2026-01-01T04:59:00Z'))).toBe('2025-12-31');
    expect(bogotaDate(new Date('2026-01-01T05:00:00Z'))).toBe('2026-01-01');
  });
});

describe('previousDay', () => {
  it('cruza meses y años', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
  });
});

describe('nextStreak', () => {
  const today = '2026-10-05';
  it('suma uno si la última actividad fue ayer', () => {
    expect(nextStreak({ lastActiveDate: '2026-10-04', streakDays: 3 }, today)).toBe(4);
  });
  it('conserva la racha si ya hubo actividad hoy', () => {
    expect(nextStreak({ lastActiveDate: today, streakDays: 3 }, today)).toBe(3);
  });
  it('reinicia a 1 si pasaron dos días o no hay actividad previa', () => {
    expect(nextStreak({ lastActiveDate: '2026-10-03', streakDays: 3 }, today)).toBe(1);
    expect(nextStreak({ lastActiveDate: null, streakDays: 0 }, today)).toBe(1);
  });
});

describe('sameSet', () => {
  it('ignora el orden', () => {
    expect(sameSet(['a', 'c'], ['c', 'a'])).toBe(true);
    expect(sameSet(['a'], ['a', 'b'])).toBe(false);
    expect(sameSet(['a', 'b'], ['a', 'c'])).toBe(false);
  });
});
