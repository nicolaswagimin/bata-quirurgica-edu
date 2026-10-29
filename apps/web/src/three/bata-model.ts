// Static 3D asset for "Ver en tu espacio": the procedural mannequin (mannequin-parts.ts) wearing a
// stylised surgical gown — long sleeves with knit cuffs, mid-calf length, no collar or pockets,
// back wrap that crosses over and ties at the waist and neck. Plain three.js, no DOM, so
// scripts/export-bata-glb.ts can export it to GLB in Node. Units are metres; origin at the feet.
import {
  Box3,
  CapsuleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { armPart, MANNEQUIN_PARTS, SIDES } from './mannequin-parts.ts';

export type BataColors = { body: string; gown: string; trim: string };

const SEGMENTS = 48;

/** Mid-calf, between the mannequin's ankle (~0.1 m) and knee (~0.47 m). */
export const HEM_Y = 0.3;

/** Gown silhouette as [radius, height] from hem to neckline; clears the mannequin everywhere. */
export const GOWN_PROFILE: [number, number][] = [
  [0.27, HEM_Y],
  [0.255, 0.45],
  [0.235, 0.7],
  [0.215, 0.9],
  [0.205, 1.15],
  [0.205, 1.38],
  [0.17, 1.48],
  [0.12, 1.535],
  [0.095, 1.555],
];

/** Open gap at the back (phi = π faces -z) that the wrap flap crosses over. */
const BACK_GAP = 0.25;
const WRAP_OFFSET = 0.008;
const WAIST_Y = 0.98;
const NECK_TIE_Y = 1.5;

/** Linear interpolation of GOWN_PROFILE; clamps to the last radius above the neckline. */
function gownRadiusAt(y: number): number {
  let [r0, y0] = GOWN_PROFILE[0] ?? [0, 0];
  for (const [r1, y1] of GOWN_PROFILE) {
    if (y <= y1) return y1 === y0 ? r1 : r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    [r0, y0] = [r1, y1];
  }
  return r0;
}

function lathe(profile: [number, number][], phiStart: number, phiLength: number): LatheGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    SEGMENTS,
    phiStart,
    phiLength,
  );
}

function named(mesh: Mesh, name: string): Mesh {
  mesh.name = name;
  return mesh;
}

function buildMannequin(material: MeshStandardMaterial): Group {
  const group = new Group();
  group.name = 'mannequin';
  for (const part of MANNEQUIN_PARTS) {
    const geometry =
      part.kind === 'sphere'
        ? new SphereGeometry(part.radius, 32, 16)
        : new CapsuleGeometry(part.radius, part.length, 8, 24);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...part.position);
    if (part.kind === 'capsule') mesh.rotation.z = part.rotationZ;
    group.add(mesh);
  }
  return group;
}

