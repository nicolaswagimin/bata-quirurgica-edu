import { VIOLATION_TEXT, type Violation } from '../ar/posture.ts';

/** Live sterile-technique warnings. The region is assertive so a new warning is announced once. */
export function ArAlerts({ violations }: { violations: readonly Violation[] }) {
  return (
    <div aria-live="assertive" data-testid="ar-alerts" className="min-h-12">
      {violations.length > 0 ? (
        <ul className="flex flex-col gap-2 rounded-card bg-danger px-4 py-3 text-bg shadow-sheet">
          {violations.map((v) => (
            <li key={v} className="flex items-start gap-2 font-bold">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="mt-0.5 size-5 flex-none"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
              >
                <path d="M12 3 2 20h20L12 3Z" />
                <path d="M12 10v4M12 17.5v.01" />
              </svg>
              {VIOLATION_TEXT[v]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card bg-surface px-4 py-3 text-sm text-muted">
          Sin avisos: tus manos están en zona estéril.
        </p>
      )}
    </div>
  );
}
