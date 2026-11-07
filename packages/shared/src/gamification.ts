// Reglas puras de gamificación compartidas por web y API.

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** XP por completar una práctica guiada del AR espejo; se suma una sola vez por día de Bogotá. */
export const PRACTICE_XP = 30;

/**
 * Proporción mínima de aciertos para aprobar una misión. El intento se corrige al final: por debajo
 * de este umbral la misión no se sella y no se gana ningún XP (como un examen).
 */
export const PASS_THRESHOLD = 0.6;

/** Aciertos mínimos para aprobar una misión de `total` preguntas (60 % redondeado hacia arriba). */
export function minCorrectToPass(total: number): number {
  if (total <= 0) return 0;
  // El epsilon evita que 5 × 0.6 = 3.0000000000000004 exija 4 aciertos.
  return Math.max(1, Math.ceil(total * PASS_THRESHOLD - 1e-9));
}

/** Bono de XP por aprobar una misión con todas las respuestas correctas. */
export const PERFECT_BONUS_XP = 20;

/**
 * Vidas por intento: al tercer fallo el examen se cierra solo y no se aprueba. Con las misiones de
 * seis preguntas coincide con el umbral (tres fallos ya no permiten acertar el 60 %), así que solo
 * acorta el suspenso; en misiones más largas es un límite real.
 */
export const MAX_LIVES = 3;

/** Meta diaria de XP: una misión aprobada la cumple. */
export const DAILY_GOAL_XP = 50;

/** Proporciones mínimas de aciertos para 1, 2 y 3 estrellas (la perfección da 3). */
export const STAR_THRESHOLDS = [PASS_THRESHOLD, 0.8, 1] as const;

/** Cuántas estrellas de 3 da un intento: 0 si no aprueba, 1 al aprobar, 2 sobre 80 %, 3 perfecto. */
export function starsForScore(correct: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const ratio = correct / total;
  if (ratio >= STAR_THRESHOLDS[2]) return 3;
  if (ratio >= STAR_THRESHOLDS[1]) return 2;
  if (ratio >= STAR_THRESHOLDS[0]) return 1;
  return 0;
}

export type MissionScore = {
  /** true si alcanzó el mínimo de aciertos. */
  passed: boolean;
  /** true si acertó todas las preguntas. */
  perfect: boolean;
  /** Estrellas de 0 a 3. */
  stars: 0 | 1 | 2 | 3;
  /** true si el intento se cerró con preguntas sin responder. */
  abandoned: boolean;
  /** true si se quedó sin vidas antes de terminar. */
  outOfLives: boolean;
};

/** Corrige un intento ya cerrado. No sabe de XP ni de reintentos: solo de aciertos. */
export function scoreMission(correct: number, total: number): MissionScore {
  return {
    passed: total > 0 && correct >= minCorrectToPass(total),
    perfect: total > 0 && correct === total,
    stars: starsForScore(correct, total),
    abandoned: false,
    outOfLives: false,
  };
}

export type MissionXpResult = MissionScore & {
  /** XP de la misión; 0 si no aprobó o si era un repaso. */
  baseXp: number;
  /** Bono por misión perfecta; 0 si no fue perfecta o si era un repaso. */
  bonusXp: number;
  /** baseXp + bonusXp. */
  totalXp: number;
};

export type MissionXpInput = {
  /** Respuestas correctas del intento. */
  correct: number;
  /** Preguntas del intento. */
  total: number;
  /** Preguntas que el estudiante llegó a responder. */
  answered: number;
  /** XP que promete la misión (`missions/{id}.xpReward`). */
  missionXp: number;
  /** true si la misión ya estaba sellada: repetirla es repaso y no da XP. */
  isRepeat: boolean;
};

/**
 * XP de un intento de misión.
 *
 * El XP es del examen, no de cada pregunta: solo se paga si el intento se respondió completo y
 * alcanzó `PASS_THRESHOLD`. Un intento fallido o abandonado deja 0, y repetir una misión ya
 * sellada también (el repaso sirve para mejorar las estrellas, no para farmear XP).
 */
export function missionXpAward(input: MissionXpInput): MissionXpResult {
  const { correct, total, answered, missionXp, isRepeat } = input;
  const wrong = Math.max(0, answered - correct);
  const outOfLives = total > 0 && answered < total && wrong >= MAX_LIVES;
  const abandoned = total > 0 && answered < total && !outOfLives;
  const score: MissionScore =
    abandoned || outOfLives
      ? { passed: false, perfect: false, stars: 0, abandoned, outOfLives }
      : scoreMission(correct, total);

  if (!score.passed || isRepeat) {
    return { ...score, baseXp: 0, bonusXp: 0, totalXp: 0 };
  }
  const baseXp = Math.max(0, missionXp);
  const bonusXp = score.perfect ? PERFECT_BONUS_XP : 0;
  return { ...score, baseXp, bonusXp, totalXp: baseXp + bonusXp };
}

/** XP de hoy: 0 si el último día acreditado no es hoy en Bogotá. */
export function dailyXp(
  profile: { xpToday?: number | null; dailyGoalDate?: string | null },
  now: Date,
): number {
  return profile.dailyGoalDate === bogotaDate(now) ? Math.max(0, profile.xpToday ?? 0) : 0;
}

/** Acumulado diario tras sumar `amount` XP; se reinicia al cambiar de día de Bogotá. */
export function creditDailyXp(
  profile: { xpToday?: number | null; dailyGoalDate?: string | null },
  now: Date,
  amount: number,
): { xpToday: number; dailyGoalDate: string } {
  const today = bogotaDate(now);
  const current = profile.dailyGoalDate === today ? Math.max(0, profile.xpToday ?? 0) : 0;
  return { xpToday: current + Math.max(0, amount), dailyGoalDate: today };
}

/** Nivel = floor(sqrt(xp / 50)) + 1. */
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

/** Fecha `YYYY-MM-DD` en America/Bogota. UTC−5 fijo: Colombia no tiene horario de verano. */
export function bogotaDate(d: Date): string {
  return new Date(d.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Día anterior a una fecha `YYYY-MM-DD`. */
export function previousDay(ymd: string): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}

export type StreakState = { lastActiveDate: string | null; streakDays: number };

/** Racha tras una respuesta correcta el día `today` (`YYYY-MM-DD`, Bogotá). */
export function nextStreak({ lastActiveDate, streakDays }: StreakState, today: string): number {
  if (lastActiveDate === today) return Math.max(1, streakDays);
  if (lastActiveDate === previousDay(today)) return streakDays + 1;
  return 1;
}

/** Igualdad de conjuntos (ignora orden y duplicados). */
export function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}
