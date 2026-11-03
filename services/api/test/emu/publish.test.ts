import type { Firestore } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { publishQuestions } from '../../scripts/publish-questions.ts';
import { DEFAULT_SEED_FILE, seedContent } from '../../scripts/seed.ts';
import { getDb } from '../../src/lib/identity.ts';

const FIRESTORE_RESET =
  'http://127.0.0.1:8080/emulator/v1/projects/demo-bata/databases/(default)/documents';

let db: Firestore;
const NOW = new Date('2026-11-02T20:00:00Z');

async function statuses(): Promise<Record<string, string>> {
  const snap = await db.collection('questions').get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.get('status') as string]));
}

beforeAll(async () => {
  db = await getDb();
});

beforeEach(async () => {
  await fetch(FIRESTORE_RESET, { method: 'DELETE' });
  await seedContent(db, DEFAULT_SEED_FILE);
});

describe('publishQuestions', () => {
  it('dry-run reports every draft and writes nothing', async () => {
    const lines: string[] = [];
    const result = await publishQuestions({
      db,
      ids: 'all',
      by: 'Director de tesis',
      now: NOW,
      dryRun: true,
      log: (l) => lines.push(l),
    });
    expect(result.published).toHaveLength(30);
    expect(Object.values(await statuses()).every((s) => s === 'draft')).toBe(true);
    expect(lines.at(-1)).toContain('dry-run');
  });

  it('validates all drafts with who and when, and is idempotent', async () => {
    const first = await publishQuestions({ db, ids: 'all', by: 'Director de tesis', now: NOW });
    expect(first.published).toHaveLength(30);
    expect(Object.values(await statuses()).every((s) => s === 'validated')).toBe(true);
    const q01 = (await db.doc('questions/q01').get()).data();
    expect(q01).toMatchObject({
      status: 'validated',
      validatedBy: 'Director de tesis',
      validatedAt: NOW.toISOString(),
    });
    const second = await publishQuestions({ db, ids: 'all', by: 'Director de tesis', now: NOW });
    expect(second.published).toEqual([]);
    expect(second.alreadyValidated).toHaveLength(30);
  });

  it('publishes only the listed ids and reports unknown ones', async () => {
    const result = await publishQuestions({
      db,
      ids: ['q01', 'q02', 'no-existe'],
      by: 'Director de tesis',
      now: NOW,
    });
    expect(result.published).toEqual(['q01', 'q02']);
    expect(result.missing).toEqual(['no-existe']);
    const s = await statuses();
    expect(s.q01).toBe('validated');
    expect(s.q03).toBe('draft');
  });
});
