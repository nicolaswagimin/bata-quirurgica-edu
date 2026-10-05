import { describe, expect, it } from 'vitest';
import { consumeQuota, DAY_MS, HOUR_MS, QUOTA_LIMITS, type QuotaDoc } from '../../src/lib/quota.ts';

const T0 = 1_791_130_800_000;

function quota(overrides: Partial<QuotaDoc> = {}): QuotaDoc {
  return {
    chatHourStart: T0,
    chatHourCount: 0,
    chatDayStart: T0,
    chatDayCount: 0,
    sttHourStart: T0,
    sttHourCount: 0,
    ...overrides,
  };
}

describe('consumeQuota', () => {
  it('starts a fresh quota when there is no document', () => {
    const { allowed, next } = consumeQuota(undefined, 'chat', T0);
    expect(allowed).toBe(true);
    expect(next).toEqual(quota({ chatHourCount: 1, chatDayCount: 1 }));
  });

  it('rejects chat at 30 requests in the current hour', () => {
    const doc = quota({ chatHourCount: QUOTA_LIMITS.chatHour, chatDayCount: 30 });
    const { allowed, next } = consumeQuota(doc, 'chat', T0 + 60_000);
    expect(allowed).toBe(false);
    expect(next.chatHourCount).toBe(30);
    expect(next.chatDayCount).toBe(30);
  });

  it('rejects chat at 100 requests in the current day even with a fresh hour', () => {
    const doc = quota({
      chatHourStart: T0 + 5 * HOUR_MS,
      chatHourCount: 0,
      chatDayCount: QUOTA_LIMITS.chatDay,
    });
    expect(consumeQuota(doc, 'chat', T0 + 5 * HOUR_MS + 1).allowed).toBe(false);
  });

  it('rejects stt at 30 requests in the current hour without touching chat', () => {
    const doc = quota({ sttHourCount: QUOTA_LIMITS.sttHour, chatHourCount: 3 });
    const stt = consumeQuota(doc, 'stt', T0 + 1);
    expect(stt.allowed).toBe(false);
    expect(consumeQuota(doc, 'chat', T0 + 1).allowed).toBe(true);
  });

  it('allows the 30th chat request in the hour', () => {
    const { allowed, next } = consumeQuota(
      quota({ chatHourCount: 29, chatDayCount: 29 }),
      'chat',
      T0,
    );
    expect(allowed).toBe(true);
    expect(next.chatHourCount).toBe(30);
  });

  it('resets the hourly counter once 3600 s have passed since its window start', () => {
    const doc = quota({ chatHourCount: 30, chatDayCount: 30, sttHourCount: 30 });
    expect(consumeQuota(doc, 'chat', T0 + HOUR_MS - 1).allowed).toBe(false);
    const chat = consumeQuota(doc, 'chat', T0 + HOUR_MS);
    expect(chat.allowed).toBe(true);
    expect(chat.next).toMatchObject({
      chatHourStart: T0 + HOUR_MS,
      chatHourCount: 1,
      chatDayStart: T0,
      chatDayCount: 31,
    });
    const stt = consumeQuota(doc, 'stt', T0 + HOUR_MS);
    expect(stt.allowed).toBe(true);
    expect(stt.next).toMatchObject({ sttHourStart: T0 + HOUR_MS, sttHourCount: 1 });
  });

  it('resets the daily counter once 86400 s have passed', () => {
    const doc = quota({ chatHourCount: 30, chatDayCount: 100 });
    const { allowed, next } = consumeQuota(doc, 'chat', T0 + DAY_MS);
    expect(allowed).toBe(true);
    expect(next).toMatchObject({ chatDayStart: T0 + DAY_MS, chatDayCount: 1, chatHourCount: 1 });
  });
});
