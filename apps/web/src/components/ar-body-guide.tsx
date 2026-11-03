/** Dashed full-body outline shown while framing: "fit yourself inside this shape". */
export function ArBodyGuide({ fitted }: { fitted: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 520"
      className={`pointer-events-none absolute top-1/2 left-1/2 h-[72%] -translate-x-1/2 -translate-y-1/2 transition-[color,opacity] duration-(--duration-base) ${
        fitted ? 'text-success opacity-100' : 'text-bg opacity-80'
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeDasharray="14 10"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="100" cy="46" r="34" />
      <path d="M58 96c-22 6-34 22-36 46l-8 132c-1 12 16 14 19 2l20-110 4 104-6 220c0 14 24 14 26 0l23-170 23 170c2 14 26 14 26 0l-6-220 4-104 20 110c3 12 20 10 19-2l-8-132c-2-24-14-40-36-46-12-4-26-6-42-6s-30 2-42 6Z" />
    </svg>
  );
}
