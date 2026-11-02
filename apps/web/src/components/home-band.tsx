import { bogotaDate } from '@bata/shared/gamification';
import type { Profile } from '../lib/api.ts';
import { FlameIcon } from './flame-icon.tsx';

/** XP needed to reach `level` (inverse of levelForXp: level = floor(sqrt(xp / 50)) + 1). */
function xpForLevel(level: number): number {
  return 50 * (level - 1) ** 2;
}

function streakHint(profile: Profile): string {
  if (profile.lastActiveDate === bogotaDate(new Date())) {
    return 'Tu racha está a salvo hoy. Sigue cuando quieras.';
  }
  return profile.streakDays === 0
    ? 'Responde una pregunta hoy para empezar tu racha.'
    : 'Responde una pregunta hoy para mantenerla.';
}

/** The blue band under the header: greeting, streak and XP chips, progress to the next level. */
export function HomeBand({ profile }: { profile: Profile }) {
  const from = xpForLevel(profile.level);
  const to = xpForLevel(profile.level + 1);
  const ratio = Math.min(1, Math.max(0, (profile.xp - from) / (to - from)));
  const streak = profile.streakDays;

  return (
    <section className="on-primary -mx-4 -mt-8 bg-primary px-4 pt-4 pb-8 text-bg md:mx-[calc(50%-50vw)] md:px-[max(2rem,calc(50vw-36rem+2rem))] md:pt-6 md:pb-20">
      <div className="grid gap-6 md:grid-cols-12 md:items-end md:gap-8">
        <div className="flex flex-col gap-3 md:col-span-7">
          <h1 className="text-xl leading-tight font-extrabold tracking-tight text-balance md:text-2xl">
            Hola, {profile.displayName}
          </h1>
          <ul aria-label="Tu progreso" className="flex flex-wrap items-center gap-2 text-sm">
            <li className="flex items-center gap-1.5 rounded-pill bg-primary-strong px-3 py-2 leading-none font-bold">
              <FlameIcon />
              <span>
                {streak} {streak === 1 ? 'día' : 'días'} de racha
              </span>
            </li>
            <li
              data-testid="xp-pill"
              className="rounded-pill bg-xp px-3 py-2 leading-none font-extrabold text-ink tabular-nums"
            >
              {profile.xp} XP
            </li>
          </ul>
          <p className="text-sm text-on-primary-muted">{streakHint(profile)}</p>
        </div>
        <div className="flex flex-col gap-2 md:col-span-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">
              Nivel {profile.level}
            </h2>
            <p className="text-xs text-on-primary-muted">
              <span className="font-mono tabular-nums">
                {profile.xp} / {to}
              </span>{' '}
              XP para el nivel {profile.level + 1}
            </p>
          </div>
          <div
            role="progressbar"
            aria-label={`Progreso al nivel ${profile.level + 1}`}
            aria-valuemin={from}
            aria-valuemax={to}
            aria-valuenow={profile.xp}
            className="h-2 overflow-hidden rounded-pill bg-primary-strong"
          >
            <div
              className="h-full origin-left animate-fill rounded-pill bg-xp"
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
