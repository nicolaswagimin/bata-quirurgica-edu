// Local model of the camera: exposure, sharpness, pose confidence and tracking noise. Every frame
// is downscaled in the browser to 64×48 and only aggregate numbers are kept; nothing is uploaded.
// Pure on purpose (no DOM, no MediaPipe): unit-tested in node.
import type { FrameSize, Landmark } from './overlay-math.ts';

export type QualityIssue = 'sin-luz' | 'contraluz' | 'movido' | 'encuadre' | 'pose' | 'lento';

export type FrameSample = {
  /** Mean luminance, 0..1. */
  luma: number;
  /** Share of pixels that are almost black. */
  dark: number;
  /** Share of pixels that are almost white. */
  bright: number;
  /** Mean absolute difference between horizontal neighbours, 0..1. */
  detail: number;
};

export const SAMPLE_WIDTH = 64;
export const SAMPLE_HEIGHT = 48;

// Thresholds tuned for a dim room and a mid-range phone: dark wins over every other hint.
export const VERY_LOW_LUMA = 0.16;
export const LOW_LUMA = 0.28;
export const HIGH_BRIGHT_SHARE = 0.35;
export const LOW_DETAIL = 0.03;
export const LOW_CONFIDENCE = 0.6;
export const MIN_COVERAGE = 0.55;
/** Jerk per frame, in shoulder widths; intentional movement is smooth and stays well below. */
export const HIGH_JITTER = 0.02;
export const LOW_FPS = 12;

export const QUALITY_HINTS: Record<QualityIssue, string> = {
  'sin-luz': 'Hay poca luz: enciende una lámpara y ponla de frente.',
  contraluz: 'Estás a contraluz: gírate hacia la luz o cierra la ventana de atrás.',
  movido: 'Se ve movido: apoya el celular y evita moverte.',
  encuadre: 'Ajusta el encuadre: aléjate hasta que se vean tus hombros y caderas.',
  pose: 'Colócate de frente, con hombros y caderas visibles.',
  lento: 'El dispositivo va lento: prueba el modo 3D.',
};

/** Landmarks that must be visible to place the gown and read the posture. */
export const BODY_LANDMARKS = [11, 12, 13, 14, 15, 16, 23, 24] as const;

const DARK_PIXEL = 40 / 255;
const BRIGHT_PIXEL = 225 / 255;

/** Exposure and detail of an RGBA frame already downscaled to SAMPLE_WIDTH × SAMPLE_HEIGHT. */
export function sampleFrame(
  pixels: Uint8ClampedArray,
  width = SAMPLE_WIDTH,
  height = SAMPLE_HEIGHT,
): FrameSample {
  const count = width * height;
  if (count <= 0) return { luma: 0, dark: 0, bright: 0, detail: 0 };
  let sum = 0;
  let dark = 0;
  let bright = 0;
  let detail = 0;
  let pairs = 0;
  for (let y = 0; y < height; y++) {
    let previous = -1;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luma =
        (0.2126 * (pixels[i] ?? 0) +
          0.7152 * (pixels[i + 1] ?? 0) +
          0.0722 * (pixels[i + 2] ?? 0)) /
        255;
      sum += luma;
      if (luma < DARK_PIXEL) dark++;
      if (luma > BRIGHT_PIXEL) bright++;
      if (previous >= 0) {
        detail += Math.abs(luma - previous);
        pairs++;
      }
      previous = luma;
    }
  }
  return {
    luma: sum / count,
    dark: dark / count,
    bright: bright / count,
    detail: pairs > 0 ? detail / pairs : 0,
  };
}

export type TrackSample = {
  /** Mean visibility of the body landmarks, 0..1. */
  confidence: number;
  /** High-frequency noise (second difference) in shoulder widths, smoothed. */
  jitter: number;
  /** Share of the frame the body covers, from the nose to the ankles when visible. */
  coverage: number;
  hasBody: boolean;
};

function visible(landmark: Landmark | undefined): landmark is Landmark {
  return !!landmark && (landmark.visibility ?? 0) >= 0.5;
}

/** Body height in frame units: nose→ankles when they are visible, else shoulders→hips ×2.4. */
function coverageOf(landmarks: readonly Landmark[]): number {
  const nose = landmarks[0];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  if (visible(nose) && visible(leftAnkle) && visible(rightAnkle)) {
    return Math.min(1, Math.abs((leftAnkle.y + rightAnkle.y) / 2 - nose.y));
  }
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  if (visible(leftHip) && visible(rightHip) && visible(leftShoulder) && visible(rightShoulder)) {
    const hipY = (leftHip.y + rightHip.y) / 2;
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    return Math.min(1, Math.abs(hipY - shoulderY) * 2.4);
  }
  return 0;
}

