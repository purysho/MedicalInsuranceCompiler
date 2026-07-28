import React, { useId } from "react";

export interface ChoiceProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

/** Checkbox with an always-present text label and 44px hit area. */
export function Checkbox({ label, className, ...rest }: ChoiceProps) {
  const id = useId();
  return (
    <label className={`alc-choice${className ? " " + className : ""}`} htmlFor={id}>
      <input id={id} type="checkbox" {...rest} />
      <span className="alc-choice__label">{label}</span>
    </label>
  );
}

/** Radio with an always-present text label. Provide a shared `name` to group. */
export function Radio({ label, className, ...rest }: ChoiceProps) {
  const id = useId();
  return (
    <label className={`alc-choice${className ? " " + className : ""}`} htmlFor={id}>
      <input id={id} type="radio" {...rest} />
      <span className="alc-choice__label">{label}</span>
    </label>
  );
}
