import React from "react";

export type ToastVariant = "success" | "warning" | "danger" | "info";

export interface ToastProps {
  variant: ToastVariant;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
}

// Non-color channel: each variant carries a distinct glyph + word, never color alone.
const GLYPH: Record<ToastVariant, string> = {
  success: "✓",
  warning: "⚠",
  danger: "✕",
  info: "ℹ",
};
const WORD: Record<ToastVariant, string> = {
  success: "Success",
  warning: "Warning",
  danger: "Error",
  info: "Info",
};

export function Toast({ variant, title, children, onDismiss }: ToastProps) {
  return (
    <div
      className={`alc-toast alc-toast--${variant}`}
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
    >
      <span className="alc-toast__icon" aria-hidden="true">{GLYPH[variant]}</span>
      <div className="alc-toast__body">
        <span className="sr-only">{WORD[variant]}: </span>
        {title && <div className="alc-toast__title">{title}</div>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button type="button" className="alc-iconbtn" aria-label="Dismiss notification" onClick={onDismiss}>
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  );
}
