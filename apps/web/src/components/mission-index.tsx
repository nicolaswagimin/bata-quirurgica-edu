import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { missionCode, type SheetMission } from './mission-sheet.tsx';
import { isPictogramName, Pictogram } from './pictogram.tsx';

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

/** Stamps land once: a seal animates the first time its mission shows as mastered, then rests. */
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
      // Without storage the stamp simply lands on every visit.
    }
  }, [key]);
  return fresh;
}

function Seal({ fresh }: { fresh: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid size-13 -rotate-12 place-items-center rounded-pill border-[3px] border-seal font-mono text-[9px] leading-[1.05] font-bold tracking-wider text-seal opacity-90 after:absolute after:inset-1 after:rounded-pill after:border after:border-seal/60 ${
        fresh ? 'animate-stamp' : ''
      }`}
    >
      <span className="text-center">
        DOMI
        <br />
        NADA
      </span>
    </span>
  );
}

function status(entry: IndexEntry, current: boolean): string {
  if (entry.completed) return `sellada · ${entry.questionCount} de ${entry.questionCount}`;
  if (entry.correct === null) return 'progreso no disponible';
  if (current) return `abierta hoy · ${entry.correct} de ${entry.questionCount}`;
  return `${entry.correct} de ${entry.questionCount} correctas`;
}

/** The notebook index: every mission in order, mastered ones stamped. */
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
  const sealed = entries.filter((e) => e.completed).length;

  return (
    <section
      aria-labelledby="indice-misiones"
      className={`flex flex-col md:self-start md:rounded-card md:bg-bg md:p-6 md:shadow-sheet ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="indice-misiones" className="text-base font-extrabold">
          Índice de misiones
        </h2>
        <p className="text-xs text-muted">
          {sealed} {sealed === 1 ? 'sellada' : 'selladas'} de {entries.length}
        </p>
      </header>
      <ol className="mt-1">
        {entries.map((entry) => {
          const current = entry.id === currentId;
          return (
            <li key={entry.id} className="border-b border-grid last:border-b-0">
              <span className="sr-only">Misión {entry.order}: </span>
              <Link
                to="/mision/$missionId"
                params={{ missionId: entry.id }}
                aria-current={current ? 'step' : undefined}
                className="pressable -mx-2 grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-card px-2 py-3 hover:bg-surface"
              >
                {entry.completed ? (
                  <Seal fresh={fresh.has(entry.id)} />
                ) : (
                  <span
                    className={`grid size-11 place-items-center rounded-card ${
                      current ? 'bg-primary text-bg' : 'bg-surface text-primary'
                    }`}
                  >
                    <Pictogram name={isPictogramName(entry.iconKey) ? entry.iconKey : 'shield'} />
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
                  className={`rounded-pill px-2 py-1.5 text-xs leading-none font-extrabold whitespace-nowrap ${
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
