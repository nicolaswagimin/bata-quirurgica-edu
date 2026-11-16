import { Link } from '@tanstack/react-router';
import { ASK_BUBBLE, CUBE_3D, MIRROR, PLAY, STERILE_ZONE, TROPHY } from '../art/landing-sprites.ts';
import { MISSION_SPRITES } from '../art/sprites.ts';
import { LANDING_COPY as copy, FAQ_ITEMS, HOW_ITEMS, LEARN_ITEMS } from './landing-copy.ts';
import { PixelSprite } from './pixel-sprite.tsx';
import { textLink } from './ui-classes.ts';

const howSprites = { ASK_BUBBLE, CUBE_3D, MIRROR, PLAY, TROPHY };
const heading = 'mb-6 font-pixel text-lg font-semibold md:text-xl';
const learnSprites = {
  gown: MISSION_SPRITES.gown,
  zone: STERILE_ZONE,
  gloves: MISSION_SPRITES.gloves,
};

export function LandingSections() {
  return (
    <>
      <section aria-labelledby="landing-learn" className="py-12 md:py-16">
        <h2 id="landing-learn" className={heading}>
          {copy.learn}
        </h2>
        <ul className="grid gap-8 md:grid-cols-3">
          {LEARN_ITEMS.map((item) => (
            <li key={item.sprite}>
              <div className="tile-grid mb-4 flex size-16 items-center justify-center rounded-card">
                <PixelSprite sprite={learnSprites[item.sprite]} className="size-12" />
              </div>
              <h3 className="mb-2 text-base font-extrabold">{item.title}</h3>
              <p className="max-w-[36ch] text-sm text-muted">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="landing-how" className="py-12 md:py-16">
        <h2 id="landing-how" className={heading}>
          {copy.how}
        </h2>
        <ul className="grid md:grid-flow-col md:grid-rows-3 md:gap-x-8">
          {HOW_ITEMS.map((item) => (
            <li
              key={item.sprite}
              className="grid grid-cols-[56px_1fr] gap-4 border-t border-border py-6"
            >
              <div className="flex size-14 items-center justify-center rounded-card bg-primary-soft">
                <PixelSprite sprite={howSprites[item.sprite]} className="size-8" />
              </div>
              <div>
                <h3 className="mb-2 text-base font-extrabold">{item.title}</h3>
                <p className="max-w-[60ch] text-sm text-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section
        aria-labelledby="landing-sources"
        className="rounded-card bg-surface px-6 py-12 md:px-8 md:py-16"
      >
        <h2 id="landing-sources" className={heading}>
          {copy.sources}
        </h2>
        <p>{copy.sourceIntro}</p>
        <ul className="my-4 max-w-[65ch] list-disc space-y-3 pl-5">
          {copy.sourceList.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        <p className="max-w-[65ch] text-sm text-muted">{copy.sourceNote}</p>
      </section>
      <section aria-labelledby="landing-faq" className="py-12 md:py-16">
        <h2 id="landing-faq" className="mb-6 text-lg font-extrabold tracking-tight md:text-xl">
          {copy.faq}
        </h2>
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="group border-t border-border">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold [&::-webkit-details-marker]:hidden">
              {item.question}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6 shrink-0 transition-transform duration-(--duration-fast) ease-(--ease-out) group-open:rotate-180"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="max-w-[65ch] pb-4 text-sm text-muted">
              {item.answer}
              {'privacy' in item && (
                <>
                  {' '}
                  <Link to="/privacidad" className={textLink}>
                    {copy.privacy}
                  </Link>
                </>
              )}
            </p>
          </details>
        ))}
      </section>
    </>
  );
}
