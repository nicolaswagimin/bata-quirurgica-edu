import { FLAME, MEDAL, type Sprite, STAR, XP_GEM } from '../art/sprites.ts';
import type { Achievement, AchievementIcon } from '../lib/achievements.ts';
import { PixelSprite } from './pixel-sprite.tsx';

const ICONS: Record<AchievementIcon, Sprite> = {
  star: STAR,
  medal: MEDAL,
  flame: FLAME,
  xp: XP_GEM,
};

/** The achievements of a learner: earned badges in colour, pending ones dimmed. */
export function Achievements({ achievements }: { achievements: Achievement[] }) {
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <section aria-labelledby="logros" className="flex flex-col gap-3 rounded-card bg-surface p-6">
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="logros" className="text-lg font-extrabold">
          Logros
        </h2>
        <p className="text-xs text-muted">
          {earned} de {achievements.length}
        </p>
      </header>
      <ul className="grid gap-2 sm:grid-cols-2">
        {achievements.map((achievement) => (
          <li
            key={achievement.id}
            className={`flex items-start gap-3 rounded-card bg-bg px-3 py-3 ${
              achievement.earned ? 'ring-1 ring-primary/30' : 'opacity-60'
            }`}
          >
            <span className="tile-grid grid size-10 shrink-0 place-items-center rounded-box">
              <PixelSprite
                sprite={ICONS[achievement.icon]}
                className={`size-6 ${achievement.earned ? '' : 'opacity-30 grayscale'}`}
              />
            </span>
            <span className="min-w-0">
              <span className="block text-sm leading-snug font-bold text-ink">
                {achievement.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{achievement.description}</span>
            </span>
            <span className="sr-only">{achievement.earned ? 'Logrado' : 'Pendiente'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
