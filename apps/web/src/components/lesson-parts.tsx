import type { LessonMistake } from '@bata/shared/schemas';
import { MISTAKE_ART } from '../art/mistake-art.ts';
import { citation, LESSONS_FILE, type NumberedSource } from '../lib/lessons.ts';
import { MistakePair as IllustrationPair } from './mistake-pair.tsx';

/** The draft banner every "Aprende" page carries until the thesis director validates it. */
export function DraftNote({ className = '' }: { className?: string }) {
  return (
    <p
      role="note"
      className={`rounded-card bg-xp-soft px-4 py-3 text-sm text-ink print:border print:border-ink ${className}`}
    >
      <span className="font-pixel font-semibold">Borrador</span> pendiente de validación del
      director de tesis. Ante cualquier diferencia, manda el protocolo de tu institución.
    </p>
  );
}

/** Superscript links to the numbered sources at the end of the page. */
export function SourceMarks({
  ids,
  numbered,
}: {
  ids: readonly string[];
  numbered: NumberedSource[];
}) {
  const marks = ids
    .map((id) => numbered.find((s) => s.id === id))
    .filter((s): s is NumberedSource => !!s);
  return (
    <>
      {marks.map((s) => (
        <sup key={s.id} className="ml-0.5 font-mono text-xs font-bold">
          <a
            href={`#fuente-${s.n}`}
            aria-label={`Fuente ${s.n}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            [{s.n}]
          </a>
        </sup>
      ))}
    </>
  );
}

export function SourceList({ numbered }: { numbered: NumberedSource[] }) {
  return (
    <section aria-labelledby="fuentes" className="flex flex-col gap-2">
      <h2 id="fuentes" className="text-base font-extrabold">
        Fuentes
      </h2>
      <ol className="flex flex-col gap-1 text-sm text-muted">
        {numbered.map((s) => (
          <li key={s.id} id={`fuente-${s.n}`} className="flex gap-2">
            <span className="font-mono font-bold text-ink">[{s.n}]</span>
            <span>{citation(s.ref)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** One frequent mistake as a wrong / right pair of pixel illustrations. */
export function MistakePair({
  mistake,
  numbered,
}: {
  mistake: LessonMistake;
  numbered: NumberedSource[];
}) {
  const pair = MISTAKE_ART.find(({ id }) => id === mistake.id);
  return (
    <li className="flex flex-col gap-3 border-b border-border pb-6 last:border-b-0 last:pb-0">
      {pair ? <IllustrationPair pair={pair} /> : null}
      <div className="grid grid-cols-2 gap-2 text-sm text-ink">
        <p>
          <strong>Así no:</strong> {mistake.wrong}
        </p>
        <p>
          <strong>Así sí:</strong> {mistake.right}
        </p>
      </div>
      <p className="text-center text-xs text-muted">
        Respaldo
        <SourceMarks ids={mistake.sourceIds} numbered={numbered} />
      </p>
    </li>
  );
}

export const REVIEW_NOTE = LESSONS_FILE.reviewNote;
