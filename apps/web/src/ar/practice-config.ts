// Resuelve la secuencia de la práctica v3 a partir del contenido y de las opciones abiertas.
// `config` del contenido trae los valores propuestos; la URL los puede cambiar para QA
// (`?giro=360|cuarto`, `?mascarilla=1|0`, `?secado=1|0`).
import type { ArPracticeConfig, ArPracticeFile, ArPracticeStep } from '@bata/shared/schemas';
import type { TurnMode } from './practice-turn.ts';

const DEFAULT_CONFIG: ArPracticeConfig = { giro: 'cuarto', mascarilla: false, secado: true };

function flag(value: string | null, fallback: boolean): boolean {
  if (value === '1' || value === 'si') return true;
  if (value === '0' || value === 'no') return false;
  return fallback;
}

export function practiceConfig(file: ArPracticeFile, search: string): ArPracticeConfig {
  const base = file.config ?? DEFAULT_CONFIG;
  const params = new URLSearchParams(search);
  const giro = params.get('giro');
  return {
    giro: giro === '360' || giro === 'cuarto' ? giro : base.giro,
    mascarilla: flag(params.get('mascarilla'), base.mascarilla),
    secado: flag(params.get('secado'), base.secado),
  };
}

export interface ResolvedPractice {
  steps: ArPracticeStep[];
  turn: TurnMode;
  pending: boolean;
}

/** Filtra los pasos opcionales, renumera el orden y aplica el texto del giro elegido. */
export function resolvePractice(file: ArPracticeFile, config: ArPracticeConfig): ResolvedPractice {
  const steps = file.steps
    .filter((step) => !step.toggle || config[step.toggle])
    .map((step, i) => {
      const turnText = step.kind === 'turn' ? file.turnText?.[config.giro] : undefined;
      return { ...step, ...turnText, order: i + 1 };
    });
  const pending = file.status === 'pendiente-validacion' || !file.validatedBy;
  return { steps, turn: config.giro, pending };
}
