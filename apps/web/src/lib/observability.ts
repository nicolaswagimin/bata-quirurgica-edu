import { datadogLogs } from '@datadog/browser-logs';
import { datadogRum } from '@datadog/browser-rum';

export type ObservabilityEnv = {
  VITE_DD_CLIENT_TOKEN?: string;
  VITE_DD_APPLICATION_ID?: string;
  VITE_DD_SITE?: string;
  VITE_DD_ENV?: string;
  VITE_APP_VERSION?: string;
  [key: string]: unknown;
};

export type RumConfig = {
  applicationId: string;
  clientToken: string;
  site: string;
  service: 'bata-web';
  env: string;
  version: string;
  sessionSampleRate: number;
  sessionReplaySampleRate: number;
  trackUserInteractions: boolean;
  defaultPrivacyLevel: 'mask';
};

type RumApi = {
  init(config: RumConfig): void;
  addAction(name: string, context?: Record<string, unknown>): void;
};
type LogsApi = {
  init(config: {
    clientToken: string;
    site: string;
    service: string;
    env: string;
    version: string;
    forwardErrorsToLogs: boolean;
    sessionSampleRate: number;
  }): void;
};

// Sin token de cliente, RUM queda desactivado (desarrollo local y pruebas).
export function buildRumConfig(env: ObservabilityEnv): RumConfig | null {
  const clientToken = env.VITE_DD_CLIENT_TOKEN?.trim() ?? '';
  if (!clientToken) return null;
  return {
    applicationId: env.VITE_DD_APPLICATION_ID ?? '',
    clientToken,
    site: env.VITE_DD_SITE || 'datadoghq.com',
    service: 'bata-web',
    env: env.VITE_DD_ENV || 'dev',
    version: env.VITE_APP_VERSION || '0.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 0,
    trackUserInteractions: true,
    defaultPrivacyLevel: 'mask',
  };
}

// Latencia envío → primer token visible, emitida por el panel del asistente.
export function listenAssistantLatency(target: EventTarget, rum: Pick<RumApi, 'addAction'>) {
  const onFirstToken = (event: Event) => {
    const elapsedMs = (event as CustomEvent<{ elapsedMs?: unknown }>).detail?.elapsedMs;
    if (typeof elapsedMs === 'number' && Number.isFinite(elapsedMs)) {
      rum.addAction('assistant_e2e_ms', { ms: elapsedMs });
    }
  };
  target.addEventListener('bata:assistant-first-token', onFirstToken);
  return () => target.removeEventListener('bata:assistant-first-token', onFirstToken);
}

export function initObservability(
  env: ObservabilityEnv,
  rum: RumApi = datadogRum,
  logs: LogsApi = datadogLogs,
): boolean {
  const config = buildRumConfig(env);
  if (!config) return false;
  rum.init(config);
  logs.init({
    clientToken: config.clientToken,
    site: config.site,
    service: config.service,
    env: config.env,
    version: config.version,
    forwardErrorsToLogs: true,
    sessionSampleRate: 100,
  });
  if (typeof window !== 'undefined') listenAssistantLatency(window, rum);
  return true;
}
