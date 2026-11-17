import { afterEach, describe, expect, it, vi } from 'vitest';
import { speak } from '../../src/assistant/voice.ts';

afterEach(() => vi.unstubAllGlobals());

describe('speech lifecycle', () => {
  function setup() {
    const utterances: SpeechSynthesisUtterance[] = [];
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(public text: string) {}
      },
    );
    const synth = {
      getVoices: () => [{ lang: 'es-CO' }],
      cancel: vi.fn(),
      speak: (utterance: SpeechSynthesisUtterance) => utterances.push(utterance),
    };
    vi.stubGlobal('window', { speechSynthesis: synth });
    return { utterances, synth };
  }

  it.each(['onend', 'onerror'] as const)(
    'resolves on %s and forwards start/boundary',
    async (event) => {
      const { utterances } = setup();
      const onStart = vi.fn();
      const onEnd = vi.fn();
      const onBoundary = vi.fn();
      const resolved = vi.fn();
      const promise = speak('Hola', { onStart, onEnd, onBoundary }).then(resolved);
      await Promise.resolve();
      const utterance = utterances[0];
      if (!utterance) throw new Error('Missing utterance');
      expect(utterance.lang).toBe('es-CO');
      expect(onStart).not.toHaveBeenCalled();
      expect(resolved).not.toHaveBeenCalled();
      const boundary = { charIndex: 2 } as SpeechSynthesisEvent;
      utterance.onstart?.call(utterance, boundary);
      utterance.onboundary?.call(utterance, boundary);
      expect(onStart).toHaveBeenCalledOnce();
      expect(onBoundary).toHaveBeenCalledWith(boundary);
      // Both browser completion paths must settle the promise.
      if (event === 'onend') utterance.onend?.call(utterance, boundary);
      else utterance.onerror?.call(utterance, {} as SpeechSynthesisErrorEvent);
      await promise;
      expect(onEnd).toHaveBeenCalledOnce();
      expect(resolved).toHaveBeenCalledOnce();
    },
  );

  it('does not speak when cancelled while loading voices', async () => {
    const { utterances } = setup();
    const controller = new AbortController();
    const promise = speak('Hola', { signal: controller.signal });
    controller.abort();
    await promise;
    expect(utterances).toEqual([]);
  });
});
