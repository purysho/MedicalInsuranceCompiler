import React from "react";
import "./marketing.css";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt">
      <header className="mkt__header">
        <a className="mkt__brand" href="/marketing/" aria-label="ALICE — home">
          <span className="mkt__brand-mark" aria-hidden="true">A</span>
          <span className="mkt__wordmark">ALICE</span>
        </a>
        <nav className="mkt__nav" aria-label="Marketing">
          <a href="/marketing/">Platform</a>
          <a href="/marketing/pa-teams">Solutions</a>
          <a href="/">Open workspace</a>
          <a className="mkt__cta" href="/marketing/#pilot">Request pilot</a>
        </nav>
      </header>
      {children}
      <footer className="mkt__footer">
        ALICE prepares the work. Your team makes the decision. · Decision-support software, not a
        clinical or coverage decision-maker.
      </footer>
    </div>
  );
}
