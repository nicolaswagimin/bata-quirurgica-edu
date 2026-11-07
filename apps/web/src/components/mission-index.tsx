import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { MEDAL, missionSprite } from '../art/sprites.ts';
import { missionCode, type SheetMission } from './mission-sheet.tsx';
import { Pictogram } from './pictogram.tsx';
import { PixelSprite } from './pixel-sprite.tsx';
import { StarRating } from './star-rating.tsx';

export type IndexEntry = SheetMission & {
  iconKey: string;
  /** Mejor intento; null cuando progress no se pudo leer. */
  bestCorrect: number | null;
  /** Estrellas del récord (0 a 3). */
  stars: number;
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
  if (entry.completed) return `dominada · ${entry.stars} de 3 estrellas`;
  if (entry.bestCorrect === null) return 'progreso no disponible';
  const record = `récord ${entry.bestCorrect} de ${entry.questionCount}`;
  return current ? `abierta hoy · ${record}` : record;
}

/** Every mission in order; mastered ones carry the bronze pixel medal and their stars. */
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
        <Link
          to="/aprende"
          className="ml-auto text-xs font-bold text-primary underline underline-offset-4"
        >
          Aprende
        </Link>
        <p className="text-xs text-muted">
          {mastered} {mastered === 1 ? 'dominada' : 'dominadas'} de {entries.length}
        </p>
      </header>
      <ol className="mt-1">
        {entries.map((entry) => {
          const current = entry.id === currentId;
          return (
            <li
              key={entry.id}
              className="flex items-center gap-1 border-b border-border last:border-b-0"
            >
              <span className="sr-only">Misión {entry.order}: </span>
              <Link
                to="/mision/$missionId"
                params={{ missionId: entry.id }}
                aria-current={current ? 'step' : undefined}
                className="pressable -ml-2 grid min-w-0 flex-1 grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-card px-2 py-3 hover:bg-surface"
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
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span aria-hidden="true" className="font-mono font-bold text-primary">
                      {missionCode(entry.order)}
                    </span>
                    <span>· {status(entry, current)}</span>
                    {entry.completed ? <StarRating stars={entry.stars} size="size-4" /> : null}
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
              <Link
                to="/aprende/$missionId"
                params={{ missionId: entry.id }}
                aria-label={`Lección de la misión ${missionCode(entry.order)}`}
                className="pressable -mr-2 grid size-11 shrink-0 place-items-center rounded-card text-primary hover:bg-primary-soft"
              >
                <Pictogram name="book" className="size-5" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
