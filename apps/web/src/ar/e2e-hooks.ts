// Query-string switches that only exist in e2e builds (`vite build --mode e2e`), so tests and
// screenshots can reach states a fake camera cannot produce. Always off in production builds.
function param(name: string): string | null {
  return import.meta.env.MODE === 'e2e'
    ? new URLSearchParams(window.location.search).get(name)
    : null;
}

/** `?simularFpsBajo=1` and `?simularPracticaCompleta=1`. */
export function e2eFlag(name: 'simularFpsBajo' | 'simularPracticaCompleta'): boolean {
  return param(name) === '1';
}

/** `?simularPose=1` (standing) or `?simularPose=bajo` (a wrist below the waist). */
export function simulatedPoseVariant(): string | null {
  return param('simularPose');
}
