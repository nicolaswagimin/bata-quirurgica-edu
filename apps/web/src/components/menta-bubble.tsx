import { type RefObject, useEffect, useRef, useState } from 'react';
import type { MentaMessage } from '../lib/menta-messages.ts';

export function MentaBubble({
  message,
  serial,
  open,
  mascotRef,
  onClose,
  onMute,
}: {
  message: MentaMessage | null;
  serial: number;
  open: boolean;
  mascotRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onMute: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const bubble = useRef<HTMLDivElement>(null);
  const dismiss = (mute = false) => {
    if (mute || bubble.current?.contains(document.activeElement)) mascotRef.current?.focus();
    if (mute) onMute();
    else onClose();
  };
  const close = useRef(dismiss);
  close.current = dismiss;
  useEffect(() => {
    if (!serial || !open || hovered || focused) return;
    const timer = window.setTimeout(() => close.current(), 10_000);
    return () => window.clearTimeout(timer);
  }, [open, hovered, focused, serial]);
  return (
    <div
      ref={bubble}
      data-testid="menta-bubble"
      data-open={open}
      aria-hidden={!open}
      inert={!open}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className="absolute right-0 bottom-full mb-3 w-[17rem] max-w-[calc(100vw-1.5rem)] origin-bottom-right translate-y-2 scale-[.96] rounded-card bg-bg p-4 text-sm text-ink opacity-0 shadow-sheet transition-[opacity,transform] duration-(--duration-fast) ease-(--ease-out) data-[open=true]:translate-y-0 data-[open=true]:scale-100 data-[open=true]:opacity-100 data-[open=true]:duration-(--duration-base) data-[open=false]:pointer-events-none motion-reduce:transform-none"
    >
      {message?.kind === 'fact' ? <p className="font-pixel text-sm">¿Sabías que…?</p> : null}
      <p>{message?.text}</p>
      {message?.kind === 'fact' ? (
        <p className="mt-2 text-xs text-muted">Fuente: {message.source}</p>
      ) : null}
      <p className="mt-2 text-xs text-primary">
        <span className="font-pixel">— Dra. Menta</span> · asistente virtual
      </p>
      <div className="mt-2 flex gap-4 text-primary">
        <button
          type="button"
          className="pressable min-h-6 underline"
          onClick={() => {
            mascotRef.current?.focus();
            dismiss();
          }}
        >
          Cerrar
        </button>
        <button type="button" className="pressable min-h-6 underline" onClick={() => dismiss(true)}>
          Silenciar
        </button>
      </div>
      <span aria-hidden="true" className="absolute right-5 -bottom-1.5 size-3 rotate-45 bg-bg" />
    </div>
  );
}
