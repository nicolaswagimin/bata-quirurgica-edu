import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { MEDAL, missionSprite } from '../art/sprites.ts';
import { missionCode, type SheetMission } from './mission-sheet.tsx';
import { PixelSprite } from './pixel-sprite.tsx';

export type IndexEntry = SheetMission & {
  iconKey: string;
  /** null when progress could not be read. */
  correct: number | null;
  completed: boolean;
};

const SEEN_KEY = 'bata.sealsSeen';

function readSeen(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Medals assemble once: the first time a mission shows as mastered, then they rest. */
function useFreshSeals(completedIds: string[]): Set<string> {
  const [fresh] = useState(() => {
    const seen = new Set(readSeen());
    return new Set(completedIds.filter((id) => !seen.has(id)));
  });
  const key = completedIds.join(',');
  useEffect(() => {
    if (!key) return;
    try {
      const seen = new Set([...readSeen(), ...key.split(',')]);
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {
      // Without storage the medal simply assembles on every visit.
    }
  }, [key]);
  return fresh;
}

function Medal({ fresh }: { fresh: boolean }) {
  return (
    <span className="tile-grid grid size-11 place-items-center rounded-card">
      <PixelSprite sprite={MEDAL} className={`size-9 ${fresh ? 'animate-medal' : ''}`} />
    </span>
  );
}

function status(entry: IndexEntry, current: boolean): string {
  if (entry.completed) return `dominada · ${entry.questionCount} de ${entry.questionCount}`;
  if (entry.correct === null) return 'progreso no disponible';
  if (current) return `abierta hoy · ${entry.correct} de ${entry.questionCount}`;
  return `${entry.correct} de ${entry.questionCount} correctas`;
}

/** Every mission in order; mastered ones carry the bronze pixel medal. */
export function MissionIndex({
  entries,
  currentId,
  className = '',
}: {
  entries: IndexEntry[];
  currentId: string | null;
  className?: string;
}) {
  const fresh = useFreshSeals(entries.filter((e) => e.completed).map((e) => e.id));
  const mastered = entries.filter((e) => e.completed).length;

  return (
    <section
      aria-labelledby="indice-misiones"
      className={`flex flex-col md:self-start md:rounded-card md:bg-bg md:p-6 md:shadow-sheet ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="indice-misiones" className="text-base font-extrabold">
          Misiones
        </h2>
        <p className="text-xs text-muted">
          {mastered} {mastered === 1 ? 'dominada' : 'dominadas'} de {entries.length}
        </p>
      </header>
      <ol className="mt-1">
        {entries.map((entry) => {
          const current = entry.id === currentId;
          return (
            <li key={entry.id} className="border-b border-border last:border-b-0">
              <span className="sr-only">Misión {entry.order}: </span>
              <Link
                to="/mision/$missionId"
                params={{ missionId: entry.id }}
                aria-current={current ? 'step' : undefined}
                className="pressable -mx-2 grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-card px-2 py-3 hover:bg-surface"
              >
                {entry.completed ? (
                  <Medal fresh={fresh.has(entry.id)} />
                ) : (
                  <span
                    className={`grid size-11 place-items-center rounded-card ${
                      current ? 'bg-band ring-2 ring-primary' : 'bg-primary-soft'
                    }`}
                  >
                    <PixelSprite sprite={missionSprite(entry.iconKey)} className="size-8" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-sm leading-snug font-bold text-ink">
                    {entry.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    <span aria-hidden="true" className="font-mono font-bold text-primary">
                      {missionCode(entry.order)}
                    </span>{' '}
                    · {status(entry, current)}
                  </span>
                </span>
                <span
                  className={`rounded-pill px-2 py-1.5 font-pixel text-xs leading-none font-semibold whitespace-nowrap ${
                    entry.completed ? 'text-seal' : 'bg-xp-soft text-ink'
                  }`}
                >
                  +{entry.xpReward} XP
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
