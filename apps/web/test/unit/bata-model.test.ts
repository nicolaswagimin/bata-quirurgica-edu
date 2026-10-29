import { readFile } from 'node:fs/promises';
import { Box3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { exportBataGlb, GLB_PATH, MAX_GLB_BYTES } from '../../scripts/export-bata-glb.ts';
import { buildBataModel, countTriangles, HEM_Y } from '../../src/three/bata-model.ts';

const COLORS = { body: '#d5e3dd', gown: '#127a5f', trim: '#0e5e49' };
const GLB_MAGIC = 0x46546c67; // "glTF"

type GltfJson = {
  asset: { version: string };
  nodes: { name?: string }[];
  materials: { name?: string; doubleSided?: boolean }[];
  skins?: unknown[];
  animations?: unknown[];
  images?: unknown[];
};

function parseGlb(glb: Uint8Array): GltfJson {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  expect(view.getUint32(0, true)).toBe(GLB_MAGIC);
  expect(view.getUint32(4, true)).toBe(2);
  expect(view.getUint32(8, true)).toBe(glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength))) as GltfJson;
}

describe('bata-model geometry', () => {
  const model = buildBataModel(COLORS);
  const box = new Box3().setFromObject(model);
  const offset = model.position.y;

  it('stands on the origin at real human scale in metres', () => {
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeGreaterThan(1.7);
    expect(box.max.y).toBeLessThan(1.85);
    expect(box.max.x - box.min.x).toBeLessThan(1);
  });

  it('ends at mid-calf, between ankle and knee', () => {
    const hem = HEM_Y + offset;
    expect(hem).toBeGreaterThan(0.2);
    expect(hem).toBeLessThan(0.4);
  });

  it('has long sleeves with cuffs, a crossed back wrap and back ties, but no collar or pockets', () => {
    const names = new Set<string>();
    model.traverse((object) => names.add(object.name));
    for (const name of [
      'gown-body',
      'gown-wrap-flap',
      'sleeve-left',
      'sleeve-right',
      'cuff-left',
      'cuff-right',
      'tie-waist',
      'tie-neck',
    ]) {
      expect(names).toContain(name);
    }
    expect([...names].filter((n) => /collar|pocket/i.test(n))).toEqual([]);

    const backTie = new Box3().setFromObject(model.getObjectByName('tie-waist') ?? model);
    expect(backTie.max.z).toBeLessThan(0);
  });

  it('stays light enough for phones', () => {
    expect(countTriangles(model)).toBeLessThan(50_000);
  });
});

describe('bata.glb export', () => {
  let glb: Uint8Array;
  beforeAll(async () => {
    ({ glb } = await exportBataGlb());
  });

  it('is a static glTF 2.0 binary under 2 MB with no rig, animations or textures', () => {
    expect(glb.byteLength).toBeLessThan(MAX_GLB_BYTES);
    const json = parseGlb(glb);
    expect(json.asset.version).toBe('2.0');
    expect(json.skins ?? []).toEqual([]);
    expect(json.animations ?? []).toEqual([]);
    expect(json.images ?? []).toEqual([]);
    expect(json.nodes.map((n) => n.name)).toContain('bata-quirurgica');
    const fabric = json.materials.find((m) => m.name === 'gown-fabric');
    expect(fabric?.doubleSided).toBe(true);
  });

  it('is reproducible and matches the committed public/models/bata.glb', async () => {
    const again = (await exportBataGlb()).glb;
    expect(Buffer.from(again).equals(Buffer.from(glb))).toBe(true);
    const committed = await readFile(GLB_PATH);
    expect(
      committed.equals(Buffer.from(glb)),
      'Corre pnpm --filter @bata/web run model:export',
    ).toBe(true);
  });
});
