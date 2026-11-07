import { bogotaDate, DAILY_GOAL_XP, dailyXp } from '@bata/shared/gamification';
import { XP_GEM } from '../art/sprites.ts';
import type { Profile } from '../lib/api.ts';
import { FlameIcon } from './flame-icon.tsx';
import { MascotNote } from './mascot.tsx';
import { PixelSprite } from './pixel-sprite.tsx';

/** XP needed to reach `level` (inverse of levelForXp: level = floor(sqrt(xp / 50)) + 1). */
function xpForLevel(level: number): number {
  return 50 * (level - 1) ** 2;
}

function streakHint(profile: Profile): string {
  if (profile.lastActiveDate === bogotaDate(new Date())) {
    return 'Tu racha está a salvo hoy. Sigue cuando quieras.';
  }
  return profile.streakDays === 0
    ? 'Aprueba una misión hoy para empezar tu racha.'
    : 'Aprueba una misión hoy para mantenerla.';
}

/** Today's XP against the daily goal; the counter resets at midnight in Bogotá. */
function DailyGoal({ profile }: { profile: Profile }) {
  const earned = dailyXp(profile, new Date());
  const done = earned >= DAILY_GOAL_XP;
  const shown = Math.min(earned, DAILY_GOAL_XP);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-xs font-bold text-on-band-muted">Meta de hoy</p>
        <p className="font-mono text-xs text-on-band-muted tabular-nums">
          {shown} / {DAILY_GOAL_XP} XP
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Meta diaria de XP"
        aria-valuemin={0}
        aria-valuemax={DAILY_GOAL_XP}
        aria-valuenow={shown}
        className="h-2 overflow-hidden rounded-box bg-primary-strong"
      >
        <div
          className="h-full rounded-[2px] bg-bg"
          style={{ width: `${(shown / DAILY_GOAL_XP) * 100}%` }}
        />
      </div>
      {done ? (
        <p className="text-xs font-bold text-primary-strong">¡Meta de hoy cumplida!</p>
      ) : null}
    </div>
  );
}

/** The mint band under the header: greeting, streak and XP badges, Dra. Menta, level progress. */
export function HomeBand({ profile }: { profile: Profile }) {
  const from = xpForLevel(profile.level);
  const to = xpForLevel(profile.level + 1);
  const ratio = Math.min(1, Math.max(0, (profile.xp - from) / (to - from)));
  const streak = profile.streakDays;

  return (
    <section className="-mx-4 -mt-8 bg-band px-4 pt-4 pb-8 text-ink md:mx-[calc(50%-50vw)] md:px-[max(2rem,calc(50vw-36rem+2rem))] md:pt-6 md:pb-20">
      <div className="grid gap-6 md:grid-cols-12 md:items-end md:gap-8">
        <div className="flex flex-col gap-3 md:col-span-7">
          <h1 className="text-xl leading-tight font-extrabold tracking-tight text-balance md:text-2xl">
            Hola, {profile.displayName}
          </h1>
          <ul aria-label="Tu progreso" className="flex flex-wrap items-center gap-2 text-sm">
            <li className="flex items-center gap-2 rounded-pill bg-bg px-3 py-2 leading-none font-bold">
              <FlameIcon />
              <span>
                {streak} {streak === 1 ? 'día' : 'días'} de racha
              </span>
            </li>
            <li
              data-testid="xp-pill"
              className="flex items-center gap-2 rounded-pill bg-xp px-3 py-2 font-pixel text-base leading-none font-semibold text-ink tabular-nums"
            >
              <PixelSprite sprite={XP_GEM} className="size-4" />
              {profile.xp} XP
            </li>
          </ul>
          <MascotNote className="mt-1">{streakHint(profile)}</MascotNote>
        </div>
        <div className="flex flex-col gap-2 md:col-span-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="font-pixel text-xl font-semibold md:text-2xl">Nivel {profile.level}</h2>
            <p className="text-xs text-on-band-muted">
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
            className="h-3 overflow-hidden rounded-box bg-primary-strong p-0.5"
          >
            <div
              className="h-full origin-left animate-fill rounded-[2px] bg-xp"
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
          <DailyGoal profile={profile} />
        </div>
      </div>
    </section>
  );
}
