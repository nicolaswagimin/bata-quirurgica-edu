// Self-hosts MediaPipe for the AR mirror so the AR page only talks to its own origin:
//   1. copies the WASM runtime shipped inside @mediapipe/tasks-vision → public/mediapipe/wasm/
//   2. downloads the pose landmarker lite model once → public/mediapipe/pose_landmarker_lite.task
// Idempotent: re-running re-copies the WASM (cheap) and skips the model if it already exists.
// Output dir is gitignored; CI and deploy run this script before building.
import { access, cp, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

const webRoot = resolve(import.meta.dirname, '..');
const outDir = join(webRoot, 'public', 'mediapipe');
const wasmSrc = join(webRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const modelPath = join(outDir, 'pose_landmarker_lite.task');

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (!(await exists(wasmSrc))) {
    throw new Error(`No se encontró el runtime WASM en ${wasmSrc}. ¿Corriste pnpm install?`);
  }
  await mkdir(outDir, { recursive: true });
  await cp(wasmSrc, join(outDir, 'wasm'), { recursive: true });
  console.log(`WASM copiado a ${join(outDir, 'wasm')}`);

  if (await exists(modelPath)) {
    console.log(`Modelo ya presente: ${modelPath}`);
    return;
  }
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(`Descarga del modelo falló: HTTP ${response.status}`);
  }
  await writeFile(modelPath, Buffer.from(await response.arrayBuffer()));
  console.log(`Modelo descargado: ${modelPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
