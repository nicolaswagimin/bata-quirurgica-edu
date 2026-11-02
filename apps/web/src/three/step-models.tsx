import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { NeutralToneMapping, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Vec3 } from './mannequin-parts.ts';
import { DRACO_DECODER_PATH, ModelLayer } from './model-layer.tsx';
import { DONNING_MODEL_COUNT, stepModelUrl } from './steps.ts';

// Where each hotspot sits per donning step: the figure's arms and the gown move between steps.
const STEP_HOTSPOTS: Record<number, Record<string, Vec3>> = {
  2: { cuello: [0, 1.4, 0.42] },
  // Arms point at the camera here, so each marker goes on a different arm or they would overlap.
  3: { mangas: [-0.23, 1.3, 0.12], punos: [0.2, 1.24, 0.42] },
  4: { cuello: [0, 1.38, -0.08], 'cierre-posterior': [0, 1.0, -0.16] },
  5: { punos: [0.1, 1.13, 0.3] },
  6: { 'cierre-posterior': [0, 1.1, -0.17], 'zona-esteril': [0, 1.2, 0.17] },
};

// Step 2's gown would hide the figure holding it, and step 4 happens behind her: both turn to show it.
const STEP_YAW: Record<number, number> = { 2: Math.PI * 0.3, 4: Math.PI * 0.85 };

// Bounce light colour of the scene, not a UI colour, so it does not belong in the design tokens.
const GROUND_LIGHT = 0x8a8f90;

type StepModelsProps = {
  label: string;
  order: number;
  animate: boolean;
  hotspotIds: string[];
  activeHotspotId: string | null;
  onShown: (url: string) => void;
};

function neighbourUrls(order: number): string[] {
  return [order - 1, order + 1]
    .filter((o) => o >= 1 && o <= DONNING_MODEL_COUNT)
    .map((o) => stepModelUrl('donning', o))
    .filter((url): url is string => url !== null);
}

type Layer = { url: string; order: number };

// Neutral studio reflections, built in the browser (nothing downloaded). Without them the fabric
// reads darker and more saturated than in the approved Blender preview, lit by a grey world.
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const environment = generator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.75;
    return () => {
      scene.environment = null;
      environment.dispose();
      generator.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Scene({
  order,
  animate,
  hotspotIds,
  activeHotspotId,
  onShown,
}: Omit<StepModelsProps, 'label'>) {
  const url = stepModelUrl('donning', order) ?? '';
  const [layers, setLayers] = useState<Layer[]>([{ url, order }]);
  const [shown, setShown] = useState(url);

  useEffect(() => {
    setLayers((current) =>
      current.some((l) => l.url === url) ? current : [...current, { url, order }],
    );
    for (const neighbour of neighbourUrls(order)) useGLTF.preload(neighbour, DRACO_DECODER_PATH);
  }, [url, order]);

  const handleReady = useCallback((ready: string) => setShown(ready), []);
  const handleHidden = useCallback((hidden: string) => {
    setLayers((current) => current.filter((l) => l.url !== hidden));
  }, []);

  const positions = STEP_HOTSPOTS[order] ?? {};
  const yaw = STEP_YAW[order] ?? 0;
  return (
    <>
      <StudioEnvironment />
      <hemisphereLight intensity={1.9} groundColor={GROUND_LIGHT} />
      <directionalLight position={[1.5, 3, 2.5]} intensity={2.1} />
      <directionalLight position={[-2, 2, -2.5]} intensity={1} />

      {layers.map((layer) => (
        <Suspense key={layer.url} fallback={null}>
          <ModelLayer
            url={layer.url}
            yaw={STEP_YAW[layer.order] ?? 0}
            requested={layer.url === url}
            visible={layer.url === shown}
            animate={animate}
            onReady={handleReady}
            onShown={onShown}
            onHidden={handleHidden}
          />
        </Suspense>
      ))}

      <group rotation={[0, yaw, 0]}>
        {hotspotIds.map((id) => {
          const position = positions[id];
          if (!position) return null;
          return (
            <Html key={id} position={position} center zIndexRange={[10, 0]}>
              <span
                aria-hidden="true"
                className={`block size-4 rounded-pill border-2 border-bg ${id === activeHotspotId ? 'bg-xp' : 'bg-info'}`}
              />
            </Html>
          );
        })}
      </group>

      <OrbitControls enablePan={false} enableZoom={false} target={[0, 0.92, 0]} />
    </>
  );
}

// Donning steps: a static, realistic model per step with a crossfade between them.
export function StepModels({ label, ...scene }: StepModelsProps) {
  return (
    <div role="img" aria-label={label} className="h-80 w-full sm:h-[28rem]">
      <Canvas
        camera={{ position: [0, 1.05, 2.9], fov: 38 }}
        dpr={[1, 2]}
        gl={{ toneMapping: NeutralToneMapping }}
      >
        <Scene {...scene} />
      </Canvas>
    </div>
  );
}
