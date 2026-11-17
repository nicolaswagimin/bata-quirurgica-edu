import { messageForStatus } from '@bata/shared/schemas';
import { describe, expect, it } from 'vitest';
import { streamErrorMessage } from '../../src/assistant/use-assistant-chat.ts';

describe('chat stream errors', () => {
  it('preserves quota, expired session and fallback messages', () => {
    expect(streamErrorMessage('QUOTA_EXCEEDED')).toBe(messageForStatus(429));
    expect(streamErrorMessage('UNAUTHORIZED')).toBe(messageForStatus(401));
    expect(streamErrorMessage('INTERNAL')).toBe(messageForStatus(500));
  });
});
