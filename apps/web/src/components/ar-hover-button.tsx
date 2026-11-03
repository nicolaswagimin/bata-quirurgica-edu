import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react';

/** Registry the AR loop reads every frame: which elements can be "pressed" by holding a hand. */
export type ArTargetRegistry = {
  register: (id: string, el: HTMLElement, onActivate: () => void) => () => void;
};

export const ArTargetsContext = createContext<ArTargetRegistry | null>(null);

const RING = 2 * Math.PI * 46;

/**
 * Big touch-free button over the camera image: hold a hand over it for a second (the ring fills)
 * or tap it. The loop writes the progress to the `--dwell` custom property, so React never
 * re-renders per frame.
 */
export function ArHoverButton({
  id,
  label,
  onActivate,
  icon,
  tone = 'primary',
  size = 'lg',
}: {
  id: string;
  label: string;
  onActivate: () => void;
  icon?: ReactNode;
  tone?: 'primary' | 'quiet';
  size?: 'lg' | 'sm';
}) {
  const registry = useContext(ArTargetsContext);
  const ref = useRef<HTMLButtonElement>(null);
  const action = useRef(onActivate);
  action.current = onActivate;

  useEffect(() => {
    const el = ref.current;
    if (!registry || !el) return;
    return registry.register(id, el, () => action.current());
  }, [registry, id]);

  const dims = size === 'lg' ? 'size-32 text-base md:size-36' : 'size-20 text-xs';
  const colors =
    tone === 'primary'
      ? 'bg-primary/90 text-bg shadow-float'
      : 'bg-ink/55 text-bg ring-2 ring-bg/70 backdrop-blur-sm';

  return (
    <button
      ref={ref}
      type="button"
      data-ar-target={id}
      onClick={() => action.current()}
      className={`pressable relative grid place-items-center rounded-pill font-extrabold ${dims} ${colors}`}
      style={{ '--dwell': 0 } as CSSProperties}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full -rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="5"
        />
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="var(--color-bg)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={RING}
          style={{ strokeDashoffset: `calc(${RING} * (1 - var(--dwell)))` }}
        />
      </svg>
      <span className="relative flex flex-col items-center gap-1 px-3 text-center leading-tight">
        {icon}
        {label}
      </span>
    </button>
  );
}
