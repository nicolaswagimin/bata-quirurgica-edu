import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { type Group, NeutralToneMapping } from 'three';
import { ramp } from './garment.ts';
import { CHAPTER_SECONDS, createProcedure, PROCEDURE_MODEL } from './procedure.ts';

type Props = {
  label: string;
  /** Size of the canvas box; the AR step preview uses a small thumbnail. */
  className?: string;
  time: number;
  playing: boolean;
  onTime: (seconds: number) => void;
  onShown: (url: string) => void;
  hotspotIds: string[];
  activeHotspotId: string | null;
};
function Performance({
  time,
  playing,
  onTime,
  onShown,
  hotspotIds,
  activeHotspotId,
}: Omit<Props, 'label' | 'className'>) {
  const { scene } = useGLTF(PROCEDURE_MODEL, '/draco/');
  const stage = useMemo(() => createProcedure(scene), [scene]);
  const markers = useRef(new Map<string, Group>());
  const lastFrame = useRef(-1);
  const clock = useRef(time),
    reported = useRef(time);
  useEffect(() => {
    if (time !== reported.current) clock.current = time;
  }, [time]);
  useEffect(() => {
    onShown(PROCEDURE_MODEL);
    return () => stage.dispose();
  }, [stage, onShown]);
  useFrame((_, delta) => {
    if (playing)
      clock.current = Math.min(CHAPTER_SECONDS * 10, clock.current + Math.min(delta, 0.15));
    const t = clock.current / CHAPTER_SECONDS;
    if (lastFrame.current === t) return;
    lastFrame.current = t;
    const anchors = stage.draw(t);
    stage.scene.rotation.y = -1.5 * ramp(t, 3, 3.4) * (1 - ramp(t, 3.85, 4.2));
    stage.scene.updateMatrixWorld(true);
    for (const [id, m] of markers.current) {
      const point = anchors[id];
      if (point) m.position.copy(point).applyMatrix4(stage.scene.children[0]!.matrixWorld);
    }
    if (
      playing &&
      (clock.current - reported.current >= 0.09 ||
        clock.current === 60 ||
        clock.current < reported.current)
    ) {
      reported.current = clock.current;
      onTime(clock.current);
    }
  });
  return (
    <>
      <primitive object={stage.scene} />
      {hotspotIds.map((id) => (
        <group
          key={id}
          ref={(g) => {
            if (g) markers.current.set(id, g);
            else markers.current.delete(id);
          }}
        >
          <Html center zIndexRange={[10, 0]}>
            <span
              className={`block size-3 rounded-pill border-2 border-bg ${id === activeHotspotId ? 'bg-seal' : 'bg-primary'}`}
            />
          </Html>
        </group>
      ))}
    </>
  );
}
export function ProcedureViewer({
  label,
  className = 'h-96 w-full sm:h-[32rem]',
  ...props
}: Props) {
  return (
    <div role="img" aria-label={label} className={className}>
      <Canvas
        camera={{ position: [1.65, 1.6, 2.65], fov: 36 }}
        dpr={[1, 1.6]}
        gl={{ toneMapping: NeutralToneMapping }}
      >
        <color attach="background" args={['#e7efed']} />
        <hemisphereLight intensity={2.2} groundColor={0xb4c5c5} />
        <directionalLight position={[-3, 4, 3]} intensity={2.35} />
        <directionalLight position={[2, 3, -3]} intensity={1.4} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0]}>
          <circleGeometry args={[2.4, 64]} />
          <meshStandardMaterial color="#cadbd7" roughness={1} />
        </mesh>
        <Suspense fallback={null}>
          <Performance {...props} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          target={[0, 1.0, 0]}
          minDistance={1.65}
          maxDistance={4.2}
          maxPolarAngle={Math.PI * 0.52}
        />
      </Canvas>
    </div>
  );
}
