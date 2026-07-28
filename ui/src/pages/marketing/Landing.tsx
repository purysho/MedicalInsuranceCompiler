import React from "react";
import { MarketingLayout } from "./MarketingLayout";

// The 7-step ideal workflow (PLAN 1). Step 5 introduces ARIA inline — never as a
// separate product or equal-weight brand.
const STEPS: { title: string; body: string }[] = [
  { title: "Create case", body: "Patient, requested medication/procedure, payer, and workflow type: initial PA or appeal." },
  { title: "Reconcile & normalize", body: "Records, payer documents, denial notices, labs, and prior-treatment history into a source-linked evidence ledger." },
  { title: "Map payer criteria", body: "Each item labelled supported, missing, conflicting, or needs clinician confirmation. No autonomous coverage decision." },
  { title: "Compose packet", body: "Packet checklist, missing-evidence highlights, and a reviewer-ready PA or appeal packet." },
  { title: "Draft the appeal", body: "For appeals, ALICE's source-cited appeal drafting capability (ARIA) drafts an editable letter from approved evidence — every claim cites its source." },
  { title: "Review & approve", body: "An authorized clinician reviews, edits, and approves. ALICE creates an assigned task and exportable package." },
  { title: "Record outcome", body: "Submission, payer response, outcome, and reason recorded. The complete timeline and audit trail is retained." },
];

export function Landing() {
  return (
    <MarketingLayout>
      <section className="mkt__hero">
        <span className="mkt__eyebrow">Medication-access workspace</span>
        <h1 className="mkt__h1">Prepare complete, auditable prior-auth and appeal packets — faster.</h1>
        <p className="mkt__lede">
          Prior auth and appeals are slow, scattered, and hard to audit. ALICE brings scattered
          patient records, payer requirements, denial letters, and clinical evidence into one
          reviewer-controlled workflow.
        </p>
        <a className="mkt__cta" href="/marketing/pa-teams">See it for PA teams</a>
        <p className="mkt__tagline">ALICE prepares the work. Your team makes the decision.</p>
      </section>

      <section className="mkt__section" aria-labelledby="flow-h">
        <h2 className="mkt__h2" id="flow-h">One reviewer-controlled workflow</h2>
        <div className="mkt__flow">
          {STEPS.map((s, i) => (
            <div className="mkt__step" key={i}>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Human-review safeguards — MUST be present. */}
      <section className="mkt__section" aria-labelledby="safeguards-h">
        <div className="mkt__safeguards">
          <h2 className="mkt__h2" id="safeguards-h">Human-review safeguards</h2>
          <p className="mkt__p">
            ALICE is decision support and administrative workflow software — not a clinical
            decision-maker or a payer-submission autopilot. Approval gates are load-bearing:
          </p>
          <ul>
            <li>No packet export or submission handoff until the required reviewer signs off.</li>
            <li>Every coverage or clinical output is labelled as requiring human review.</li>
            <li>Appeal drafts carry a mandatory “human review required before submission” label.</li>
            <li>Submission stays external in V1 — ALICE creates the package and a human handoff.</li>
          </ul>
        </div>
      </section>

      <section className="mkt__section" aria-labelledby="trace-h">
        <h2 className="mkt__h2" id="trace-h">Every assertion traces to a source</h2>
        <p className="mkt__p">
          ALICE's source-cited appeal drafting capability drafts only from evidence your team has
          approved. Each factual assertion links back to the evidence item it came from, so a
          reviewer can verify — and defend — every line before it is submitted.
        </p>
        <div className="mkt__grid" style={{ marginTop: "var(--space-3)" }}>
          <div className="mkt__card"><h3>Source-linked ledger</h3><p>Labs, notes, denial letters, and prior treatments, each with provenance.</p></div>
          <div className="mkt__card"><h3>Citations on every claim</h3><p>Uncited assertions are flagged, not shipped.</p></div>
          <div className="mkt__card"><h3>Complete audit trail</h3><p>Reconstruct every input, change, approval, export, and outcome.</p></div>
        </div>
      </section>

      <section className="mkt__section" aria-labelledby="pilot-h">
        <h2 className="mkt__h2" id="pilot-h">Start with a supervised pilot</h2>
        <p className="mkt__p">
          A supervised workflow for one specialty, selected payer/therapy combinations, and a defined
          case cohort. Primary outcome: appeal overturn rate, segmented by medication, payer, and case
          type; secondary: reviewer-ready turnaround, packet completeness, and clinician-edit rate.
        </p>
        <div className="mkt__buyerlinks">
          <a className="mkt__cta" href="/marketing/pa-teams">Clinic PA teams</a>
          <a className="mkt__cta" href="/marketing/pharmacy">Specialty pharmacies</a>
          <a className="mkt__cta" href="/marketing/rcm">RCM firms</a>
        </div>
      </section>
    </MarketingLayout>
  );
}
