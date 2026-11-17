import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MISTAKE_ART } from '../src/art/mistake-art.ts';
import { MistakePair } from '../src/components/mistake-pair.tsx';

const output = process.argv[2];
if (!output) throw new Error('Uso: tsx scripts/mistake-sheet.tsx <out.html>');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const tokens = styles.match(/--color-[\w-]+:\s*[^;]+;/g)?.join('\n');
if (!tokens) throw new Error('No se encontraron los tokens de color.');
const lessons = JSON.parse(
  readFileSync(new URL('../../../content/lecciones/lecciones.json', import.meta.url), 'utf8'),
) as { lessons: { missionId: string; mistakes: { id: string; wrong: string }[] }[] };
const title = 'Errores frecuentes — lámina para aprobar';
const css = `
:root { ${tokens} }
* { box-sizing: border-box; }
body { margin: 0; background: var(--color-bg); color: var(--color-ink); font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 760px; margin: auto; padding: 16px; }
h1 { font-size: 24px; line-height: 1.25; }
h2 { font-size: 20px; line-height: 1.375; }
section { padding: 16px 0 24px; border-bottom: 1px solid var(--color-border); break-inside: avoid; }
p { margin: 0; }
.grid { display: grid; } .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.gap-2 { gap: 8px; } .gap-1 { gap: 4px; } .m-0 { margin: 0; } .min-w-0 { min-width: 0; }
.flex { display: flex; } .justify-center { justify-content: center; } .items-center { align-items: center; }
.relative { position: relative; } .w-32 { width: 128px; }
@media (min-width: 768px) { .md\\:w-48 { width: 192px; } } .mt-2 { margin-top: 8px; } .mt-1 { margin-top: 4px; }
.rounded-card { border-radius: 12px; } .text-sm { font-size: 14px; line-height: 1.43; }
.font-bold { font-weight: 700; } .text-danger { color: var(--color-danger); } .text-success { color: var(--color-success); }
.block { display: block; } .h-full { height: 100%; } .w-full { width: 100%; } .size-5 { width: 20px; height: 20px; }
.shrink-0, .flex-none { flex-shrink: 0; } .pixelated { image-rendering: pixelated; shape-rendering: crispEdges; }
.tile-grid { background-color: var(--color-primary-soft); background-image: linear-gradient(var(--color-tile) 1px, transparent 1px), linear-gradient(90deg, var(--color-tile) 1px, transparent 1px); background-size: 16px 16px; background-position: -1px -1px; }
`;
const html = renderToStaticMarkup(
  <html lang="es-CO">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <style>{css}</style>
    </head>
    <body>
      <main>
        <h1>{title}</h1>
        {lessons.lessons.flatMap((lesson) =>
          lesson.mistakes.map((mistake) => {
            const pair = MISTAKE_ART.find(({ id }) => id === mistake.id);
            if (!pair) throw new Error(`Falta la ilustración ${mistake.id}`);
            const code = `M-${lesson.missionId.slice(1, 2).padStart(2, '0')}`;
            return (
              <section key={mistake.id} id={mistake.id}>
                <h2>
                  {code} · {mistake.wrong}
                </h2>
                <MistakePair pair={pair} />
              </section>
            );
          }),
        )}
      </main>
    </body>
  </html>,
);
writeFileSync(output, `<!doctype html>\n${html}\n`);
console.log(`Lámina: ${output} (${MISTAKE_ART.length} pares)`);
