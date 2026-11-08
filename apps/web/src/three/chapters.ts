import { CHAPTER_SECONDS } from './procedure.ts';

/** One WebVTT chapter cue: a step's segment of the procedure film, in seconds. */
export interface Chapter {
  id: string;
  start: number;
  end: number;
  title: string;
}

const TIMING = /^((?:\d+:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d+:)?\d{2}:\d{2}\.\d{3})/;

function toSeconds(stamp: string): number {
  return stamp
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}

/**
 * Parses a WebVTT chapters file. The chapters must start at 0 and be contiguous, because the page
 * maps every instant of the film to exactly one step.
 */
export function parseChapters(vtt: string): Chapter[] {
  const blocks = vtt
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/);
  if (!blocks[0]?.startsWith('WEBVTT')) throw new Error('Chapters file must start with WEBVTT');
  const chapters = blocks.slice(1).map((block, i) => {
    const lines = block.split('\n');
    const timingLine = lines.findIndex((line) => TIMING.test(line));
    const match = TIMING.exec(lines[timingLine] ?? '');
    if (!match) throw new Error(`Chapter ${i + 1} has no timing line`);
    const title = lines
      .slice(timingLine + 1)
      .join(' ')
      .trim();
    if (!title) throw new Error(`Chapter ${i + 1} has no title`);
    return {
      id: timingLine > 0 ? lines[0]!.trim() : String(i + 1),
      start: toSeconds(match[1]!),
      end: toSeconds(match[2]!),
      title,
    };
  });
  if (chapters.length === 0) throw new Error('Chapters file has no cues');
  chapters.forEach((chapter, i) => {
    const expectedStart = i === 0 ? 0 : chapters[i - 1]!.end;
    if (chapter.start !== expectedStart || chapter.end <= chapter.start)
      throw new Error(`Chapter "${chapter.id}" must start at ${expectedStart}s and end after it`);
  });
  return chapters;
}

/** Index of the chapter playing at `seconds`; past the end it stays on the last one. */
export function chapterAt(chapters: Chapter[], seconds: number): number {
  const next = chapters.findIndex((chapter) => chapter.start > seconds);
  return next < 0 ? chapters.length - 1 : Math.max(0, next - 1);
}

/** Film time → time of the interactive model, which gives every step CHAPTER_SECONDS. */
export function toModelTime(chapters: Chapter[], seconds: number): number {
  const i = chapterAt(chapters, seconds);
  const { start, end } = chapters[i]!;
  return (i + Math.min(1, (seconds - start) / (end - start))) * CHAPTER_SECONDS;
}

/** Inverse of toModelTime. */
export function toFilmTime(chapters: Chapter[], seconds: number): number {
  const i = Math.min(Math.floor(seconds / CHAPTER_SECONDS), chapters.length - 1);
  const { start, end } = chapters[i]!;
  return start + (seconds / CHAPTER_SECONDS - i) * (end - start);
}
