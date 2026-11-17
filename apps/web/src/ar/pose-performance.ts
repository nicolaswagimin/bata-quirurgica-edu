import type { PoseDelegate } from './pose.ts';

export function shouldFallbackToCpu(durations: readonly number[], delegate: PoseDelegate): boolean {
  if (delegate !== 'GPU' || durations.length < 8) return false;
  const sorted = durations.slice(0, 8).sort((a, b) => a - b);
  return ((sorted[3] ?? 0) + (sorted[4] ?? 0)) / 2 > 60;
}
