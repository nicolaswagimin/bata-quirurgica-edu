/** Chapter of the /bata-3d procedure film for a donning step id (`d1` → 0 … `d6` → 5). */
export function chapterForDonning(donningId: string | undefined): number | null {
  const match = /^d([1-6])$/.exec(donningId ?? '');
  return match ? Number(match[1]) - 1 : null;
}
