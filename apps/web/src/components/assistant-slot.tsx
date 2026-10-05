import { type ComponentType, lazy, Suspense } from 'react';
import { useAuth } from '../lib/firebase.tsx';

// The panel is optional: until src/assistant/assistant-panel.tsx exists the glob is empty.
const panels = import.meta.glob<{ default: ComponentType }>('../assistant/assistant-panel.tsx');
const loader = Object.values(panels)[0];
const AssistantPanel = loader ? lazy(loader) : null;

export function AssistantSlot() {
  const { user } = useAuth();
  if (!user || !AssistantPanel) return null;
  return (
    <div className="fixed top-2 left-2 z-40">
      <Suspense fallback={null}>
        <AssistantPanel />
      </Suspense>
    </div>
  );
}
