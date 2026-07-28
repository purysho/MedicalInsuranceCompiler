import React, { useId } from "react";

interface BaseFieldProps {
  label: string;
  helperText?: string;
  error?: string;
  required?: boolean;
}

/** Shared label + helper + error scaffold for text-like inputs. */
function FieldShell({
  label,
  helperText,
  error,
  required,
  htmlFor,
  describedBy,
  children,
}: BaseFieldProps & { htmlFor: string; describedBy?: string; children: React.ReactNode }) {
  return (
    <div className="alc-field">
      <label className="alc-field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="alc-field__req" aria-hidden="true">*</span>}
      </label>
      {children}
      {helperText && !error && (
        <span className="alc-field__helper" id={`${describedBy}-help`}>{helperText}</span>
      )}
      {error && (
        <span className="alc-field__error" id={`${describedBy}-err`} role="alert">
          <span aria-hidden="true">⚠</span> {error}
        </span>
      )}
    </div>
  );
}

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id">,
    BaseFieldProps {}

export function TextInput({ label, helperText, error, required, className, ...rest }: TextInputProps) {
  const id = useId();
  return (
    <FieldShell label={label} helperText={helperText} error={error} required={required} htmlFor={id} describedBy={id}>
      <input
        id={id}
        className={`alc-input${error ? " alc-input--invalid" : ""}${className ? " " + className : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : helperText ? `${id}-help` : undefined}
        required={required}
        {...rest}
      />
    </FieldShell>
  );
}

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id">,
    BaseFieldProps {}

export function Textarea({ label, helperText, error, required, className, ...rest }: TextareaProps) {
  const id = useId();
  return (
    <FieldShell label={label} helperText={helperText} error={error} required={required} htmlFor={id} describedBy={id}>
      <textarea
        id={id}
        className={`alc-textarea${error ? " alc-textarea--invalid" : ""}${className ? " " + className : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : helperText ? `${id}-help` : undefined}
        required={required}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectOption { value: string; label: string; }
export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id">,
    BaseFieldProps {
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ label, helperText, error, required, options, placeholder, className, ...rest }: SelectProps) {
  const id = useId();
  return (
    <FieldShell label={label} helperText={helperText} error={error} required={required} htmlFor={id} describedBy={id}>
      <select
        id={id}
        className={`alc-select${error ? " alc-select--invalid" : ""}${className ? " " + className : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : helperText ? `${id}-help` : undefined}
        required={required}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldShell>
  );
}
