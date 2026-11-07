import { SeedMissionSchema } from '@bata/shared/schemas';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { z } from 'zod';
import { db } from './firebase.tsx';

/** `missions/{id}`: the seed mission plus the ids of its questions. */
export const MissionSchema = SeedMissionSchema.omit({ id: true }).extend({
  id: z.string(),
  questionIds: z.array(z.string()),
});
export type Mission = z.infer<typeof MissionSchema>;

// Documento `progress/{uid}/missions/{missionId}`. Los campos nuevos llevan default para que un
// progreso antiguo (solo `completed`) siga leyéndose.
export const MissionProgressSchema = z.object({
  answeredCorrectIds: z.array(z.string()).default([]),
  completed: z.boolean().default(false),
  sealed: z.boolean().default(false),
  stars: z.number().int().min(0).max(3).default(0),
  bestCorrect: z.number().int().min(0).default(0),
  questionCount: z.number().int().min(0).optional(),
});
export type MissionProgress = z.infer<typeof MissionProgressSchema>;

export async function loadMissions(): Promise<Mission[]> {
  const snap = await getDocs(query(collection(db, 'missions'), orderBy('order')));
  return snap.docs.map((d) => MissionSchema.parse({ ...d.data(), id: d.id }));
}

export async function loadMissionProgress(uid: string): Promise<Record<string, MissionProgress>> {
  const snap = await getDocs(collection(db, 'progress', uid, 'missions'));
  const byMission: Record<string, MissionProgress> = {};
  for (const d of snap.docs) byMission[d.id] = MissionProgressSchema.parse(d.data());
  return byMission;
}
