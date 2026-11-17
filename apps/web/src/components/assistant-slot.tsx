import { type ComponentType, lazy } from 'react';
import { useAuth } from '../lib/firebase.tsx';
import { MentaCompanion } from './menta-companion.tsx';

// Menta owns the trigger; the chat stays in a separate, prefetched chunk.
const panels = import.meta.glob<{
  default: ComponentType<{ open: boolean; onClose: () => void }>;
}>('../assistant/menta-chat-panel.tsx');
const loader = Object.values(panels)[0];
if (!loader) throw new Error('Falta el panel de la Dra. Menta');
const MentaChatPanel = lazy(loader);
const prefetch = () => {
  void loader();
};

export function AssistantSlot() {
  const { user } = useAuth();
  if (!user) return null;
  return <MentaCompanion key={user.uid} ChatPanel={MentaChatPanel} prefetch={prefetch} />;
}
