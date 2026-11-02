import type { Profile } from '../lib/api.ts';
import { FlameIcon } from './flame-icon.tsx';

/** XP, level and streak as chips. Game colour lives only inside the chips. */
export function StatsBar({ profile }: { profile: Profile }) {
  return (
    <ul aria-label="Tu progreso" className="flex flex-wrap items-center gap-2 text-sm">
      <li
        data-testid="xp-pill"
        className="rounded-pill bg-xp px-3 py-2 leading-none font-extrabold text-ink tabular-nums"
      >
        {profile.xp} XP
      </li>
      <li className="rounded-pill bg-primary-soft px-3 py-2 leading-none font-bold text-ink">
        Nivel {profile.level}
      </li>
      <li className="flex items-center gap-1 rounded-pill bg-surface px-3 py-2 leading-none font-bold text-ink">
        <FlameIcon />
        <span>
          {profile.streakDays} {profile.streakDays === 1 ? 'día' : 'días'} de racha
        </span>
      </li>
    </ul>
  );
}
