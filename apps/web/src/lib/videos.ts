// Teaching videos rendered by tools/bata-3d/render_videos.py into public/videos/<id>.{mp4,webm,vtt}
// plus <id>-portada.png. Titles come from the donning steps, so they never drift from the 3D mode.
import { DONNING_STEPS } from './lessons.ts';

export interface VideoInfo {
  id: string;
  title: string;
  seconds: number;
}

const STEP_SECONDS = 20;

export const VIDEOS: Record<string, VideoInfo> = Object.fromEntries([
  ...DONNING_STEPS.map((s) => [
    `paso-${s.order}`,
    { id: `paso-${s.order}`, title: `Paso ${s.order}: ${s.title}`, seconds: STEP_SECONDS },
  ]),
  ['zona-esteril', { id: 'zona-esteril', title: 'La zona estéril de la bata', seconds: 18 }],
  ['resumen', { id: 'resumen', title: 'Resumen: colocación de bata y guantes', seconds: 90 }],
]);

export const videoUrl = (id: string, ext: 'mp4' | 'webm' | 'vtt') => `/videos/${id}.${ext}`;
export const posterUrl = (id: string) => `/videos/${id}-portada.png`;

export function duration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}
