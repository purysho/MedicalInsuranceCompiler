import React from "react";
import { MarketingLayout } from "./MarketingLayout";

export interface BuyerContent {
  eyebrow: string;
  title: string;
  pain: string;
  addresses: string[];
}

export const BUYERS: Record<string, BuyerContent> = {
  "pa-teams": {
    eyebrow: "For clinic PA & appeals teams",
    title: "Turn scattered records into reviewer-ready packets.",
    pain: "Your team re-keys the same clinical facts across portals, chases missing labs, and rebuilds appeal letters from scratch under deadline pressure.",
    addresses: [
      "A source-linked evidence ledger assembled from EHR data and uploads.",
      "Payer-criteria mapping that flags what's missing before you submit.",
      "Editable, source-cited appeal drafts your clinician approves — never auto-submitted.",
      "A complete audit trail for every packet you assemble.",
    ],
  },
  "pharmacy": {
    eyebrow: "For specialty pharmacies",
    title: "Move prior auths without losing the paper trail.",
    pain: "High-volume PA queues, fragmented payer requirements, and denials that need fast, well-evidenced appeals.",
    addresses: [
      "Normalized evidence across referral packets, labs, and prior-treatment history.",
      "Criteria gap analysis so techs know exactly what to collect.",
      "Reviewer-controlled appeal drafting with citations on every claim.",
      "Auditable turnaround and completeness metrics for your payers.",
    ],
  },
  "rcm": {
    eyebrow: "For RCM firms",
    title: "Defensible appeals at scale, with the receipts.",
    pain: "You manage authorizations and appeals across many clients and payers, and need consistency, auditability, and measurable overturn rates.",
    addresses: [
      "One workflow across clients with per-case provenance and audit history.",
      "Consistent payer-criteria mapping instead of tribal knowledge.",
      "Source-cited draft appeals reviewed and approved by an authorized human.",
      "Overturn rate, turnaround, and completeness reporting by medication and payer.",
    ],
  },
};

export function BuyerPage({ slug }: { slug: string }) {
  const c = BUYERS[slug];
  if (!c) {
    return (
      <MarketingLayout>
        <section className="mkt__hero"><div className="mkt__hero-inner"><h1 className="mkt__h1">Page not found</h1>
          <a className="mkt__cta" href="/marketing/">Back to overview</a></div></section>
      </MarketingLayout>
    );
  }
  return (
    <MarketingLayout>
      <section className="mkt__hero">
        <div className="mkt__hero-inner">
          <span className="mkt__eyebrow">{c.eyebrow}</span>
          <h1 className="mkt__h1">{c.title}</h1>
          <p className="mkt__lede">{c.pain}</p>
          <p className="mkt__tagline">ALICE prepares the work. Your team makes the decision.</p>
        </div>
      </section>

      <section className="mkt__section" aria-labelledby="addr-h">
        <h2 className="mkt__h2" id="addr-h">How ALICE helps</h2>
        <ul>
          {c.addresses.map((a, i) => <li key={i} className="mkt__p" style={{ marginBottom: "var(--space-1)" }}>{a}</li>)}
        </ul>
      </section>

      {/* Human-review safeguards must appear on every marketing page. */}
      <section className="mkt__section" aria-labelledby="sg-h">
        <div className="mkt__safeguards">
          <h2 className="mkt__h2" id="sg-h">Human-review safeguards</h2>
          <p className="mkt__p">
            ALICE never makes autonomous coverage or clinical decisions. Approval gates block export
            and submission handoff until your authorized reviewer signs off, and every appeal draft
            carries a mandatory human-review label.
          </p>
        </div>
      </section>

      <section className="mkt__section" aria-labelledby="pilot-h">
        <h2 className="mkt__h2" id="pilot-h">Supervised pilot</h2>
        <p className="mkt__p">
          One specialty, selected payer/therapy combinations, and a defined case cohort — measured on
          appeal overturn rate, turnaround, and packet completeness.
        </p>
        <a className="mkt__cta" href="/marketing/">Back to overview</a>
      </section>
    </MarketingLayout>
  );
}
