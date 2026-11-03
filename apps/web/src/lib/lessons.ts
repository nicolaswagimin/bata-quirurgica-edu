// "Aprende" content, validated once at import. Lessons follow the missions' order (checked in
// packages/shared/test/schemas.test.ts), so a lesson's position gives its mission code.
import {
  BataPasosSchema,
  type Lesson,
  LessonsFileSchema,
  type SourceRef,
} from '@bata/shared/schemas';
import lessonsJson from '../../../../content/lecciones/lecciones.json';
import pasosJson from '../../../../content/protocolos/bata-pasos.json';

export const LESSONS_FILE = LessonsFileSchema.parse(lessonsJson);
export const DONNING_STEPS = BataPasosSchema.parse(pasosJson).donning;

export function lessonFor(missionId: string): { lesson: Lesson; order: number } | null {
  const index = LESSONS_FILE.lessons.findIndex((l) => l.missionId === missionId);
  const lesson = LESSONS_FILE.lessons[index];
  return lesson ? { lesson, order: index + 1 } : null;
}

export interface NumberedSource {
  n: number;
  id: string;
  ref: SourceRef;
}

/** The sources a set of statements cites, numbered in order of first appearance. */
export function numberSources(sourceIdLists: readonly (readonly string[])[]): NumberedSource[] {
  const out: NumberedSource[] = [];
  for (const ids of sourceIdLists) {
    for (const id of ids) {
      const ref = LESSONS_FILE.sources[id];
      if (ref && !out.some((s) => s.id === id)) out.push({ n: out.length + 1, id, ref });
    }
  }
  return out;
}

export function citation(ref: SourceRef): string {
  return `${ref.org} (${ref.year}). ${ref.title}. ${ref.section}.`;
}
