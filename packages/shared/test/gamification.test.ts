import { describe, expect, it } from 'vitest';
import {
  bogotaDate,
  levelForXp,
  minCorrectToPass,
  missionXpAward,
  nextStreak,
  PASS_THRESHOLD,
  PERFECT_BONUS_XP,
  previousDay,
  sameSet,
  starsForScore,
} from '../src/gamification.ts';

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

describe('minCorrectToPass', () => {
  it('exige el 60 % redondeado hacia arriba', () => {
    expect(minCorrectToPass(6)).toBe(4);
    expect(minCorrectToPass(5)).toBe(3); // 3/5 = 0.6 exacto (sin el epsilon saldría 4)
    expect(minCorrectToPass(3)).toBe(2);
    expect(minCorrectToPass(10)).toBe(6);
  });

  it('no exige nada si la misión no tiene preguntas', () => {
    expect(minCorrectToPass(0)).toBe(0);
  });

  it('coincide con PASS_THRESHOLD', () => {
    expect(PASS_THRESHOLD).toBe(0.6);
  });
});

describe('starsForScore', () => {
  it('da 3 estrellas solo con todas correctas', () => {
    expect(starsForScore(6, 6)).toBe(3);
    expect(starsForScore(5, 6)).toBe(2);
    expect(starsForScore(4, 6)).toBe(1);
    expect(starsForScore(3, 6)).toBe(0);
  });

  it('escala con el número de preguntas', () => {
    expect(starsForScore(5, 5)).toBe(3);
    expect(starsForScore(4, 5)).toBe(2);
    expect(starsForScore(3, 5)).toBe(1);
    expect(starsForScore(2, 5)).toBe(0);
  });
});

describe('missionXpAward', () => {
  const base = { total: 6, answered: 6, missionXp: 50, isRepeat: false };

  it('paga la misión y el bono si es perfecta', () => {
    const result = missionXpAward({ ...base, correct: 6 });
    expect(result).toMatchObject({
      passed: true,
      perfect: true,
      stars: 3,
      abandoned: false,
      baseXp: 50,
      bonusXp: PERFECT_BONUS_XP,
      totalXp: 50 + PERFECT_BONUS_XP,
    });
  });

  it('paga la misión sin bono si aprueba con fallos', () => {
    const result = missionXpAward({ ...base, correct: 4 });
    expect(result).toMatchObject({ passed: true, stars: 1, baseXp: 50, bonusXp: 0, totalXp: 50 });
  });

  it('no paga nada si no alcanza el mínimo', () => {
    const result = missionXpAward({ ...base, correct: 3 });
    expect(result).toMatchObject({ passed: false, stars: 0, baseXp: 0, totalXp: 0 });
  });

  it('no paga nada si sale antes de responder todo', () => {
    const result = missionXpAward({ ...base, correct: 4, answered: 4 });
    expect(result).toMatchObject({
      passed: false,
      abandoned: true,
      stars: 0,
      baseXp: 0,
      totalXp: 0,
    });
  });

  it('no paga nada al repasar una misión ya sellada', () => {
    const result = missionXpAward({ ...base, correct: 6, isRepeat: true });
    expect(result).toMatchObject({
      passed: true,
      perfect: true,
      stars: 3,
      baseXp: 0,
      bonusXp: 0,
      totalXp: 0,
    });
  });

  it('usa el umbral exacto de 3/5', () => {
    const passed = missionXpAward({
      correct: 3,
      total: 5,
      answered: 5,
      missionXp: 50,
      isRepeat: false,
    });
    expect(passed.passed).toBe(true);
    expect(passed.totalXp).toBe(50);

    const failed = missionXpAward({
      correct: 2,
      total: 5,
      answered: 5,
      missionXp: 50,
      isRepeat: false,
    });
    expect(failed.passed).toBe(false);
    expect(failed.totalXp).toBe(0);
  });
});
