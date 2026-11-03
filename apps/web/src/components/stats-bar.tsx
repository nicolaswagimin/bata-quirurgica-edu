import { XP_GEM } from '../art/sprites.ts';
import type { Profile } from '../lib/api.ts';
import { FlameIcon } from './flame-icon.tsx';
import { PixelSprite } from './pixel-sprite.tsx';

/** XP, level and streak: the same pixel badges as the home band. Game colour stays in the chips. */
export function StatsBar({ profile }: { profile: Profile }) {
  return (
    <ul aria-label="Tu progreso" className="flex flex-wrap items-center gap-2 text-sm">
      <li
        data-testid="xp-pill"
        className="flex items-center gap-2 rounded-pill bg-xp px-3 py-2 font-pixel text-base leading-none font-semibold text-ink tabular-nums"
      >
        <PixelSprite sprite={XP_GEM} className="size-4" />
        {profile.xp} XP
      </li>
      <li className="rounded-pill bg-primary-soft px-3 py-2 font-pixel text-base leading-none font-semibold text-ink">
        Nivel {profile.level}
      </li>
      <li className="flex items-center gap-2 rounded-pill bg-surface px-3 py-2 leading-none font-bold text-ink">
        <FlameIcon />
        <span>
          {profile.streakDays} {profile.streakDays === 1 ? 'día' : 'días'} de racha
        </span>
      </li>
    </ul>
  );
}
