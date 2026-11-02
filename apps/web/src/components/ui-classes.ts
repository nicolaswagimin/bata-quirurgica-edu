// Shared class strings of the "Libreta de prácticas" world (see DESIGN.md). One source so every
// screen presses, focuses and stacks the same way.

export const buttonPrimary =
  'pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-primary px-6 font-extrabold text-bg hover:bg-primary-strong disabled:opacity-60 disabled:active:scale-100';

export const buttonSecondary =
  'pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-bg px-4 font-bold text-primary ring-2 ring-primary ring-inset hover:bg-primary-soft disabled:opacity-60';

export const buttonDanger =
  'pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-danger px-4 font-bold text-bg hover:opacity-90 disabled:opacity-60';

export const textLink =
  'font-bold text-primary underline underline-offset-4 hover:text-primary-strong';

export const pageTitle = 'text-2xl leading-tight font-extrabold tracking-tight text-balance';

/** The open notebook page: quadrille, red margin rule, lifted on desktop. */
export const sheet =
  'paper-grid relative -mx-4 px-4 py-6 pl-16 shadow-[inset_0_-2px_0_var(--color-primary)] ' +
  'before:absolute before:inset-y-0 before:left-11 before:border-l-2 before:border-margin ' +
  'md:mx-0 md:rounded-card md:py-8 md:pr-8 md:pl-24 md:shadow-sheet md:before:left-[4.5rem]';

/** A small notebook page for focused forms (login, registro, consent). */
export const notebookCard =
  'paper-grid relative mx-auto flex w-full max-w-md flex-col gap-4 rounded-card py-8 pr-6 pl-16 shadow-sheet ' +
  'before:absolute before:inset-y-0 before:left-11 before:border-l-2 before:border-margin';
