import type { ReactNode } from 'react';

// Line pictograms for UI chrome (tabs, buttons): 24 px grid, 2 px stroke, round joins. Mission
// icons, badges and the mascot are pixel art instead (src/art/sprites.ts).
// Mission keys match `iconKey` in content/questions/seed.json.
const PATHS = {
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9.5 12h5M12 9.5v5" />
    </>
  ),
  gown: (
    <>
      <path d="M9 3 4 6.5l2 4 1.5-1V21h9V9.5l1.5 1 2-4L15 3c-.7 1.2-1.8 2-3 2s-2.3-.8-3-2Z" />
      <path d="M12 5v16" />
    </>
  ),
  gloves: (
    <>
      <path d="M8 21v-5l-3-4.5a1.5 1.5 0 0 1 2.5-1.7L9 12V5a1.3 1.3 0 0 1 2.6 0v5-6.3a1.3 1.3 0 0 1 2.6 0V10V5a1.3 1.3 0 0 1 2.6 0v8.5c0 2.3-1 3.7-2.3 4.5v3" />
      <path d="M8 18h8.5" />
    </>
  ),
  field: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M3 9h3M18 9h3M3 15h3M18 15h3" />
    </>
  ),
  checklist: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 3v2h6V3" />
      <path d="m8.5 10 1.2 1.2 2-2M8.5 15l1.2 1.2 2-2M14 10.5h2M14 15.5h2" />
    </>
  ),
  ask: (
    <>
      <path d="M5.5 18.5 4 21l3.4-1.2A8.5 8.5 0 1 0 5.5 18.5Z" />
      <path d="M9 11.5h6M12 8.5v6" />
    </>
  ),
  check: <path d="M5 13l4 4L19 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  home: <path d="M4 10.5 12 4l8 6.5V20h-5v-5.5H9V20H4z" />,
  rank: <path d="M4 20h16M6 20v-6h4v6M10 20V9h4v11M14 20v-8h4v8" />,
  cube: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  mirror: (
    <>
      <rect x="6" y="3" width="12" height="15" rx="6" />
      <path d="M12 18v3M9 21h6M9.5 9.5l2-2M10 13l4-4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type PictogramName = keyof typeof PATHS;

export function isPictogramName(value: string): value is PictogramName {
  return value in PATHS;
}

export function Pictogram({
  name,
  className = 'size-6',
  strokeWidth = 2,
}: {
  name: PictogramName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`flex-none ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
