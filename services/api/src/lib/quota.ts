// Cuotas por usuario con ventanas fijas. Puro: `repos.ts#consumeQuotaTx` lo envuelve en una transacción.
export const QUOTA_LIMITS = { chatHour: 30, chatDay: 100, sttHour: 30 } as const;

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export type QuotaKind = 'chat' | 'stt';

export type QuotaDoc = {
  chatHourStart: number;
  chatHourCount: number;
  chatDayStart: number;
  chatDayCount: number;
  sttHourStart: number;
  sttHourCount: number;
};

export type QuotaResult = { allowed: boolean; next: QuotaDoc };

function emptyQuota(nowMs: number): QuotaDoc {
  return {
    chatHourStart: nowMs,
    chatHourCount: 0,
    chatDayStart: nowMs,
    chatDayCount: 0,
    sttHourStart: nowMs,
    sttHourCount: 0,
  };
}

// Reinicia la ventana cuando ya pasó su duración desde el inicio.
function windowed(start: number, count: number, nowMs: number, sizeMs: number) {
  return nowMs - start >= sizeMs ? { start: nowMs, count: 0 } : { start, count };
}

export function consumeQuota(
  doc: QuotaDoc | undefined,
  kind: QuotaKind,
  nowMs: number,
): QuotaResult {
  const base = doc ?? emptyQuota(nowMs);
  if (kind === 'chat') {
    const hour = windowed(base.chatHourStart, base.chatHourCount, nowMs, HOUR_MS);
    const day = windowed(base.chatDayStart, base.chatDayCount, nowMs, DAY_MS);
    const current = {
      ...base,
      chatHourStart: hour.start,
      chatHourCount: hour.count,
      chatDayStart: day.start,
      chatDayCount: day.count,
    };
    if (hour.count >= QUOTA_LIMITS.chatHour || day.count >= QUOTA_LIMITS.chatDay) {
      return { allowed: false, next: current };
    }
    return {
      allowed: true,
      next: { ...current, chatHourCount: hour.count + 1, chatDayCount: day.count + 1 },
    };
  }
  const hour = windowed(base.sttHourStart, base.sttHourCount, nowMs, HOUR_MS);
  const current = { ...base, sttHourStart: hour.start, sttHourCount: hour.count };
  if (hour.count >= QUOTA_LIMITS.sttHour) return { allowed: false, next: current };
  return { allowed: true, next: { ...current, sttHourCount: hour.count + 1 } };
}
