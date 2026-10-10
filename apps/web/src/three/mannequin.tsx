import { Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DoubleSide, type Group, type MeshStandardMaterial } from 'three';

type Vec3 = [number, number, number];

// Where each hotspot of bata-pasos.json sits on the mannequin; unknown ids are not drawn.
const HOTSPOT_POSITIONS: Record<string, Vec3> = {
  cuello: [0, 1.5, 0.12],
  punos: [0.36, 0.86, 0.08],
  'zona-esteril': [0, 1.18, 0.26],
  mangas: [-0.36, 1.2, 0.08],
  'cierre-posterior': [0, 1.12, -0.24],
};

const GOWN_TOP = 1.5;
const GOWN_HEIGHT = 1;
const ANIMATION_SPEED = 6;

// Reads a design token from styles.css so the scene uses the same palette as the UI.
function tokenColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
}

type SceneProps = {
  progress: number;
  animate: boolean;
  hotspotIds: string[];
  activeHotspotId: string | null;
};

function Scene({ progress, animate, hotspotIds, activeHotspotId }: SceneProps) {
  const colors = useMemo(
    () => ({
      body: tokenColor('border'),
      gown: tokenColor('primary'),
      sleeve: tokenColor('primary-strong'),
    }),
    [],
  );
  const current = useRef(progress);
  const gown = useRef<Group>(null);
  const sleeves = useRef<Group>(null);
  const gownMaterial = useRef<MeshStandardMaterial>(null);

  useFrame((_, delta) => {
    current.current = animate
      ? current.current + (progress - current.current) * Math.min(1, delta * ANIMATION_SPEED)
      : progress;
    const p = current.current;
    gown.current?.scale.set(1, Math.max(p, 0.001), 1);
    sleeves.current?.scale.setScalar(Math.max((p - 0.25) / 0.75, 0.001));
    if (gownMaterial.current) gownMaterial.current.opacity = Math.min(1, p * 2) * 0.9;
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 2]} intensity={1.2} />

      <group>
        <mesh position={[0, 1.66, 0]}>
          <sphereGeometry args={[0.12, 32, 16]} />
          <meshStandardMaterial color={colors.body} />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <capsuleGeometry args={[0.17, 0.5, 8, 24]} />
          <meshStandardMaterial color={colors.body} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.3, 1.12, 0]} rotation={[0, 0, side * 0.12]}>
              <capsuleGeometry args={[0.05, 0.55, 6, 16]} />
              <meshStandardMaterial color={colors.body} />
            </mesh>
            <mesh position={[side * 0.1, 0.45, 0]}>
              <capsuleGeometry args={[0.07, 0.75, 6, 16]} />
              <meshStandardMaterial color={colors.body} />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={gown} position={[0, GOWN_TOP, 0]}>
        <mesh position={[0, -GOWN_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[0.21, 0.33, GOWN_HEIGHT, 32, 1, true]} />
          <meshStandardMaterial
            ref={gownMaterial}
            color={colors.gown}
            side={DoubleSide}
            transparent
          />
        </mesh>
      </group>
      <group ref={sleeves}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.31, 1.12, 0]} rotation={[0, 0, side * 0.12]}>
            <cylinderGeometry args={[0.075, 0.07, 0.5, 20, 1, true]} />
            <meshStandardMaterial color={colors.sleeve} side={DoubleSide} />
          </mesh>
        ))}
      </group>

      {hotspotIds.map((id) => {
        const position = HOTSPOT_POSITIONS[id];
        if (!position) return null;
        const active = id === activeHotspotId;
        return (
          <Html key={id} position={position} center zIndexRange={[10, 0]}>
            <span
              aria-hidden="true"
              className={`block size-4 rounded-pill border-2 border-bg ${active ? 'bg-xp' : 'bg-info'}`}
            />
          </Html>
        );
      })}

      <OrbitControls enablePan={false} enableZoom={false} target={[0, 1.05, 0]} />
    </>
  );
}

type MannequinProps = SceneProps & { label: string };

// Procedural mannequin and gown (placeholder until a real asset exists, see /creditos).
export function Mannequin({ label, ...scene }: MannequinProps) {
  return (
    <div role="img" aria-label={label} className="h-80 w-full sm:h-[28rem]">
      <Canvas camera={{ position: [0, 1.1, 2.6], fov: 40 }} dpr={[1, 2]}>
        <Scene {...scene} />
      </Canvas>
    </div>
  );
}
