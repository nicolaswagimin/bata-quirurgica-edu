// Logros del perfil: se derivan del progreso que ya existe (no hay colección nueva ni escrituras).

export type AchievementIcon = 'star' | 'medal' | 'flame' | 'xp';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  icon: AchievementIcon;
};

export type AchievementInput = {
  level: number;
  streakDays: number;
  missionsSealed: number;
  /** Misiones dominadas con las 3 estrellas. */
  perfectMissions: number;
  totalMissions: number;
};

/** Todos los logros, ganados o no, en orden de dificultad. */
export function achievementsFor(input: AchievementInput): Achievement[] {
  const { level, streakDays, missionsSealed, perfectMissions, totalMissions } = input;
  return [
    {
      id: 'first-mission',
      title: 'Primera bata',
      description: 'Domina tu primera misión.',
      earned: missionsSealed >= 1,
      icon: 'medal',
    },
    {
      id: 'perfect',
      title: 'Sin un fallo',
      description: 'Aprueba una misión con las tres estrellas.',
      earned: perfectMissions >= 1,
      icon: 'star',
    },
    {
      id: 'streak-3',
      title: 'Tres días seguidos',
      description: 'Mantén la racha 3 días.',
      earned: streakDays >= 3,
      icon: 'flame',
    },
    {
      id: 'streak-7',
      title: 'Una semana de quirófano',
      description: 'Mantén la racha 7 días.',
      earned: streakDays >= 7,
      icon: 'flame',
    },
    {
      id: 'level-2',
      title: 'Nivel 2',
      description: 'Alcanza el nivel 2.',
      earned: level >= 2,
      icon: 'xp',
    },
    {
      id: 'all-missions',
      title: 'Quirófano completo',
      description:
        totalMissions > 0 ? `Domina las ${totalMissions} misiones.` : 'Domina todas las misiones.',
      earned: totalMissions > 0 && missionsSealed >= totalMissions,
      icon: 'medal',
    },
  ];
}
