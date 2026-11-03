// Shared class strings of the "Quirófano menta" world (see DESIGN.md). One source so every
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

/** The open working panel (a mission's questions): warm white, lifted off the band on desktop. */
export const panel =
  'relative -mx-4 bg-bg px-4 py-6 md:mx-0 md:rounded-card md:p-10 md:shadow-sheet';

/** A small panel for focused forms (login, registro, consent). */
export const formPanel =
  'relative mx-auto flex w-full max-w-md flex-col gap-4 rounded-card bg-bg p-6 shadow-sheet md:p-8';
