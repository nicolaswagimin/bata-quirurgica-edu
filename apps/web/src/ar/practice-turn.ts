// Detector del giro para cerrar la solapa (paso `turn`). Mide la razón ancho de hombros / alto de
// torso: de frente y de espalda es ancha; de perfil se estrecha. Para distinguir el frente de la
// espalda usa la cara: de espalda la nariz deja de verse.
//
// - Cuarto de vuelta: frente → perfil → frente.
// - 360°: frente → perfil → espalda (cara oculta) → perfil → frente. Dos cuartos de vuelta con
//   regreso al frente no cuentan, porque nunca pasan por la espalda.
//
// Cada fase debe sostenerse DWELL_MS para que un frame con ruido no cuente como perfil. Es una
// heurística 2D: queda por medir en dispositivo con distintas personas y luces.

export type TurnMode = 'cuarto' | '360';

/** De perfil: los hombros miden como mucho este múltiplo del ancho de frente. */
export const SIDE_RATIO = 0.65;
/** De frente (o de espalda): los hombros recuperan al menos este múltiplo. */
export const FRONT_RATIO = 0.85;
/** Tiempo mínimo en una fase para darla por vista. */
export const DWELL_MS = 250;

type Phase = 'front' | 'side' | 'back';

export interface TurnTracker {
  baseline: number | null;
  /** Fases confirmadas, en orden, desde la referencia de frente. */
  path: Phase[];
  /** Fase candidata y desde cuándo se observa. */
  candidate: Phase | null;
  since: number;
}

export interface TurnSample {
  ratio: number;
  /** La nariz se ve: de frente o de perfil, no de espalda. */
  faceVisible: boolean;
  /** Postura de partida válida (manos frente al pecho); sin ella no se toma la referencia. */
  frontal: boolean;
  now: number;
}

export function newTurnTracker(): TurnTracker {
  return { baseline: null, path: [], candidate: null, since: 0 };
}

const TARGET: Record<TurnMode, readonly Phase[]> = {
  cuarto: ['front', 'side', 'front'],
  '360': ['front', 'side', 'back', 'side', 'front'],
};

function classify(t: TurnTracker, s: TurnSample): Phase | null {
  const baseline = t.baseline as number;
  if (s.ratio <= baseline * SIDE_RATIO) return 'side';
  if (s.ratio >= baseline * FRONT_RATIO) return s.faceVisible ? 'front' : 'back';
  return null; // zona intermedia: no cambia nada
}

/** True si el giro ya pasó por todas las fases que pide el modo. */
export function turnComplete(t: TurnTracker, mode: TurnMode): boolean {
  const target = TARGET[mode];
  return t.path.length === target.length && target.every((phase, i) => t.path[i] === phase);
}

/**
 * Avanza el detector con un frame. Devuelve `true` solo mientras el giro está completo y el cuerpo
 * sigue de frente en este frame (ancho de hombros recuperado y cara visible).
 */
export function stepTurn(t: TurnTracker, s: TurnSample, mode: TurnMode): boolean {
  if (t.baseline === null) {
    if (!s.frontal || !s.faceVisible) return false;
    t.baseline = s.ratio;
    t.path = ['front'];
    return false;
  }
  const phase = classify(t, s);
  if (phase !== t.candidate) {
    t.candidate = phase;
    t.since = s.now;
  }
  const last = t.path.at(-1);
  if (phase && phase !== last && s.now - t.since >= DWELL_MS) {
    const target = TARGET[mode];
    // Solo se acepta la fase que sigue en el recorrido; volver atrás reinicia desde el frente.
    if (target[t.path.length] === phase) t.path.push(phase);
    else if (phase === 'front') t.path = ['front'];
  }
  return phase === 'front' && turnComplete(t, mode);
}
