import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { type Material, Mesh } from 'three';

export const DRACO_DECODER_PATH = '/draco/';

const FADE_SECONDS = 0.45;

type FadeMaterial = { material: Material; opacity: number };

// The exporter marks every textured material as blended, and blended meshes are drawn in the wrong
// order (lips over the mask). Only lashes, brows and the mask's ear loops use alpha: a cutout handles
// those. Skin must stay opaque, its texture has low-alpha areas a cutout would punch holes through.
const CUTOUT_MATERIALS = /eyebrow|eyelash|mouth_protection/i;

function fadeable(material: Material | Material[]): FadeMaterial {
  const clone = (Array.isArray(material) ? material[0] : material)?.clone() as Material;
  const opacity = clone.opacity;
  if (CUTOUT_MATERIALS.test(clone.name)) clone.alphaTest = 0.5;
  clone.transparent = true;
  // glTF loading turns depth writes off for blended materials; without them the inside of the cap
  // draws over the face.
  clone.depthWrite = true;
  clone.opacity = 0;
  return { material: clone, opacity };
}

type ModelLayerProps = {
  url: string;
  yaw: number;
  // The step the user asked for: once loaded it takes over from the visible layer.
  requested: boolean;
  visible: boolean;
  animate: boolean;
  onReady: (url: string) => void;
  onShown: (url: string) => void;
  onHidden: (url: string) => void;
};

// One step's static GLB. Each layer owns cloned materials so two steps can crossfade independently.
export function ModelLayer({
  url,
  yaw,
  requested,
  visible,
  animate,
  onReady,
  onShown,
  onHidden,
}: ModelLayerProps) {
  const { scene } = useGLTF(url, DRACO_DECODER_PATH);
  const { model, materials } = useMemo(() => {
    const clone = scene.clone(true);
    const list: FadeMaterial[] = [];
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const fading = fadeable(object.material);
      object.material = fading.material;
      list.push(fading);
    });
    return { model: clone, materials: list };
  }, [scene]);
  const fade = useRef(0);
  const settled = useRef(false);
  const wasVisible = useRef(false);

  // Runs after mount, so only once the GLB has loaded: Suspense holds this component until then.
  useEffect(() => {
    if (requested) onReady(url);
  }, [requested, url, onReady]);

  // A new visible state restarts the wait for the fade to finish.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `visible` is the trigger, not a value read here.
  useEffect(() => {
    settled.current = false;
  }, [visible]);

  useEffect(
    () => () => {
      for (const { material } of materials) material.dispose();
    },
    [materials],
  );

  useFrame((_, delta) => {
    const target = visible ? 1 : 0;
    if (fade.current === target) {
      // A layer still waiting its turn is at 0 too, but it has not been shown: it must stay mounted.
      if (settled.current) return;
      if (visible) {
        settled.current = true;
        for (const { material } of materials) {
          material.transparent = false;
          material.needsUpdate = true;
        }
        onShown(url);
      } else if (!requested && wasVisible.current) {
        settled.current = true;
        onHidden(url);
      }
      return;
    }
    wasVisible.current = true;
    const step = animate ? delta / FADE_SECONDS : 1;
    fade.current =
      target > fade.current
        ? Math.min(target, fade.current + step)
        : Math.max(target, fade.current - step);
    for (const { material, opacity } of materials) {
      if (!material.transparent) {
        material.transparent = true;
        material.needsUpdate = true;
      }
      material.opacity = opacity * fade.current;
    }
  });

  return <primitive object={model} rotation={[0, yaw, 0]} />;
}
