import { Link } from '@tanstack/react-router';
import { missionSprite } from '../art/sprites.ts';
import { DraftNote, SourceList, SourceMarks } from '../components/lesson-parts.tsx';
import { MascotNote } from '../components/mascot.tsx';
import { missionCode } from '../components/mission-sheet.tsx';
import { Pictogram } from '../components/pictogram.tsx';
import { PixelSprite } from '../components/pixel-sprite.tsx';
import { pageTitle, textLink } from '../components/ui-classes.ts';
import { LESSONS_FILE, numberSources } from '../lib/lessons.ts';

/** /aprende: one short lesson per mission, the glossary and the printable donning checklist. */
export default function AprendePage() {
  const { lessons, glossary } = LESSONS_FILE;
  const numbered = numberSources(glossary.map((g) => g.sourceIds));

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className={pageTitle}>Aprende</h1>
        <MascotNote on="panel">
          Lecciones cortas, una por misión. Léelas antes de practicar o cuando falles una pregunta.
        </MascotNote>
        <DraftNote />
      </header>

      <section aria-labelledby="lecciones" className="flex flex-col gap-2">
        <h2 id="lecciones" className="text-xl font-extrabold tracking-tight">
          Lecciones
        </h2>
        <ol>
          {lessons.map((lesson, i) => (
            <li key={lesson.missionId} className="border-b border-border last:border-b-0">
              <Link
                to="/aprende/$missionId"
                params={{ missionId: lesson.missionId }}
                className="pressable -mx-2 grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-card px-2 py-3 hover:bg-surface"
              >
                <span className="tile-grid grid size-14 place-items-center rounded-card">
                  <PixelSprite sprite={missionSprite(lesson.iconKey)} className="size-9" />
                </span>
                <span className="min-w-0">
                  <span className="block leading-snug font-bold text-ink">{lesson.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    <span className="font-mono font-bold text-primary">{missionCode(i + 1)}</span> ·{' '}
                    {lesson.summary}
                  </span>
                </span>
                <Pictogram name="arrow" className="size-5 text-primary" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="lista" className="flex flex-col items-start gap-2">
        <h2 id="lista" className="text-xl font-extrabold tracking-tight">
          Lista de verificación
        </h2>
        <p className="max-w-[60ch] text-muted">
          Los pasos de colocación de la bata y los guantes en una hoja para imprimir o tener a mano.
        </p>
        <Link to="/aprende/lista" className={textLink}>
          Abrir la lista de verificación
        </Link>
      </section>

      <section aria-labelledby="glosario" className="flex flex-col gap-3">
        <h2 id="glosario" className="text-xl font-extrabold tracking-tight">
          Glosario
        </h2>
        <dl className="flex flex-col">
          {glossary.map((g) => (
            <div key={g.id} id={g.id} className="border-b border-border py-3 last:border-b-0">
              <dt className="font-extrabold text-ink">{g.term}</dt>
              <dd className="mt-1 max-w-[65ch] text-ink">
                {g.definition}
                <SourceMarks ids={g.sourceIds} numbered={numbered} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <SourceList numbered={numbered} />
    </section>
  );
}
