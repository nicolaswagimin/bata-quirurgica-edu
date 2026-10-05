// Reglas puras de gamificación compartidas por web y API.

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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
