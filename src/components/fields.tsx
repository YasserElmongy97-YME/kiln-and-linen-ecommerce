import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface ShellProps {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}

function FieldShell({ name, label, error, hint, children }: ShellProps & { children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && !error && <span id={`${name}-hint`} className="hint">{hint}</span>}
      {error && <span id={`${name}-error`} className="field-error">{error}</span>}
    </div>
  );
}

const describedBy = ({ name, error, hint }: Pick<ShellProps, "name" | "error" | "hint">) =>
  error ? `${name}-error` : hint ? `${name}-hint` : undefined;

export function TextField({ name, label, error, hint, ...props }: ShellProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell name={name} label={label} error={error} hint={hint}>
      <input id={name} name={name} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy({ name, error, hint })} {...props} />
    </FieldShell>
  );
}

export function TextAreaField({ name, label, error, hint, ...props }: ShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell name={name} label={label} error={error} hint={hint}>
      <textarea id={name} name={name} className="textarea" aria-invalid={error ? true : undefined} aria-describedby={describedBy({ name, error, hint })} {...props} />
    </FieldShell>
  );
}

export function SelectField({ name, label, error, hint, children, ...props }: ShellProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell name={name} label={label} error={error} hint={hint}>
      <select id={name} name={name} className="select" aria-invalid={error ? true : undefined} aria-describedby={describedBy({ name, error, hint })} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

/** Announces form-level errors to assistive technology as soon as they appear. */
export function FormMessage({ message }: { message: string | null }) {
  return <div role="alert">{message && <p className="alert alert-error">{message}</p>}</div>;
}
