// Posture rules for the donning steps (d1–d6 of content/protocolos/bata-pasos.json), reused by
// the AR game steps in game-steps.ts. Pure: no DOM.
import { type BodyFrame, dist, sideOffset, torsoDepth } from './posture.ts';

export interface StepCheck {
  ok: boolean;
  hint: string;
}

export interface StepRule {
  id: string;
  holdMs: number;
  check: (frame: BodyFrame, state: TurnState) => StepCheck;
}

/** Step 6 (wrap-around flap) needs a quarter turn and back; this remembers the turn. */
export interface TurnState {
  baselineRatio: number | null;
  turned: boolean;
}

const bothWrists = (f: BodyFrame) =>
  f.left.wrist && f.right.wrist ? ([f.left.wrist, f.right.wrist] as const) : null;

/** Chest band: below the shoulder line, above the waist, in front of the torso. */
export function inSterileBand(f: BodyFrame): boolean {
  const w = bothWrists(f);
  return (
    !!w &&
    w.every((p) => {
      const d = torsoDepth(f, p);
      return d >= 0.12 && d <= 0.66 && Math.abs(sideOffset(f, p)) <= 0.75;
    })
  );
}

const SEE_HANDS = 'Muestra las dos manos a la cámara.';

export const STEP_RULES: readonly StepRule[] = [
  {
    id: 'd1',
    holdMs: 1500,
    check: (f) => {
      if (!bothWrists(f)) return { ok: false, hint: SEE_HANDS };
      return inSterileBand(f)
        ? { ok: true, hint: 'Manos frente al pecho: sostén la posición mientras se secan.' }
        : { ok: false, hint: 'Sube las manos frente al pecho, por encima de la cintura.' };
    },
  },
  {
    id: 'd2',
    holdMs: 1500,
    check: (f) => {
      const w = bothWrists(f);
      if (!w) return { ok: false, hint: SEE_HANDS };
      const high = w.every((p) => {
        const d = torsoDepth(f, p);
        return d >= -0.2 && d <= 0.22;
      });
      return high
        ? {
            ok: true,
            hint: 'Así: toma la bata por dentro, a la altura del cuello y lejos del cuerpo.',
          }
        : { ok: false, hint: 'Lleva las dos manos a la altura de los hombros, frente a ti.' };
    },
  },
  {
    id: 'd3',
    holdMs: 1500,
    check: (f) => {
      const w = bothWrists(f);
      if (!w) return { ok: false, hint: SEE_HANDS };
      const elbows = [f.left.elbow, f.right.elbow];
      const elbowsUp = elbows.every((e) => e && torsoDepth(f, e) <= 0.4);
      const wristsHigh = w.every((p) => torsoDepth(f, p) <= 0.4);
      return elbowsUp && wristsHigh
        ? { ok: true, hint: 'Brazos extendidos al frente: deja las manos dentro de las mangas.' }
        : { ok: false, hint: 'Extiende los brazos al frente, a la altura de los hombros.' };
    },
  },
  {
    id: 'd4',
    holdMs: 3000,
    check: (f) => {
      if (!bothWrists(f)) return { ok: false, hint: SEE_HANDS };
      return inSterileBand(f)
        ? {
            ok: true,
            hint: 'Quédate quieto con las manos al frente: el circulante amarra los lazos.',
          }
        : { ok: false, hint: 'Deja las manos frente al pecho mientras te amarran por detrás.' };
    },
  },
  {
    id: 'd5',
    holdMs: 1500,
    check: (f) => {
      const w = bothWrists(f);
      if (!w) return { ok: false, hint: SEE_HANDS };
      const together = dist(w[0], w[1]) <= 0.45 * f.shoulderWidth;
      return together && inSterileBand(f)
        ? { ok: true, hint: 'Manos juntas dentro de los puños: así se calzan los guantes.' }
        : { ok: false, hint: 'Junta las manos frente al pecho, sin sacarlas de los puños.' };
    },
  },
  {
    id: 'd6',
    holdMs: 1200,
    check: (f, turn) => {
      const ratio = f.shoulderWidth / f.torsoHeight;
      if (turn.baselineRatio === null) {
        // Start facing the camera with the hands in place, so the baseline is a frontal stance.
        if (!inSterileBand(f)) {
          return { ok: false, hint: 'De frente a la cámara, con las manos frente al pecho.' };
        }
        turn.baselineRatio = ratio;
      }
      if (!turn.turned) {
        // During the turn one hand may hide behind the body; only the shoulders are measured.
        if (ratio <= turn.baselineRatio * 0.65) turn.turned = true;
        return { ok: false, hint: 'Gira un cuarto de vuelta para cerrar la solapa envolvente.' };
      }
      if (!inSterileBand(f)) {
        return { ok: false, hint: 'Vuelve de frente con las manos frente al pecho.' };
      }
      return ratio >= turn.baselineRatio * 0.85
        ? { ok: true, hint: 'Vuelve de frente: solapa cerrada.' }
        : { ok: false, hint: 'Ahora vuelve a quedar de frente a la cámara.' };
    },
  },
];
