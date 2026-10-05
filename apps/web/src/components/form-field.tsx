import type { ComponentProps } from 'react';

type FormFieldProps = ComponentProps<'input'> & {
  id: string;
  label: string;
  error?: string;
};

export function FormField({ id, label, error, ...input }: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-11 rounded-card border border-border bg-bg px-3 text-base text-ink aria-invalid:border-danger"
        {...input}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
