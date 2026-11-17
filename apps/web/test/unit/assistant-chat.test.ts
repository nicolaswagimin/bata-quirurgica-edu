import { messageForStatus } from '@bata/shared/schemas';
import { describe, expect, it } from 'vitest';
import { canSendQuestion, streamErrorMessage } from '../../src/assistant/use-assistant-chat.ts';

describe('chat stream errors', () => {
  it('preserves quota, expired session and fallback messages', () => {
    expect(streamErrorMessage('QUOTA_EXCEEDED')).toBe(messageForStatus(429));
    expect(streamErrorMessage('UNAUTHORIZED')).toBe(messageForStatus(401));
    expect(streamErrorMessage('INTERNAL')).toBe(messageForStatus(500));
  });
});

describe('question submission', () => {
  it.each([
    [false, false, false, true],
    [true, false, false, false],
    [false, true, false, false],
    [false, false, true, false],
    [true, true, false, false],
    [true, false, true, false],
    [false, true, true, false],
    [true, true, true, false],
  ])(
    'busy=%s recording=%s transcribing=%s allows sending=%s',
    (busy, recording, transcribing, allowed) => {
      expect(canSendQuestion(busy, recording, transcribing)).toBe(allowed);
    },
  );
});
