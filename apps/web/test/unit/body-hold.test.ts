import { describe, expect, it } from 'vitest';
import { BODY_HOLD_MS, BodyHold } from '../../src/ar/body-hold.ts';
import type { BodyFrame } from '../../src/ar/posture.ts';

const body = { shoulderWidth: 100 } as BodyFrame;

describe('BodyHold', () => {
  it('returns the live body and remembers it', () => {
    expect(new BodyHold(200).update(body, 0)).toBe(body);
  });

  it('keeps drawing the last body for the hold window', () => {
    const hold = new BodyHold(200);
    hold.update(body, 0);
    expect(hold.update(null, 150)).toBe(body);
    expect(hold.update(null, 200)).toBe(body);
  });

  it('lets go once the window passes without a body', () => {
    const hold = new BodyHold(200);
    hold.update(body, 0);
    expect(hold.update(null, 201)).toBeNull();
  });

  it('the default window is a quarter of a second', () => {
    expect(new BodyHold().update(null, 0)).toBeNull();
    expect(BODY_HOLD_MS).toBe(250);
  });

  it('reset forgets the held body', () => {
    const hold = new BodyHold(200);
    hold.update(body, 0);
    hold.reset();
    expect(hold.update(null, 10)).toBeNull();
  });
});
