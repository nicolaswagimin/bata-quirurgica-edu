import { Link } from '@tanstack/react-router';
import { type ReactNode, useId } from 'react';
import { DraftNote, SourceList, SourceMarks } from '../components/lesson-parts.tsx';
import { Pictogram } from '../components/pictogram.tsx';
import { buttonSecondary, pageTitle, textLink } from '../components/ui-classes.ts';
import { DONNING_STEPS, LESSONS_FILE, numberSources } from '../lib/lessons.ts';

function CheckRow({ label, children }: { label: string; children?: ReactNode }) {
  const id = useId();
  return (
    <li className="flex gap-3 border-b border-border py-3 last:border-b-0 print:break-inside-avoid">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-6 shrink-0 accent-primary print:appearance-none print:rounded-box print:border-2 print:border-ink"
      />
      <label htmlFor={id} className="flex max-w-[65ch] flex-col gap-1">
        <span className="font-bold text-ink">{label}</span>
        {children}
      </label>
    </li>
  );
}

/** /aprende/lista: the donning checklist, usable on screen and printable on one sheet. */
export default function AprendeListaPage() {
  const { before, during } = LESSONS_FILE.checklist;
  const numbered = numberSources([...before, ...during].map((c) => c.sourceIds));

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 print:max-w-none print:gap-4">
      <header className="flex flex-col gap-3">
        <Link to="/aprende" className={`${textLink} self-start text-sm print:hidden`}>
          Volver a Aprende
        </Link>
        <h1 className={pageTitle}>Lista de verificación: colocación de bata y guantes</h1>
        <DraftNote />
        <button
          type="button"
          onClick={() => window.print()}
          className={`${buttonSecondary} self-start print:hidden`}
        >
          <Pictogram name="print" className="size-5" />
          Imprimir la lista
        </button>
      </header>

      <section aria-labelledby="antes" className="flex flex-col gap-1">
        <h2 id="antes" className="text-lg font-extrabold">
          Antes de empezar
        </h2>
        <ul>
          {before.map((c) => (
            <CheckRow key={c.id} label={c.text}>
              <span className="text-xs text-muted">
                Respaldo
                <SourceMarks ids={c.sourceIds} numbered={numbered} />
              </span>
            </CheckRow>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pasos" className="flex flex-col gap-1">
        <h2 id="pasos" className="text-lg font-extrabold">
          Colocación, paso a paso
        </h2>
        <ol>
          {DONNING_STEPS.map((step) => (
            <CheckRow key={step.id} label={`${step.order}. ${step.title}`}>
              <span className="text-sm text-ink">{step.description}</span>
              <span className="text-xs text-muted">
                Fuente: {step.source.org} ({step.source.year}), {step.source.section}
              </span>
            </CheckRow>
          ))}
        </ol>
      </section>

      <section aria-labelledby="durante" className="flex flex-col gap-1">
        <h2 id="durante" className="text-lg font-extrabold">
          Durante el procedimiento
        </h2>
        <ul>
          {during.map((c) => (
            <CheckRow key={c.id} label={c.text}>
              <span className="text-xs text-muted">
                Respaldo
                <SourceMarks ids={c.sourceIds} numbered={numbered} />
              </span>
            </CheckRow>
          ))}
        </ul>
      </section>

      <SourceList numbered={numbered} />
    </section>
  );
}
