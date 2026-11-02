import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DONNING_MODEL_COUNT, stepModelUrl } from '../../src/three/steps.ts';

const PUBLIC = resolve(import.meta.dirname, '..', '..', 'public');
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_TRIANGLES = 80_000;

type GltfJson = {
  extensionsRequired?: string[];
  skins?: unknown[];
  animations?: unknown[];
  accessors: { count: number }[];
  meshes: { primitives: { indices?: number }[] }[];
};

function jsonChunk(glb: Buffer): GltfJson {
  expect(glb.readUInt32LE(0)).toBe(0x46546c67);
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as GltfJson;
}

describe('stepModelUrl', () => {
  it('maps donning steps to their model and leaves doffing to the mannequin', () => {
    expect(stepModelUrl('donning', 1)).toBe('/models/paso-1.glb');
    expect(stepModelUrl('donning', DONNING_MODEL_COUNT)).toBe('/models/paso-6.glb');
    expect(stepModelUrl('donning', 7)).toBeNull();
    expect(stepModelUrl('doffing', 1)).toBeNull();
  });
});

describe('donning step models', () => {
  it.each([1, 2, 3, 4, 5, 6])('paso-%i.glb is static, compressed and within budget', async (n) => {
    const glb = await readFile(join(PUBLIC, 'models', `paso-${n}.glb`));
    expect(glb.byteLength).toBeLessThanOrEqual(MAX_BYTES);
    const json = jsonChunk(glb);
    expect(json.skins ?? []).toEqual([]);
    expect(json.animations ?? []).toEqual([]);
    expect(json.extensionsRequired).toContain('KHR_draco_mesh_compression');
    let triangles = 0;
    for (const mesh of json.meshes) {
      for (const { indices } of mesh.primitives) {
        triangles += (json.accessors[indices ?? -1]?.count ?? 0) / 3;
      }
    }
    expect(triangles).toBeGreaterThan(1000);
    expect(triangles).toBeLessThanOrEqual(MAX_TRIANGLES);
  });

  it('ships the self-hosted Draco decoder', async () => {
    for (const file of ['draco_decoder.wasm', 'draco_wasm_wrapper.js', 'draco_decoder.js']) {
      expect((await readFile(join(PUBLIC, 'draco', file))).byteLength).toBeGreaterThan(0);
    }
  });
});
