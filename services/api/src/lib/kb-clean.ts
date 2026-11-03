import type { PageText } from './kb.ts';

// Page furniture (running headers, footers, page labels) repeats on every page of a PDF and ends up
// in every chunk, pulling all embeddings towards the same boilerplate. Removing it before chunking
// lets each fragment be about its own content.

const ZONE_LINES = 6; // header zone at the top and footer zone at the bottom of each page
const MIN_PAGES = 5;
const MIN_SHARE = 0.4;

/** Letters only, lower-case, no accents: OCR spacing, digits and punctuation do not matter. */
function skeleton(line: string): string {
  return line
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-zñ]/g, '');
}

/** Header and footer zones; on short pages only the first and last line, so the body survives. */
function zoneIndexes(lines: string[]): number[] {
  const size = lines.length > ZONE_LINES * 2 ? ZONE_LINES : 1;
  const top = Array.from({ length: Math.min(size, lines.length) }, (_, i) => i);
  const bottom = Array.from(
    { length: Math.min(size, lines.length) },
    (_, i) => lines.length - 1 - i,
  );
  return [...new Set([...top, ...bottom])];
}

// "… Página 4 de 230" and the running title "Continuación de la resolución/decreto: “…”" printed by
// Colombian official documents, tolerant to OCR line breaks inside them.
const PAGE_LABEL = /^[\s\S]{0,240}?P[aá]gina\s*\d+\s*de\s*\d+\s*/i;
const RUNNING_TITLE =
  /^\s*Continuaci[oó]n\s*de\s*la\s*(?:resoluci[oó]n|decreto|ley)[\s\S]{0,600}?[”"]\s*/i;

export function stripPageFurniture(pages: PageText[]): PageText[] {
  if (pages.length < MIN_PAGES) return pages;

  // Lines whose skeleton shows up in the header/footer zone of many pages are furniture.
  const counts = new Map<string, number>();
  for (const { text } of pages) {
    const lines = text.split('\n');
    const seen = new Set(zoneIndexes(lines).map((i) => skeleton(lines[i] ?? '')));
    for (const s of seen) if (s.length >= 3) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const threshold = Math.max(MIN_PAGES, Math.ceil(pages.length * MIN_SHARE));
  const furniture = new Set([...counts].filter(([, n]) => n >= threshold).map(([s]) => s));

  return pages.map(({ page, text }) => {
    let cleaned = text.replace(PAGE_LABEL, (m) => (/P[aá]gina/i.test(m) ? '' : m));
    cleaned = cleaned.replace(RUNNING_TITLE, '');
    const lines = cleaned.split('\n');
    const zone = new Set(zoneIndexes(lines));
    const kept = lines.filter((line, i) => !(zone.has(i) && furniture.has(skeleton(line))));
    return { page, text: kept.join('\n').trim() };
  });
}
