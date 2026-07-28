import React from "react";
import "./marketing.css";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt">
      <header className="mkt__header">
        <a className="mkt__wordmark" href="/marketing/">ALICE</a>
        <nav className="mkt__nav" aria-label="Marketing">
          <a href="/marketing/pa-teams">PA teams</a>
          <a href="/marketing/pharmacy">Specialty pharmacy</a>
          <a href="/marketing/rcm">RCM firms</a>
          <a href="/">Open the workspace</a>
        </nav>
      </header>
      <main className="mkt__wrap">{children}</main>
      <footer className="mkt__footer">
        ALICE prepares the work. Your team makes the decision. · Decision-support software, not a
        clinical or coverage decision-maker.
      </footer>
    </div>
  );
}
