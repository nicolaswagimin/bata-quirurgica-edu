import '@google/model-viewer';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const MODEL_URL = '/models/bata.glb';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src: string;
        ar?: boolean;
        'ar-modes'?: string;
        'camera-controls'?: boolean;
        alt: string;
      };
    }
  }
}

type ModelState = 'checking' | 'available' | 'missing';

// The SPA fallback answers unknown paths with index.html (200), so a real model must also not be
// HTML. Never give model-viewer a `src` that does not exist.
async function modelExists(signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(MODEL_URL, { method: 'HEAD', signal });
    const type = response.headers.get('content-type') ?? '';
    return response.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

export default function BataEspacioPage() {
  const [state, setState] = useState<ModelState>('checking');

  useEffect(() => {
    const controller = new AbortController();
    void modelExists(controller.signal).then((exists) => {
      if (!controller.signal.aborted) setState(exists ? 'available' : 'missing');
    });
    return () => controller.abort();
  }, []);

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Ver en tu espacio</h1>
      <p className="text-muted">
        Coloca la bata en tu entorno con la realidad aumentada de tu teléfono.
      </p>

      {state === 'checking' && <p className="text-sm text-muted">Buscando el modelo 3D…</p>}

      {state === 'available' && (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <model-viewer
            src={MODEL_URL}
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            alt="Bata quirúrgica en 3D"
            style={{ display: 'block', width: '100%', height: '28rem' }}
          />
        </div>
      )}

      {state === 'missing' && (
        <div role="status" className="rounded-card border border-border bg-surface p-6">
          <p className="font-medium text-ink">El modelo 3D definitivo aún no está disponible</p>
          <Link to="/bata-3d" className="mt-3 inline-block font-medium text-primary underline">
            Ver la bata en 3D
          </Link>
        </div>
      )}
    </section>
  );
}
