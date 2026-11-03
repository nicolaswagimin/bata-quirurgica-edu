import { describe, expect, it } from 'vitest';
import { mergeRetrievals, type RetrievedChunk, retrieveBilingual } from '../../src/lib/kb.ts';
import { stripPageFurniture } from '../../src/lib/kb-clean.ts';

const SOURCE = { title: 'Doc', org: 'OMS', year: 2018 };
const TOPICS = ['hair removal', 'skin antisepsis', 'drapes', 'gowns', 'gloves', 'ventilation'];
const topic = (i: number) => TOPICS[i % TOPICS.length] ?? '';
/** A realistic page body: several lines that differ from page to page. */
const body = (i: number) =>
  Array.from({ length: 14 }, (_, l) => `Line ${l} discusses ${topic(i + l)} in depth.`).join('\n');

describe('stripPageFurniture', () => {
  it('drops the running header the WHO guideline prints on every page', () => {
    const pages = Array.from({ length: 10 }, (_, i) => ({
      page: i + 1,
      text: `${100 + i}Global Guidelines for the Prevention of Surgical Site Infection\nRecommendation on ${topic(i)}.\n${body(i)}`,
    }));
    const out = stripPageFurniture(pages);
    expect(out.every((p) => !p.text.includes('Global Guidelines'))).toBe(true);
    expect(out[3]?.text.startsWith(`Recommendation on ${topic(3)}.`)).toBe(true);
    expect(out[3]?.text).toContain(`discusses ${topic(3)}`);
  });

  it('removes the page label and running title of a Colombian resolution, however OCR split it', () => {
    const header = (n: number, split: boolean) =>
      split
        ? `25 NOV 2019\nRESOLUCIÓN\nNÚMERO\n)0003100\npe2019\nPágina ${n}\nde\n230\n`
        : `25\nNOV\n2019\nResoLuciÓN Número (003100 pe 2019 Página ${n} de 230\n`;
    const title =
      'Continuación de la resolución: “Por la cual se definen los procedimientos y condiciones de inscripción de los\nprestadores de servicios de salud y se adopta el Manual de Inscripción\nde Prestadores y Habilitación de Servicios de Salud”\n';
    const pages = Array.from({ length: 8 }, (_, i) => ({
      page: i + 2,
      text: `${header(i + 2, i % 2 === 0)}${title}Artículo ${i}. Requisito sobre ${topic(i)}.\n${body(i)}`,
    }));
    const out = stripPageFurniture(pages);
    for (const [i, p] of out.entries()) {
      expect(p.text.startsWith(`Artículo ${i}.`)).toBe(true);
    }
  });

  it('keeps everything on short documents and in the body of the page', () => {
    const pages = [
      { page: 1, text: 'Title\nIntro text' },
      { page: 2, text: 'Title\nMore text' },
    ];
    expect(stripPageFurniture(pages)).toEqual(pages);
  });
});

describe('mergeRetrievals', () => {
  const chunk = (text: string, page: number, distance: number): RetrievedChunk => ({
    text,
    page,
    distance,
    source: SOURCE,
  });

  it('keeps the best distance per chunk across query languages and caps at k', () => {
    const spanish = [chunk('a', 1, 0.6), chunk('b', 2, 0.3)];
    const english = [chunk('a', 1, 0.2), chunk('c', 3, 0.25)];
    const merged = mergeRetrievals([spanish, english], 2);
    expect(merged.map((c) => [c.text, c.distance])).toEqual([
      ['a', 0.2],
      ['c', 0.25],
    ]);
  });
});

describe('retrieveBilingual', () => {
  const hit = (text: string, distance: number): RetrievedChunk => ({
    text,
    page: 84,
    distance,
    source: SOURCE,
  });

  it('also searches with the English translation and keeps what passes', async () => {
    const search = async (q: string) =>
      q.startsWith('Is hair') ? [hit('avoid routine hair removal', 0.22)] : [];
    const found = await retrieveBilingual('¿Se recomienda rasurar el vello?', {
      search,
      translate: async () => 'Is hair removal recommended?',
    });
    expect(found.map((c) => c.text)).toEqual(['avoid routine hair removal']);
  });

  it('falls back to the original question when translation fails or returns nothing', async () => {
    const asked: string[] = [];
    const search = async (q: string) => {
      asked.push(q);
      return [hit('resolución', 0.3)];
    };
    const failing = await retrieveBilingual('¿Qué exige la Resolución 3100?', {
      search,
      translate: async () => {
        throw new Error('groq down');
      },
    });
    expect(failing).toHaveLength(1);
    await retrieveBilingual('hola', { search, translate: async () => null });
    expect(asked).toEqual(['¿Qué exige la Resolución 3100?', 'hola']);
  });
});
