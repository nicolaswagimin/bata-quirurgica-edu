import { type RefObject, useEffect, useRef, useState } from 'react';
import type { MentaMessage } from '../lib/menta-messages.ts';
import { Pictogram } from './pictogram.tsx';

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
    const timer = window.setTimeout(() => close.current(), 8_000);
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
      className="absolute right-0 bottom-full mb-3 w-[calc(100vw-1.5rem)] max-w-[18.5rem] origin-bottom-right translate-y-2 scale-[.96] rounded-card bg-bg p-3 text-sm leading-snug text-ink opacity-0 shadow-sheet transition-[opacity,transform] duration-(--duration-fast) ease-(--ease-out) data-[open=true]:translate-y-0 data-[open=true]:scale-100 data-[open=true]:opacity-100 data-[open=true]:duration-(--duration-base) data-[open=false]:pointer-events-none motion-reduce:transform-none"
    >
      <p>
        {message?.kind === 'fact' ? <strong>¿Sabías que…? </strong> : null}
        {message?.text}
      </p>
      {message?.kind === 'fact' ? (
        <p className="mt-1 truncate text-xs text-muted" title={message.source}>
          Fuente: {message.shortSource}
        </p>
      ) : null}
      <div className="mt-1 flex items-center justify-between gap-1 text-primary">
        <span className="min-w-0 font-pixel text-xs leading-none whitespace-nowrap">
          Dra. Menta · asistente virtual
        </span>
        <div className="flex shrink-0">
          <button
            type="button"
            aria-label="Cerrar mensaje"
            title="Cerrar mensaje"
            className="pressable size-6"
            onClick={() => {
              mascotRef.current?.focus();
              dismiss();
            }}
          >
            <Pictogram name="close" />
          </button>
          <button
            type="button"
            aria-label="Silenciar a la Dra. Menta"
            title="Silenciar a la Dra. Menta"
            className="pressable size-6"
            onClick={() => dismiss(true)}
          >
            <Pictogram name="mute" />
          </button>
        </div>
      </div>
      <span aria-hidden="true" className="absolute right-5 -bottom-1.5 size-3 rotate-45 bg-bg" />
    </div>
  );
}
