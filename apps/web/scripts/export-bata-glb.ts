// Exports the procedural mannequin + surgical gown (src/three/bata-model.ts) to
// public/models/bata.glb for "Ver en tu espacio". Deterministic: same code → same bytes, and
// test/unit/bata-model.test.ts fails if the committed file drifts from this script's output.
// Colours come from the design tokens in src/styles.css. Static: no rig, no animations, no textures.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { type BataColors, buildBataModel, countTriangles } from '../src/three/bata-model.ts';

export const MAX_GLB_BYTES = 2 * 1024 * 1024;

const webRoot = resolve(import.meta.dirname, '..');
export const GLB_PATH = join(webRoot, 'public', 'models', 'bata.glb');

// GLTFExporter assembles the GLB through FileReader, which Node does not ship; Blob it does.
class BlobFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;

  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob: Blob): void {
    void blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onloadend?.();
    });
  }
}

function ensureFileReader(): void {
  if (typeof globalThis.FileReader === 'undefined') {
    Object.assign(globalThis, { FileReader: BlobFileReader });
  }
}

export async function readThemeColors(): Promise<BataColors> {
  const css = await readFile(join(webRoot, 'src', 'styles.css'), 'utf8');
  const token = (name: string): string => {
    const value = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(css)?.[1];
    if (!value) throw new Error(`Falta el token --color-${name} en styles.css`);
    return value;
  };
  return { body: token('border'), gown: token('primary'), trim: token('primary-strong') };
}

export async function exportBataGlb(): Promise<{ glb: Uint8Array; triangles: number }> {
  ensureFileReader();
  const model = buildBataModel(await readThemeColors());
  const result = await new GLTFExporter().parseAsync(model, { binary: true });
  if (!(result instanceof ArrayBuffer)) throw new Error('GLTFExporter no devolvió un GLB binario');
  const glb = new Uint8Array(result);
  if (glb.byteLength > MAX_GLB_BYTES) {
    throw new Error(`bata.glb pesa ${glb.byteLength} bytes; el máximo es ${MAX_GLB_BYTES}`);
  }
  return { glb, triangles: countTriangles(model) };
}

async function main(): Promise<void> {
  const { glb, triangles } = await exportBataGlb();
  await mkdir(dirname(GLB_PATH), { recursive: true });
  await writeFile(GLB_PATH, glb);
  const kb = (glb.byteLength / 1024).toFixed(1);
  console.log(`bata.glb escrito en ${GLB_PATH}: ${kb} KB, ${triangles} triángulos`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