function buildSleeve(side: -1 | 1, gown: MeshStandardMaterial, trim: MeshStandardMaterial): Group {
  const arm = armPart(side);
  if (arm.kind !== 'capsule') throw new Error('El brazo debe ser una cápsula');
  const label = side < 0 ? 'right' : 'left';
  const group = new Group();
  group.name = `sleeve-${label}`;
  group.position.set(...arm.position);
  group.rotation.z = arm.rotationZ;

  // Local y runs along the arm (±0.325 m); the sleeve stops above the wrist where the cuff starts.
  const sleeve = lathe(
    [
      [0.072, -0.2],
      [0.078, 0],
      [0.085, 0.2],
      [0.09, 0.3],
    ],
    0,
    Math.PI * 2,
  );
  group.add(named(new Mesh(sleeve, gown), `sleeve-${label}-tube`));

  const cap = new SphereGeometry(0.09, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const capMesh = named(new Mesh(cap, gown), `sleeve-${label}-shoulder`);
  capMesh.position.y = 0.3;
  group.add(capMesh);

  const cuff = new CylinderGeometry(0.06, 0.058, 0.085, 24, 1, true);
  const cuffMesh = named(new Mesh(cuff, trim), `cuff-${label}`);
  cuffMesh.position.y = -0.2425;
  group.add(cuffMesh);

  // Gathered seam where the loose sleeve meets the tight knit cuff.
  const seam = named(new Mesh(new TorusGeometry(0.066, 0.008, 8, 24), trim), `cuff-${label}-seam`);
  seam.position.y = -0.2;
  seam.rotation.x = Math.PI / 2;
  group.add(seam);
  return group;
}

/** A bow at the back: knot, two loops and two hanging tails, facing -z at radius `r`. */
function buildBow(name: string, y: number, r: number, scale: number, trim: MeshStandardMaterial) {
  const group = new Group();
  group.name = name;
  group.position.set(0.03, y, -(r + 0.012));
  group.scale.setScalar(scale);

  const knot = new Mesh(new SphereGeometry(0.018, 12, 8), trim);
  knot.scale.set(1, 0.8, 0.6);
  group.add(knot);
  for (const s of SIDES) {
    const loop = new Mesh(new TorusGeometry(0.03, 0.007, 8, 20), trim);
    loop.position.set(s * 0.04, 0.005, 0);
    loop.scale.set(1, 0.6, 1);
    group.add(loop);
    const tail = new Mesh(new CylinderGeometry(0.008, 0.008, 0.2, 8), trim);
    tail.position.set(s * 0.025, -0.1, 0);
    tail.rotation.z = s * 0.18;
    tail.scale.set(1.6, 1, 0.4);
    group.add(tail);
  }
  return group;
}

export function buildBataModel(colors: BataColors): Group {
  const bodyMaterial = new MeshStandardMaterial({
    name: 'mannequin',
    color: colors.body,
    roughness: 0.6,
    metalness: 0,
  });
  const gownMaterial = new MeshStandardMaterial({
    name: 'gown-fabric',
    color: colors.gown,
    roughness: 0.85,
    metalness: 0,
    side: DoubleSide,
  });
  const trimMaterial = new MeshStandardMaterial({
    name: 'gown-trim',
    color: colors.trim,
    roughness: 0.9,
    metalness: 0,
    side: DoubleSide,
  });

  const root = new Group();
  root.name = 'bata-quirurgica';
  root.add(buildMannequin(bodyMaterial));

  const gown = new Group();
  gown.name = 'gown';
  root.add(gown);

  const panel = lathe(GOWN_PROFILE, Math.PI + BACK_GAP, Math.PI * 2 - BACK_GAP * 2);
  gown.add(named(new Mesh(panel, gownMaterial), 'gown-body'));

  // The wrap flap comes from the figure's left, crosses the back opening and overlaps the right edge.
  const flapProfile = GOWN_PROFILE.map(([r, y]): [number, number] => [r + WRAP_OFFSET, y]);
  const flap = lathe(flapProfile, Math.PI - BACK_GAP - 0.3, BACK_GAP * 2 + 0.45);
  gown.add(named(new Mesh(flap, gownMaterial), 'gown-wrap-flap'));

  const waistRadius = gownRadiusAt(WAIST_Y) + WRAP_OFFSET;
  const belt = named(
    new Mesh(new TorusGeometry(waistRadius + 0.004, 0.007, 8, SEGMENTS), trimMaterial),
    'tie-waist-belt',
  );
  belt.position.y = WAIST_Y;
  belt.rotation.x = Math.PI / 2;
  gown.add(belt);
  gown.add(buildBow('tie-waist', WAIST_Y, waistRadius, 1, trimMaterial));
  gown.add(buildBow('tie-neck', NECK_TIE_Y, gownRadiusAt(NECK_TIE_Y), 0.6, trimMaterial));

  for (const side of SIDES) gown.add(buildSleeve(side, gownMaterial, trimMaterial));

  // Lathe and capsule normals come out slightly off unit length; glTF requires unit normals.
  root.traverse((object) => {
    if (object instanceof Mesh) object.geometry.normalizeNormals();
  });

  // Origin at the base: the lowest point of the figure sits exactly on y = 0.
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  root.position.y = -box.min.y;
  root.updateMatrixWorld(true);
  return root;
}

export function countTriangles(root: Group): number {
  let total = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry;
    total += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  });
  return total;
}
