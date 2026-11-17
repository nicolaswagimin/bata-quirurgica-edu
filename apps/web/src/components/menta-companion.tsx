import { useLocation } from '@tanstack/react-router';
import { type ComponentType, Suspense, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useMe } from '../lib/api.ts';
import { useAuth } from '../lib/firebase.tsx';
import {
  isMentaMuted,
  queueMentaEvent,
  setMentaMuted,
  takeMentaEvents,
} from '../lib/menta-events.ts';
import { type MentaMessage, type MotivationEvent, pickMessage } from '../lib/menta-messages.ts';
import { MascotAnimated } from './mascot-animated.tsx';
import { MentaBubble } from './menta-bubble.tsx';

const stateSchema = z.object({
  lastShownAt: z.number().finite().nullable(),
  greeted: z.boolean(),
  seenFacts: z.array(z.string()),
});
function readState(uid: string) {
  try {
    const parsed = stateSchema.safeParse(
      JSON.parse(sessionStorage.getItem(`bata.menta.state.${uid}`) ?? 'null'),
    );
    if (parsed.success) return parsed.data;
  } catch {
    /* Optional session storage. */
  }
  return { lastShownAt: null, greeted: false, seenFacts: [] };
}

export function MentaCompanion({
  ChatPanel,
  prefetch,
}: {
  ChatPanel: ComponentType<{ open: boolean; onClose: () => void }>;
  prefetch: () => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const chatOpenRef = useRef(false);
  const { pathname } = useLocation();
  const me = useMe();
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const mainScreen =
    ['/', '/ranking', '/perfil', '/bata-3d'].includes(pathname) || pathname.startsWith('/aprende');
  const hidden = pathname.startsWith('/mision/') || pathname === '/bata-ar';
  const scheduler = useRef(readState(uid));
  const pending = useRef<MotivationEvent[]>([]);
  const readyAt = useRef(Infinity);
  const current = useRef({ mainScreen, profile: me.data });
  current.current = { mainScreen, profile: me.data };
  const [shown, setShown] = useState<{
    message: MentaMessage;
    serial: number;
    path: string;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const serial = useRef(0);
  const openRef = useRef(false);
  const mascot = useRef<HTMLButtonElement>(null);
  const spaceArmed = useRef(false);

  const run = () => {
    if (
      chatOpenRef.current ||
      openRef.current ||
      Date.now() < readyAt.current ||
      !current.current.mainScreen ||
      document.hidden ||
      isMentaMuted()
    )
      return;
    pending.current.push(...takeMentaEvents(uid));
    const result = pickMessage(scheduler.current, {
      now: Date.now(),
      muted: false,
      visible: true,
      mainScreen: true,
      profile: current.current.profile ?? null,
      pending: pending.current,
    });
    pending.current = result.pending;
    if (!result.message) return;
    scheduler.current = result.state;
    try {
      sessionStorage.setItem(`bata.menta.state.${uid}`, JSON.stringify(result.state));
      sessionStorage.setItem(`bata.menta.pending.${uid}`, JSON.stringify(result.pending));
      pending.current = [];
    } catch {
      /* Optional storage. */
    }
    setShown({ message: result.message, serial: ++serial.current, path: pathname });
    openRef.current = true;
    setOpen(true);
    setSpeaking(true);
  };
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!pathname) return;
    chatOpenRef.current = false;
    setChatOpen(false);
    openRef.current = false;
    setOpen(false);
    readyAt.current = Date.now() + 2500;
    const timer = window.setTimeout(() => runRef.current(), 2500);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const check = () => runRef.current();
    const muted = () => {
      if (isMentaMuted()) {
        openRef.current = false;
        setOpen(false);
      } else check();
    };
    const timer = window.setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('menta:event', check);
    window.addEventListener('menta:muted', muted);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('menta:event', check);
      window.removeEventListener('menta:muted', muted);
      // Preserve events already taken from storage but not yet displayed.
      const remaining = pending.current.splice(0);
      for (const event of remaining) queueMentaEvent(uid, event);
    };
  }, [uid]);

  useEffect(() => {
    if (!me.data || me.data.uid !== uid) return;
    try {
      const previous = localStorage.getItem(`bata.menta.level.${uid}`);
      localStorage.setItem(`bata.menta.level.${uid}`, String(me.data.level));
      if (previous !== null && Number(previous) < me.data.level)
        queueMentaEvent(uid, { type: 'level', level: me.data.level });
    } catch {
      /* Optional level history. */
    }
  }, [me.data, uid]);

  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(
      () => setSpeaking(false),
      Math.min(shown.message.text.length * 28, 4000),
    );
    return () => window.clearTimeout(timer);
  }, [shown]);

  useEffect(() => {
    if (!open) runRef.current();
  }, [open]);

  const close = () => {
    openRef.current = false;
    setOpen(false);
  };

  if (hidden) return null;
  const visible = !chatOpen && open && shown?.path === pathname && mainScreen;
  const message = shown?.message;
  const announcement = message
    ? `${message.kind === 'fact' ? '¿Sabías que…? ' : ''}${message.text}${message.kind === 'fact' ? ` Fuente: ${message.source}` : ''}`
    : '';
  return (
    <div className="fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 md:right-6 md:bottom-6 print:hidden">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="menta-status"
      >
        {visible ? <span key={shown.serial}>{announcement}</span> : null}
      </div>
      <MentaBubble
        message={message ?? null}
        serial={shown?.serial ?? 0}
        open={!!visible}
        mascotRef={mascot}
        onClose={close}
        onMute={() => {
          setMentaMuted(true);
          close();
        }}
      />
      <button
        ref={mascot}
        type="button"
        aria-label="Hablar con la Dra. Menta, asistente virtual"
        aria-haspopup="dialog"
        aria-expanded={chatOpen}
        onMouseEnter={prefetch}
        onFocus={prefetch}
        onKeyDown={(event) => {
          if (event.key !== ' ' && event.key !== 'Enter') return;
          if (event.repeat) event.preventDefault();
          else if (event.key === ' ') spaceArmed.current = true;
        }}
        onKeyUp={(event) => {
          if (event.key !== ' ') return;
          // A key released after focus returns from the dialog must not activate us.
          if (!spaceArmed.current) event.preventDefault();
          spaceArmed.current = false;
        }}
        onBlur={() => {
          spaceArmed.current = false;
        }}
        style={{ opacity: chatOpen ? 0 : 1, transform: chatOpen ? 'scale(.97)' : undefined }}
        className="pressable motion-reduce:!transform-none transition-[transform,opacity] duration-(--duration-press) ease-(--ease-out) block h-[66px] w-12 rounded-card md:h-[88px] md:w-16"
        onClick={() => {
          if (chatOpenRef.current) return;
          chatOpenRef.current = true;
          close();
          setChatLoaded(true);
          setChatOpen(true);
        }}
      >
        <MascotAnimated speaking={!!visible && speaking} className="h-full w-full" />
      </button>
      {chatLoaded && (
        <Suspense fallback={null}>
          <ChatPanel
            open={chatOpen}
            onClose={() => {
              chatOpenRef.current = false;
              setChatOpen(false);
              mascot.current?.focus();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
