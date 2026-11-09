// Non-woven (SMS polypropylene) fabric for the AR gown: a procedural fibre texture, a normal map
// derived from the same height field and a soft sheen, plus the light rig tuned to the camera
// image brightness. Everything is generated on the device: no texture is downloaded.
import * as THREE from 'three';

/** Deterministic value noise so tests and frames are reproducible. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * Height field of a spun-bond fabric: short random fibres (bright streaks) over a fine grain,
 * tileable (wraps at the edges). Values 0..1, row-major, `size × size`.
 */
export function fibreHeight(size: number, seed = 7): Float32Array {
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) field[y * size + x] = 0.35 + hash(x, y, seed) * 0.15;
  }
  const fibres = size * 6;
  for (let i = 0; i < fibres; i++) {
    const angle = hash(i, 1, seed) * Math.PI;
    const length = 4 + hash(i, 2, seed) * size * 0.08;
    const x0 = hash(i, 3, seed) * size;
    const y0 = hash(i, 4, seed) * size;
    const lift = 0.12 + hash(i, 5, seed) * 0.25;
    for (let s = 0; s < length; s++) {
      const x = Math.floor(x0 + Math.cos(angle) * s + size) % size;
      const y = Math.floor(y0 + Math.sin(angle) * s + size) % size;
      const k = y * size + x;
      field[k] = Math.min(1, (field[k] ?? 0) + lift);
    }
  }
  return field;
}

/** Tangent-space normal map (RGBA bytes) from a tileable height field, Sobel with wrap. */
export function normalsFromHeight(
  field: Float32Array,
  size: number,
  strength = 2,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const at = (x: number, y: number) => field[((y + size) % size) * size + ((x + size) % size)] ?? 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const k = (y * size + x) * 4;
      out[k] = ((-dx / len) * 0.5 + 0.5) * 255;
      out[k + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      out[k + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out[k + 3] = 255;
    }
  }
  return out;
}

/** Albedo bytes: the fabric colour modulated a little by the fibres (matte, low contrast). */
export function albedoFromHeight(field: Float32Array, size: number, rgb: [number, number, number]) {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const shade = 0.86 + (field[i] ?? 0) * 0.22;
    out[i * 4] = rgb[0] * shade;
    out[i * 4 + 1] = rgb[1] * shade;
    out[i * 4 + 2] = rgb[2] * shade;
    out[i * 4 + 3] = 255;
  }
  return out;
}

function dataTexture(bytes: Uint8ClampedArray, size: number, srgb: boolean): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array(bytes.buffer), size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Parses `#rrggbb` (the design token value) into bytes. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? Number.parseInt(m[1] as string, 16) : 0x32718e;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Matte non-woven material: fibre albedo + normal map, high roughness and a soft sheen. */
export function createNonwovenMaterial(fabricHex: string, size = 128): THREE.MeshPhysicalMaterial {
  const field = fibreHeight(size);
  const material = new THREE.MeshPhysicalMaterial({
    map: dataTexture(albedoFromHeight(field, size, hexToRgb(fabricHex)), size, true),
    normalMap: dataTexture(normalsFromHeight(field, size), size, false),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.92,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xdfeff5),
    side: THREE.DoubleSide,
  });
  return material;
}

export interface LightLevels {
  hemisphere: number;
  key: number;
  fill: number;
  exposure: number;
}

/**
 * Light rig for the camera brightness (`luma` 0..255 from camera-quality's frame sample): a dim
 * room gets a dimmer, softer gown so it does not glow over the video; a bright one gets more key.
 */
export function lightForLuma(luma: number): LightLevels {
  const t = Math.min(1, Math.max(0, (luma - 40) / 160));
  return {
    hemisphere: 1.2 + t * 1.3,
    key: 1.4 + t * 2.2,
    fill: 0.6 + t * 0.7,
    exposure: 0.8 + t * 0.4,
  };
}

/** Eases the current levels towards the target so a flicker in the video does not pulse the gown. */
export function easeLights(current: LightLevels, target: LightLevels, k = 0.08): LightLevels {
  const mix = (a: number, b: number) => a + (b - a) * k;
  return {
    hemisphere: mix(current.hemisphere, target.hemisphere),
    key: mix(current.key, target.key),
    fill: mix(current.fill, target.fill),
    exposure: mix(current.exposure, target.exposure),
  };
}
