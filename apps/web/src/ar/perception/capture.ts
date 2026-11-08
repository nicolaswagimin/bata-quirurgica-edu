// Grabador de capturas del AR v2. Solo guarda features en memoria y arma una toma a la vez para
// que el panel la descargue como JSON. Nunca toca video, imágenes ni la red. La bandera solo puede
// activarse en desarrollo: `isCaptureEnabled` exige `dev` y `?captura=1`.
import { type CaptureTake, type FeatureFrame, PERCEPTION_VERSION } from '@bata/shared/perception';

/** ~15 Hz: suficiente para features temporales y ligero para descargar a mano. */
export const CAPTURE_SAMPLE_MS = 66;
export const CAPTURE_WINDOW_MS = 2000;
export const MIN_TAKE_FRAMES = 8;
export const MAX_TAKE_FRAMES = 90;

/** La captura existe solo en desarrollo y solo con `?captura=1`. */
export function isCaptureEnabled(env: { dev: boolean; search: string }): boolean {
  if (!env.dev) return false;
  return new URLSearchParams(env.search).get('captura') === '1';
}

export class CaptureRecorder {
  private label: string | null = null;
  private startedAt = 0;
  private lastPushAt = Number.NEGATIVE_INFINITY;
  private frames: FeatureFrame[] = [];

  start(label: string, now: number): void {
    const clean = label.trim();
    if (!clean) throw new Error('La etiqueta del paso es obligatoria');
    this.label = clean;
    this.startedAt = now;
    this.lastPushAt = Number.NEGATIVE_INFINITY;
    this.frames = [];
  }

  isRecording(): boolean {
    return this.label !== null;
  }

  /** Milisegundos desde el inicio de la toma; 0 si no se está grabando. */
  elapsed(now: number): number {
    return this.label === null ? 0 : Math.max(0, now - this.startedAt);
  }

  /** Guarda el frame si toca muestrear; devuelve si lo guardó. */
  push(frame: FeatureFrame, now: number): boolean {
    if (this.label === null) return false;
    if (this.frames.length >= MAX_TAKE_FRAMES) return false;
    if (now - this.lastPushAt < CAPTURE_SAMPLE_MS) return false;
    this.lastPushAt = now;
    this.frames.push(frame);
    return true;
  }

  /** Cierra la toma. Devuelve null si no había grabación o si quedó demasiado corta. */
  stop(now: number): CaptureTake | null {
    if (this.label === null) return null;
    const label = this.label;
    const startedAt = this.startedAt;
    const frames = this.frames;
    this.clear();
    if (frames.length < MIN_TAKE_FRAMES) return null;
    return {
      version: PERCEPTION_VERSION,
      label,
      source: 'ar-espejo',
      capturedAt: new Date().toISOString(),
      durationMs: Math.max(0, now - startedAt),
      sampleHz: Math.round(1000 / CAPTURE_SAMPLE_MS),
      frames,
    };
  }

  /** Borra la grabación en curso y los frames guardados. */
  clear(): void {
    this.label = null;
    this.startedAt = 0;
    this.lastPushAt = Number.NEGATIVE_INFINITY;
    this.frames = [];
  }

  get frameCount(): number {
    return this.frames.length;
  }
}
