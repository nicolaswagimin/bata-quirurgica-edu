import { describe, expect, it, vi } from 'vitest';
import {
  buildRumConfig,
  initObservability,
  listenAssistantLatency,
} from '../../src/lib/observability.ts';

const env = {
  VITE_DD_CLIENT_TOKEN: 'pub123',
  VITE_DD_APPLICATION_ID: 'app-1',
  VITE_DD_SITE: 'datadoghq.com',
  VITE_DD_ENV: 'test',
  VITE_APP_VERSION: '1.2.3',
};

describe('buildRumConfig', () => {
  it('returns null without a client token', () => {
    expect(buildRumConfig({ ...env, VITE_DD_CLIENT_TOKEN: '' })).toBeNull();
    expect(buildRumConfig({})).toBeNull();
  });

  it('builds the RUM config with a token', () => {
    expect(buildRumConfig(env)).toMatchObject({
      applicationId: 'app-1',
      clientToken: 'pub123',
      service: 'bata-web',
      env: 'test',
      version: '1.2.3',
      sessionReplaySampleRate: 0,
      trackUserInteractions: true,
      defaultPrivacyLevel: 'mask',
    });
  });
});

describe('listenAssistantLatency', () => {
  it('reports assistant_e2e_ms on the first-token event', () => {
    const target = new EventTarget();
    const rum = { addAction: vi.fn() };
    const stop = listenAssistantLatency(target, rum);
    target.dispatchEvent(
      new CustomEvent('bata:assistant-first-token', { detail: { elapsedMs: 840 } }),
    );
    expect(rum.addAction).toHaveBeenCalledWith('assistant_e2e_ms', { ms: 840 });
    stop();
    target.dispatchEvent(
      new CustomEvent('bata:assistant-first-token', { detail: { elapsedMs: 1 } }),
    );
    expect(rum.addAction).toHaveBeenCalledTimes(1);
  });
});

describe('initObservability', () => {
  it('skips init without a token and inits RUM and logs with one', () => {
    const rum = { init: vi.fn(), addAction: vi.fn() };
    const logs = { init: vi.fn() };
    expect(initObservability({}, rum, logs)).toBe(false);
    expect(rum.init).not.toHaveBeenCalled();
    expect(initObservability(env, rum, logs)).toBe(true);
    expect(rum.init).toHaveBeenCalledWith(expect.objectContaining({ service: 'bata-web' }));
    expect(logs.init).toHaveBeenCalledOnce();
  });
});
