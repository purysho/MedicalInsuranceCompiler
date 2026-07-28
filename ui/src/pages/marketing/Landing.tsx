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

// The condensed four-stage story shown in the hero band (matches the product
// overview): intake → AI prepares → human reviews → external submission.
const STAGE_ICON = {
  intake: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" />
    </svg>
  ),
  ai: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /><path d="M9.5 12.5 11 9l1.5 3.5M9.9 11.5h2.2M15 9v3.5" />
    </svg>
  ),
  human: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /><path d="m16.5 12 1.4 1.4L21 10" />
    </svg>
  ),
  submission: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" />
    </svg>
  ),
};

const Arrow = () => (
  <svg className="mkt__flowarrow" width="28" height="16" viewBox="0 0 28 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M1 8h24M20 3l5 5-5 5" />
  </svg>
);

export function Landing() {
  return (
    <MarketingLayout>
      <section className="mkt__hero">
        <div className="mkt__hero-inner">
          <span className="mkt__eyebrow">Medication-access workspace</span>
          <h1 className="mkt__h1">Evidence-Based Appeals, Prepared with Confidence.</h1>
          <p className="mkt__lede">
            ALICE automates the heavy lifting of prior-authorization appeals, empowering your team to
            focus on clinical decisions, not paperwork. Prior auth and appeals are slow, scattered, and
            hard to audit — ALICE brings everything into one reviewer-controlled workflow.
          </p>
          <div className="mkt__hero-cta">
            <a className="mkt__cta" href="/marketing/#pilot">Request a pilot</a>
            <a className="mkt__cta mkt__cta--ghost" href="/marketing/pa-teams">See it for PA teams</a>
          </div>
          <p className="mkt__tagline">ALICE prepares the work. Your team makes the decision.</p>
        </div>
      </section>

      {/* Condensed intake → AI → human → submission band. */}
      <section className="mkt__flowband" aria-label="How ALICE works">
        <div className="mkt__flowrow">
          <div className="mkt__flowstep">
            <span className="mkt__flowicon">{STAGE_ICON.intake}</span>
            <span className="mkt__flowlabel">Intake</span>
            <span className="mkt__flowsub">FHIR data + uploads</span>
          </div>
          <Arrow />
          <div className="mkt__flowstep">
            <span className="mkt__flowicon">{STAGE_ICON.ai}</span>
            <span className="mkt__flowlabel">ALICE prepares evidence</span>
            <span className="mkt__flowsub">(AI)</span>
          </div>
          <Arrow />
          <div className="mkt__flowstep">
            <span className="mkt__flowicon">{STAGE_ICON.human}</span>
            <span className="mkt__flowlabel">Clinician review</span>
            <span className="mkt__flowsub">(Human)</span>
          </div>
          <Arrow />
          <div className="mkt__flowstep">
            <span className="mkt__flowicon">{STAGE_ICON.submission}</span>
            <span className="mkt__flowlabel">Submission</span>
            <span className="mkt__flowsub">External, in your process</span>
          </div>
        </div>
      </section>

      <section className="mkt__section" id="workflow" aria-labelledby="flow-h">
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

      {/* ARIA introduction card — the one place --aria appears on marketing. */}
      <section className="mkt__section" id="aria" aria-labelledby="aria-h">
        <h2 className="mkt__h2" id="aria-h">Every assertion traces to a source</h2>
        <div className="mkt__ariacard">
          <div className="mkt__ariacard-head">
            <span className="mkt__aria-badge">ARIA</span>
            <h3>ALICE&rsquo;s source-cited appeal drafting capability</h3>
          </div>
          <p className="mkt__p" style={{ marginTop: "var(--space-2)" }}>
            ARIA drafts an editable appeal from the evidence your team has approved. Every factual
            assertion links back to the evidence item it came from — uncited claims are flagged, not
            shipped — so a reviewer can verify and defend every line before submission.
          </p>
          <div className="mkt__chips" aria-label="Example source citations">
            <span className="mkt__chip">HbA1c 8.2%</span>
            <span className="mkt__chip">Metformin trial 4 mo</span>
            <span className="mkt__chip">Denial notice 04/20</span>
          </div>
        </div>
      </section>

      {/* Human-review safeguards — MUST be present. */}
      <section className="mkt__section" id="safeguards" aria-labelledby="safeguards-h">
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

      <section className="mkt__section" id="pilot" aria-labelledby="pilot-h">
        <h2 className="mkt__h2" id="pilot-h">Start with a supervised pilot</h2>
        <p className="mkt__p">
          A supervised workflow for one specialty, selected payer/therapy combinations, and a defined
          case cohort. Primary outcome: appeal overturn rate, segmented by medication, payer, and case
          type; secondary: reviewer-ready turnaround, packet completeness, and clinician-edit rate.
        </p>
        <div className="mkt__buyerlinks">
          <a className="mkt__cta" href="/marketing/pa-teams">Clinic PA teams</a>
          <a className="mkt__cta mkt__cta--ghost" href="/marketing/pharmacy">Specialty pharmacies</a>
          <a className="mkt__cta mkt__cta--ghost" href="/marketing/rcm">RCM firms</a>
        </div>
      </section>
    </MarketingLayout>
  );
}
