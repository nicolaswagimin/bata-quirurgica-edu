import { BataPasosSchema } from '@bata/shared/schemas';
import { describe, expect, it } from 'vitest';
import pasosJson from '../../../../content/protocolos/bata-pasos.json';
import { chapterAt, parseChapters, toFilmTime, toModelTime } from '../../src/three/chapters.ts';
import chaptersVtt from '../../src/three/procedimiento-ppe-capitulos.vtt?raw';
import { CHAPTER_SECONDS } from '../../src/three/procedure.ts';
import { buildTimeline } from '../../src/three/steps.ts';

const pasos = BataPasosSchema.parse(pasosJson);
const chapters = parseChapters(chaptersVtt);

describe('procedure chapters file', () => {
  it('has one chapter per step, donning then doffing, with the step titles', () => {
    const steps = [...buildTimeline(pasos, 'donning'), ...buildTimeline(pasos, 'doffing')];
    expect(chapters.map((c) => c.title)).toEqual(steps.map((s) => s.title));
  });

  it('covers the 78 s film, giving closed gloving 24 s', () => {
    expect(chapters.map((c) => c.start)).toEqual([0, 6, 12, 18, 24, 48, 54, 60, 66, 72]);
    expect(chapters.at(-1)?.end).toBe(78);
  });
});

describe('parseChapters', () => {
  it('reads ids, hour-less stamps, CRLF and multi-line titles', () => {
    const vtt =
      'WEBVTT\r\n\r\na\r\n00:00.000 --> 00:01:05.500\r\nPrimera\r\nlínea\r\n\r\n00:01:05.500 --> 01:00:00.000\r\nSegunda';
    expect(parseChapters(vtt)).toEqual([
      { id: 'a', start: 0, end: 65.5, title: 'Primera línea' },
      { id: '2', start: 65.5, end: 3600, title: 'Segunda' },
    ]);
  });

  it('rejects files that are not contiguous from zero or are malformed', () => {
    expect(() => parseChapters('00:00.000 --> 00:01.000\nA')).toThrow(/WEBVTT/);
    expect(() => parseChapters('WEBVTT')).toThrow(/no cues/);
    expect(() => parseChapters('WEBVTT\n\n00:01.000 --> 00:02.000\nA')).toThrow(/start at 0s/);
    expect(() =>
      parseChapters('WEBVTT\n\n00:00.000 --> 00:02.000\nA\n\n00:03.000 --> 00:04.000\nB'),
    ).toThrow(/start at 2s/);
    expect(() => parseChapters('WEBVTT\n\n00:00.000 --> 00:02.000')).toThrow(/no title/);
    expect(() => parseChapters('WEBVTT\n\nsin tiempos\nA')).toThrow(/no timing/);
  });
});

describe('chapter time mapping', () => {
  it('finds the chapter at a film instant and clamps past the end', () => {
    expect(chapterAt(chapters, 0)).toBe(0);
    expect(chapterAt(chapters, 12)).toBe(2);
    expect(chapterAt(chapters, 47.9)).toBe(4);
    expect(chapterAt(chapters, 500)).toBe(chapters.length - 1);
  });

  it('maps film time to model time and back', () => {
    expect(toModelTime(chapters, 36)).toBe(4.5 * CHAPTER_SECONDS);
    expect(toModelTime(chapters, 78)).toBe(chapters.length * CHAPTER_SECONDS);
    for (const seconds of [0, 7.5, 30, 50, 77]) {
      expect(toFilmTime(chapters, toModelTime(chapters, seconds))).toBeCloseTo(seconds);
    }
  });
});
