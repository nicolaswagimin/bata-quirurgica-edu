import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LESSONS_FILE } from '../../src/lib/lessons.ts';
import { VIDEOS } from '../../src/lib/videos.ts';

const dir = join(import.meta.dirname, '../../public/videos');
const MAX_STEP_BYTES = 3 * 1024 * 1024;

describe('teaching videos', () => {
  it('every lesson video is in the catalogue', () => {
    for (const lesson of LESSONS_FILE.lessons) {
      for (const id of lesson.videoIds) expect(VIDEOS[id], id).toBeDefined();
    }
  });

  it.each(Object.keys(VIDEOS))('%s ships MP4, WebM, Spanish captions and a poster', (id) => {
    for (const file of [`${id}.mp4`, `${id}.webm`, `${id}.vtt`, `${id}-portada.png`]) {
      expect(existsSync(join(dir, file)), file).toBe(true);
    }
    const vtt = readFileSync(join(dir, `${id}.vtt`), 'utf8');
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3} --> /);
  });

  it.each(Object.keys(VIDEOS).filter((id) => id.startsWith('paso-')))(
    '%s stays under 3 MB per format',
    (id) => {
      for (const ext of ['mp4', 'webm']) {
        expect(statSync(join(dir, `${id}.${ext}`)).size).toBeLessThanOrEqual(MAX_STEP_BYTES);
      }
    },
  );
});
