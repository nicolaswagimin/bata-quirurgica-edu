import '@google/model-viewer';
import { useEffect, useRef, useState } from 'react';

// Keep the same self-hosted decoder global as the spatial viewer, without enabling AR.
const globals = self as unknown as { ModelViewerElement?: Record<string, unknown> };
globals.ModelViewerElement = { ...globals.ModelViewerElement, dracoDecoderLocation: '/draco/' };

export function StepModelViewer({ modelUrl, title }: { modelUrl: string; title: string }) {
  const [state, setState] = useState<'checking' | 'loading' | 'ready' | 'missing'>('checking');
  const viewer = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(modelUrl, { method: 'HEAD', signal: controller.signal })
      .then((response) => {
        // A missing asset can return the SPA's HTML with status 200.
        const exists = response.ok && !response.headers.get('content-type')?.includes('text/html');
        if (!controller.signal.aborted) setState(exists ? 'loading' : 'missing');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('missing');
      });
    return () => controller.abort();
  }, [modelUrl]);

  const mounted = state === 'loading' || state === 'ready';
  useEffect(() => {
    const element = viewer.current;
    if (!mounted || !element) return;
    const loaded = () => setState('ready');
    const failed = () => setState('missing');
    element.addEventListener('load', loaded);
    element.addEventListener('error', failed);
    return () => {
      element.removeEventListener('load', loaded);
      element.removeEventListener('error', failed);
    };
  }, [mounted]);

  return (
    <div className="relative h-96 overflow-hidden rounded-card bg-surface shadow-sheet sm:h-[32rem]">
      {mounted && (
        <model-viewer
          ref={viewer}
          src={modelUrl}
          camera-controls
          environment-image="neutral"
          exposure={1.7}
          alt={`${title}, modelo 3D. Arrastra para girar y acerca para ver los detalles.`}
          className="block h-full w-full"
        />
      )}
      {state !== 'ready' && (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 top-0 p-4 text-sm text-muted"
        >
          {state === 'missing' ? 'Modelo no disponible' : 'Cargando modelo 3D…'}
        </p>
      )}
    </div>
  );
}
