import { Link } from '@tanstack/react-router';
import { LANDING_COPY as copy } from './landing-copy.ts';
import { Mascot } from './mascot.tsx';
import { buttonPrimary, buttonSecondary } from './ui-classes.ts';

export function LandingFinal() {
  return (
    <section
      aria-labelledby="landing-final"
      className="mx-[calc(50%-50vw)] bg-band py-12 text-ink md:py-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 md:px-8">
        <Mascot mood="cheer" className="h-33 w-24" />
        <h2 id="landing-final" className="font-pixel text-lg font-semibold md:text-xl">
          {copy.finalTitle}
        </h2>
        <p>{copy.finalText}</p>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
          <Link to="/registro" className={`${buttonPrimary} md:min-w-72`}>
            {copy.create}
          </Link>
          <Link to="/ingresar" className={buttonSecondary}>
            {copy.login}
          </Link>
        </div>
      </div>
    </section>
  );
}
