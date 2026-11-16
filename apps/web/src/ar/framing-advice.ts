import { fullBodyInFrame } from './game-flow.ts';
import type { Landmark } from './overlay-math.ts';

export interface FramingAdvice {
  ok: boolean;
  issue: 'sin-cuerpo' | 'cabeza' | 'pies' | 'cerca' | 'lejos' | 'izquierda' | 'derecha' | null;
  message: string;
}

function visible(point: Landmark | undefined): point is Landmark {
  return !!point && (point.visibility ?? 0) >= 0.5;
}

function advice(issue: FramingAdvice['issue'], message: string): FramingAdvice {
  return { ok: issue === null, issue, message };
}

export function framingAdvice(landmarks: readonly Landmark[] | null): FramingAdvice {
  const torso = [11, 12, 23, 24].map((i) => landmarks?.[i]);
  if (!landmarks || !torso.every(visible)) {
    return advice('sin-cuerpo', 'Colócate frente a la cámara con hombros y caderas visibles');
  }
  const nose = landmarks[0];
  const headVisible = visible(nose) && nose.y > 0.02 && nose.y < 0.98;
  const feetVisible = [27, 28].every((index) => {
    const ankle = landmarks[index];
    const heel = landmarks[index + 2];
    return [ankle, heel].some((point) => visible(point) && point.y > 0.02 && point.y < 0.98);
  });
  if (!feetVisible) return advice('pies', 'Aléjate un paso: no se ven tus pies');
  if (!headVisible) return advice('cabeza', 'Incluye la cabeza en el cuadro');

  const feet = [27, 28].map((index) => {
    const ankle = landmarks[index];
    return visible(ankle) ? ankle : landmarks[index + 2];
  });
  const height = ((feet[0]?.y ?? 0) + (feet[1]?.y ?? 0)) / 2 - nose.y;
  if (height > 0.92) return advice('cerca', 'Aléjate un poco de la cámara');
  if (height < 0.45) return advice('lejos', 'Acércate un poco a la cámara');

  const centerX = torso.reduce((sum, point) => sum + point.x, 0) / torso.length;
  // Raw x < 0.3 appears on the right of the mirrored screen. Moving to the user's
  // own left increases raw x (and moves left on the mirror), toward the center.
  if (centerX < 0.3) {
    return advice('izquierda', 'Muévete hacia tu izquierda para quedar en el centro');
  }
  if (centerX > 0.7) {
    return advice('derecha', 'Muévete hacia tu derecha para quedar en el centro');
  }
  // Heels can explain framing, but the game also requires both ankles and knees.
  // Never declare readiness while its stricter joint/margin check still fails.
  if (!fullBodyInFrame(landmarks)) {
    if (![25, 26, 27, 28].every((i) => visible(landmarks[i]))) {
      return advice('pies', 'Incluye las piernas y los tobillos en el cuadro');
    }
    return advice('cerca', 'Aléjate un paso y deja todo el cuerpo dentro del cuadro');
  }
  return advice(null, 'Perfecto, quédate ahí');
}
