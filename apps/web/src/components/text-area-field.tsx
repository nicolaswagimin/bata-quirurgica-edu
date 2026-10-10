import type { ComponentProps } from 'react';

type TextAreaFieldProps = ComponentProps<'textarea'> & {
  id: string;
  label: string;
  error?: string;
};

export function TextAreaField({ id, label, error, ...rest }: TextAreaFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-11 rounded-card border border-border bg-bg px-3 py-2 text-base text-ink aria-invalid:border-danger"
        {...rest}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
