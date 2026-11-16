import { Link } from '@tanstack/react-router';
import { LANDING_COPY as copy } from './landing-copy.ts';
import { MentaDialogue } from './menta-dialogue.tsx';
import { buttonPrimary, buttonSecondary } from './ui-classes.ts';

export function LandingHero() {
  return (
    <section
      aria-labelledby="landing-title"
      className="mx-[calc(50%-50vw)] -mt-8 bg-band py-10 text-ink md:py-14"
    >
      <div className="mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-12 md:grid-rows-[auto_auto_auto_1fr] md:items-start md:gap-x-8 md:gap-y-6 md:px-8">
        <h1
          id="landing-title"
          className="text-xl leading-tight font-extrabold tracking-tight text-balance md:col-span-6 md:text-2xl"
        >
          {copy.title}
        </h1>
        <p className="hidden max-w-[52ch] text-base text-ink md:col-span-6 md:block">
          {copy.intro}
        </p>
        <MentaDialogue />
        <div className="flex flex-col gap-3 md:col-span-6 md:flex-row md:flex-wrap">
          <Link to="/registro" className={`${buttonPrimary} md:min-w-72`}>
            {copy.create}
          </Link>
          <Link to="/ingresar" className={buttonSecondary}>
            {copy.login}
          </Link>
        </div>
        <p className="text-xs text-on-band-muted md:col-span-6">{copy.virtual}</p>
      </div>
    </section>
  );
}
