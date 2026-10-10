import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  type Query,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { LoadingState } from '../components/loading-state.tsx';
import { ApiError, useMe } from '../lib/api.ts';
import { db } from '../lib/firebase.tsx';

const RANKING_SIZE = 20;

// Fields of `leaderboard/{uid}` the ranking shows.
const LeaderboardEntrySchema = z.object({
  displayName: z.string(),
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
  groupId: z.string().nullable().optional(),
});
type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema> & { uid: string };

type Tab = 'global' | 'group';

function rankingQuery(tab: Tab, groupId: string | null): Query {
  const leaderboard = collection(db, 'leaderboard');
  if (tab === 'group' && groupId) {
    return query(
      leaderboard,
      where('groupId', '==', groupId),
      orderBy('xp', 'desc'),
      limit(RANKING_SIZE),
    );
  }
  return query(leaderboard, orderBy('xp', 'desc'), limit(RANKING_SIZE));
}

type LiveState = { entries: LeaderboardEntry[] | null; error: boolean };

function useLiveRanking(tab: Tab, groupId: string | null): LiveState {
  const [state, setState] = useState<LiveState>({ entries: null, error: false });
  useEffect(() => {
    setState({ entries: null, error: false });
    return onSnapshot(
      rankingQuery(tab, groupId),
      (snap) => {
        const entries = snap.docs.flatMap((d) => {
          const parsed = LeaderboardEntrySchema.safeParse(d.data());
          return parsed.success ? [{ ...parsed.data, uid: d.id }] : [];
        });
        setState({ entries, error: false });
      },
      () => setState({ entries: null, error: true }),
    );
  }, [tab, groupId]);
  return state;
}

function RankingList({ tab, groupId, uid }: { tab: Tab; groupId: string | null; uid: string }) {
  const { entries, error } = useLiveRanking(tab, groupId);
  if (error) {
    return (
      <p role="alert" className="text-danger">
        No pudimos cargar el ranking. Intenta de nuevo.
      </p>
    );
  }
  if (!entries) return <LoadingState />;
  if (entries.length === 0) {
    return <p className="text-muted">Aún no hay puntajes. ¡Responde tu primera misión!</p>;
  }
  return (
    <ol aria-label="Posiciones" className="flex flex-col gap-2">
      {entries.map((entry, index) => {
        const mine = entry.uid === uid;
        return (
          <li
            key={entry.uid}
            aria-current={mine ? 'true' : undefined}
            className={`flex items-center gap-3 rounded-card border border-border p-3 ${
              mine ? 'bg-primary-soft' : 'bg-surface'
            }`}
          >
            <span className="w-8 text-center font-semibold text-muted">{index + 1}</span>
            <span className="flex-1 font-semibold text-ink">
              {entry.displayName}
              {mine ? <span className="font-normal text-muted"> (tú)</span> : null}
            </span>
            <span className="text-sm text-muted">Nivel {entry.level}</span>
            <span className="rounded-pill bg-xp px-3 py-1 text-sm font-semibold text-ink">
              {entry.xp} XP
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const tabClass =
  'min-h-11 rounded-pill px-4 font-semibold aria-selected:bg-primary aria-selected:text-bg ' +
  'border border-border text-ink hover:bg-primary-soft aria-selected:hover:bg-primary-strong';

export default function RankingPage() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>('global');

  if (me.isPending) return <LoadingState />;
  if (me.isError) {
    return (
      <p role="alert" className="text-danger">
        {me.error instanceof ApiError ? me.error.message : 'Ocurrió un error inesperado.'}
      </p>
    );
  }
  const groupId = me.data?.groupId ?? null;
  const activeTab: Tab = groupId ? tab : 'global';
  const tabs: { id: Tab; label: string }[] = groupId
    ? [
        { id: 'global', label: 'Global' },
        { id: 'group', label: 'Mi grupo' },
      ]
    : [{ id: 'global', label: 'Global' }];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ranking</h1>
      <div role="tablist" aria-label="Tipo de ranking" className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`ranking-tab-${t.id}`}
            aria-selected={activeTab === t.id}
            aria-controls="ranking-panel"
            onClick={() => setTab(t.id)}
            className={tabClass}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="ranking-panel" role="tabpanel" aria-labelledby={`ranking-tab-${activeTab}`}>
        <RankingList tab={activeTab} groupId={groupId} uid={me.data?.uid ?? ''} />
      </div>
    </section>
  );
}
