import { buttonPrimary, buttonSecondary } from './ui-classes.ts';

/** Confirmation before leaving a mission in progress: the attempt closes and does not count. */
export function ExitDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="salir-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-card bg-bg p-6 shadow-sheet">
        <h2 id="salir-titulo" className="text-xl font-extrabold text-ink">
          ¿Salir de la misión?
        </h2>
        <p className="text-sm text-muted">
          Las preguntas sin responder contarán como no respondidas y esta misión no dará XP.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onConfirm} className={buttonSecondary}>
            Sí, salir
          </button>
          <button type="button" onClick={onCancel} className={buttonPrimary}>
            Seguir respondiendo
          </button>
        </div>
      </div>
    </div>
  );
}
