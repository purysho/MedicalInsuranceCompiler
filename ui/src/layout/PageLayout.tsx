import React from "react";
import "./shell.css";

export interface PageLayoutProps {
  title?: string;
  children: React.ReactNode;
}

/** Wraps page content: max-width 1200px, 24px horizontal padding. */
export function PageLayout({ title, children }: PageLayoutProps) {
  return (
    <main className="alc-page">
      {title && <h1 className="alc-page__title">{title}</h1>}
      {children}
    </main>
  );
}
