import { describe, expect, it } from 'vitest';
import { preferredDelegate } from '../../src/ar/pose.ts';
import { shouldFallbackToCpu } from '../../src/ar/pose-performance.ts';

describe('preferredDelegate', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5, 'CPU'],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 5, 'CPU'],
    ['Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)', 5, 'CPU'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', 5, 'CPU'],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0', 5, 'GPU'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', 0, 'GPU'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0', 0, 'GPU'],
  ] as const)('%s with %i touch points selects %s', (userAgent, maxTouchPoints, expected) => {
    expect(preferredDelegate({ userAgent, maxTouchPoints, search: '' })).toBe(expected);
  });

  it('honors both QA overrides over device defaults', () => {
    expect(
      preferredDelegate({ userAgent: 'iPhone', maxTouchPoints: 5, search: '?delegado=gpu' }),
    ).toBe('GPU');
    expect(
      preferredDelegate({ userAgent: 'Chrome', maxTouchPoints: 0, search: '?x=1&delegado=cpu' }),
    ).toBe('CPU');
    expect(
      preferredDelegate({ userAgent: 'iPhone', maxTouchPoints: 5, search: '?delegado=invalid' }),
    ).toBe('CPU');
  });
});

describe('shouldFallbackToCpu', () => {
  it('waits for eight samples and only switches GPU', () => {
    expect(shouldFallbackToCpu(Array(7).fill(100), 'GPU')).toBe(false);
    expect(shouldFallbackToCpu(Array(8).fill(100), 'GPU')).toBe(true);
    expect(shouldFallbackToCpu(Array(8).fill(100), 'CPU')).toBe(false);
  });

  it('uses the median of the first eight without mutating samples', () => {
    const durations = [1000, 20, 30, 40, 50, 60, 70, 80];
    expect(shouldFallbackToCpu(durations, 'GPU')).toBe(false);
    expect(durations[0]).toBe(1000);
    expect(shouldFallbackToCpu([...durations, ...Array(20).fill(1000)], 'GPU')).toBe(false);
  });

  it('requires a median strictly above 60 ms', () => {
    expect(shouldFallbackToCpu([1, 2, 3, 50, 70, 100, 100, 100], 'GPU')).toBe(false);
    expect(shouldFallbackToCpu([1, 2, 3, 51, 70, 100, 100, 100], 'GPU')).toBe(true);
  });
});

it('switches GPU immediately after any detection over one second, including warmup', () => {
  expect(shouldFallbackToCpu([1001], 'GPU')).toBe(true);
  expect(shouldFallbackToCpu([1000], 'GPU')).toBe(false);
  expect(shouldFallbackToCpu([1001], 'CPU')).toBe(false);
  expect(shouldFallbackToCpu([...Array(8).fill(10), 1001], 'GPU')).toBe(true);
});
