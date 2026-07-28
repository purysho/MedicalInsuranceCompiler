import React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible label — icon-only controls must never be unlabelled. */
  label: string;
}

/** 44px minimum touch target, always carries an aria-label. */
export function IconButton({ label, children, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`alc-iconbtn${className ? " " + className : ""}`}
      {...rest}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