/**
 * Tracks how trustworthy the pose is. Jitter is the second difference of the raw landmarks, so it
 * measures noise and not intentional movement (which is smooth and has no acceleration).
 */
export class TrackQuality {
  private previous: readonly Landmark[] | null = null;
  private beforePrevious: readonly Landmark[] | null = null;
  private jitter = 0;

  constructor(private readonly smoothing = 0.25) {}

  reset(): void {
    this.previous = null;
    this.beforePrevious = null;
    this.jitter = 0;
  }

  update(landmarks: readonly Landmark[], size: FrameSize, hasBody: boolean): TrackSample {
    const confidence =
      BODY_LANDMARKS.reduce((sum, i) => sum + (landmarks[i]?.visibility ?? 0), 0) /
      BODY_LANDMARKS.length;

    const left = landmarks[11];
    const right = landmarks[12];
    const shoulderPx =
      left && right
        ? Math.hypot((left.x - right.x) * size.width, (left.y - right.y) * size.height)
        : 0;

    let jerk = 0;
    let samples = 0;
    if (shoulderPx > 1 && this.previous && this.beforePrevious) {
      for (const i of BODY_LANDMARKS) {
        const now = landmarks[i];
        const prev = this.previous[i];
        const before = this.beforePrevious[i];
        if (!now || !prev || !before) continue;
        const dx = now.x - 2 * prev.x + before.x;
        const dy = now.y - 2 * prev.y + before.y;
        jerk += (Math.hypot(dx * size.width, dy * size.height) / shoulderPx) as number;
        samples++;
      }
    }
    if (samples > 0) {
      this.jitter = this.jitter * (1 - this.smoothing) + (jerk / samples) * this.smoothing;
    }
    this.beforePrevious = this.previous;
    this.previous = landmarks;

    return {
      confidence,
      jitter: this.jitter,
      coverage: coverageOf(landmarks),
      hasBody,
    };
  }
}

export type QualityReport = {
  /** 0..100, only to compare situations and show a status. */
  score: number;
  issues: QualityIssue[];
  /** The issue that matters most, or null when the camera is fine. */
  primary: QualityIssue | null;
  /** The one thing to fix now, or null when the camera is fine. */
  hint: string | null;
  /** Recommended landmark-smoothing alpha: lower means steadier. */
  smoothing: number;
  /** True when the renderer should keep the last body instead of dropping it. */
  hold: boolean;
};

const PRIORITY: readonly QualityIssue[] = [
  'sin-luz',
  'pose',
  'encuadre',
  'movido',
  'contraluz',
  'lento',
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Diagnoses the camera from the latest frame and track sample, and recommends how to adapt the
 * mirror: steadier smoothing under noise, and a held body while the pose is briefly lost.
 */
export function assessQuality(input: {
  frame: FrameSample | null;
  track: TrackSample;
  fps: number;
  drawMs?: number;
}): QualityReport {
  const { frame, track, fps } = input;
  const issues: QualityIssue[] = [];
  let score = 100;

  if (!track.hasBody) {
    issues.push('pose');
    score -= 40;
  } else {
    if (track.confidence < LOW_CONFIDENCE) {
      issues.push('pose');
      score -= 25;
    }
    if (track.coverage < MIN_COVERAGE) {
      issues.push('encuadre');
      score -= 15;
    }
    if (track.jitter > HIGH_JITTER) {
      issues.push('movido');
      score -= 20;
    }
  }

  if (frame) {
    if (frame.luma < VERY_LOW_LUMA) {
      issues.push('sin-luz');
      score -= 45;
    } else if (frame.luma < LOW_LUMA) {
      issues.push('sin-luz');
      score -= 30;
    } else if (frame.bright > HIGH_BRIGHT_SHARE && frame.luma < 0.55) {
      issues.push('contraluz');
      score -= 20;
    }
    // A person fills the frame with edges; if there are none, either it is blurred or unrecognised.
    if (track.hasBody && frame.detail < LOW_DETAIL && !issues.includes('movido')) {
      issues.push('movido');
      score -= 10;
    }
  }

  if (fps > 0 && fps < LOW_FPS) {
    issues.push('lento');
    score -= 20;
  }

  const first = PRIORITY.find((issue) => issues.includes(issue)) ?? null;
  const smoothing = track.hasBody
    ? clamp(0.5 - track.jitter * 4 - (1 - track.confidence) * 0.2, 0.2, 0.6)
    : 0.45;

  return {
    score: Math.max(0, Math.round(score)),
    issues,
    primary: first,
    hint: first ? QUALITY_HINTS[first] : null,
    smoothing,
    hold: !track.hasBody || track.confidence < 0.4,
  };
}
