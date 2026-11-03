import { Link, useParams } from '@tanstack/react-router';
import { missionSprite } from '../art/sprites.ts';
import { DraftNote, MistakePair, SourceList, SourceMarks } from '../components/lesson-parts.tsx';
import { Mascot } from '../components/mascot.tsx';
import { missionCode } from '../components/mission-sheet.tsx';
import { PixelSprite } from '../components/pixel-sprite.tsx';
import { buttonPrimary, pageTitle, panel, textLink } from '../components/ui-classes.ts';
import { lessonFor, numberSources } from '../lib/lessons.ts';

/** /aprende/$missionId: a mission's lesson, its frequent mistakes and the sources behind it. */
export default function AprendeLeccionPage() {
  const { missionId = '' } = useParams({ strict: false });
  const found = lessonFor(missionId);

  if (!found) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className={pageTitle}>Lección no disponible</h1>
        <Link to="/aprende" className={`${textLink} self-start`}>
          Ver todas las lecciones
        </Link>
      </section>
    );
  }

  const { lesson, order } = found;
  const numbered = numberSources([
    ...lesson.keyPoints.map((k) => k.sourceIds),
    ...lesson.mistakes.map((m) => m.sourceIds),
  ]);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link to="/aprende" className={`${textLink} self-start text-sm`}>
          Todas las lecciones
        </Link>
        {/* The lesson's illustration: the mission's pixel icon on the tile wall with Dra. Menta. */}
        <div
          aria-hidden="true"
          className="tile-grid relative flex h-40 items-end justify-center gap-6 rounded-card px-6 pb-4 md:h-48"
        >
          <Mascot className="h-28 w-auto md:h-32" />
          <PixelSprite sprite={missionSprite(lesson.iconKey)} className="mb-4 size-20 md:size-24" />
          <span className="absolute right-3 bottom-3 rounded-box bg-primary px-1.5 py-0.5 font-pixel text-xs font-semibold text-bg">
            {missionCode(order)}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className={pageTitle}>{lesson.title}</h1>
          <p className="max-w-[60ch] text-lg text-muted">{lesson.summary}</p>
        </div>
        <DraftNote />
      </header>

      <section aria-labelledby="ideas" className="flex flex-col gap-3">
        <h2 id="ideas" className="text-xl font-extrabold tracking-tight">
          Ideas clave
        </h2>
        <ul className="flex flex-col gap-3">
          {lesson.keyPoints.map((k) => (
            <li key={k.text} className="flex max-w-[65ch] gap-3">
              <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-[1px] bg-primary" />
              <span>
                {k.text}
                <SourceMarks ids={k.sourceIds} numbered={numbered} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="errores" className={`${panel} flex flex-col gap-6`}>
        <h2 id="errores" className="text-xl font-extrabold tracking-tight">
          Errores frecuentes
        </h2>
        <ul className="flex flex-col gap-6">
          {lesson.mistakes.map((m) => (
            <MistakePair key={m.id} mistake={m} numbered={numbered} />
          ))}
        </ul>
      </section>

      <Link
        to="/mision/$missionId"
        params={{ missionId: lesson.missionId }}
        className={`${buttonPrimary} self-start`}
      >
        Practicar la misión {missionCode(order)}
      </Link>

      <SourceList numbered={numbered} />
    </article>
  );
}
