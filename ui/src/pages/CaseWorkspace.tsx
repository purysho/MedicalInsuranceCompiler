import React, { useEffect, useState } from "react";
import { CaseData, AriaDraftData } from "../caseModel";
import { PageLayout } from "../layout/PageLayout";
import {
  StatusBadge, PayerCriterionRow, EvidenceRow, ReviewBlock, AriaPanel,
  CaseTimeline, ProvenancePanel,
} from "../components/clinical";
import { ProvenanceStep } from "../components/clinical/ProvenancePanel";
import { Button, Tooltip, Tabs } from "../components/primitives";
import { apiGet, apiPost } from "../api";
import "./workspace.css";

const WORKFLOW_LABEL: Record<CaseData["workflowType"], string> = {
  "initial-pa": "Initial prior authorization",
  "appeal": "Appeal",
};

export interface CaseWorkspaceProps {
  caseData: CaseData;
  /** Injectable ARIA draft fn for tests; defaults to POST /api/aria-chat. */
  draftWithAria?: (c: CaseData) => Promise<AriaDraftData>;
}

async function defaultDraftWithAria(c: CaseData): Promise<AriaDraftData> {
  const evidenceSummary = c.evidence
    .map((e, i) => `[${i + 1}] ${e.source} (${e.date}) — ${e.verificationStatus}`)
    .join("\n");
  const messages = [
    {
      role: "user",
      content:
        `Draft an appeal letter for ${c.patientName}, requesting ${c.requestedMedication} ` +
        `from ${c.payer}. Use ONLY the approved evidence below; cite each factual claim ` +
        `by its bracket number.\n\nApproved evidence:\n${evidenceSummary}`,
    },
  ];
  const resp = await apiPost<{ text?: string; content?: { text: string }[] }>("/api/aria-chat", {
    messages,
    system:
      "You are ARIA, ALICE's source-cited appeal drafting capability. Draft only from the " +
      "approved evidence provided. Every factual assertion must cite an evidence item. Output an " +
      "editable appeal letter. A human reviewer must approve before submission.",
  });
  const text = resp.text ?? resp.content?.[0]?.text ?? "";
  return {
    draft: text,
    citations: c.evidence.map((e, i) => ({
      id: `cite-${e.id}`,
      label: `[${i + 1}] ${e.source}`,
      evidenceItemId: e.id,
      sourceUrl: e.sourceUrl,
    })),
    uncertaintyFlags: [],
  };
}

export function CaseWorkspace({ caseData, draftWithAria = defaultDraftWithAria }: CaseWorkspaceProps) {
  const [approvalState, setApprovalState] = useState(caseData.approvalState);
  const [aria, setAria] = useState<AriaDraftData | undefined>(caseData.ariaDraft);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [provenance, setProvenance] = useState<ProvenanceStep[]>([]);

  // Read-only provenance chain for the audit-trail tab. Best-effort: if the
  // endpoint is unavailable the tab simply shows an empty state.
  useEffect(() => {
    let cancelled = false;
    apiGet<{ provenance: ProvenanceStep[] }>(`/api/cases/${caseData.patientId}/provenance`)
      .then((r) => { if (!cancelled) setProvenance(r.provenance ?? []); })
      .catch(() => { /* endpoint optional in this view */ });
    return () => { cancelled = true; };
  }, [caseData.patientId]);

  // Terminal state: once an outcome is recorded the case is read-only — every
  // action is disabled except viewing the audit trail.
  const isTerminal = caseData.status === "Outcome recorded";
  const approved = approvalState === "approved" && !isTerminal;
  const isAppeal = caseData.workflowType === "appeal";
  const canDraftAria = isAppeal && caseData.evidenceReady && !isTerminal;

  async function onDraftAria() {
    setDrafting(true);
    setDraftError(null);
    try {
      const result = await draftWithAria(caseData);
      setAria(result);
    } catch (e: any) {
      setDraftError(e?.message ?? "ARIA drafting failed.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <PageLayout>
      <div className="alc-ws">
        {/* ── Left: summary + criteria (status first, identity second) ── */}
        <div>
          <section className="alc-card alc-summary" aria-label="Case summary">
            {/* Visual hierarchy: status/safety state FIRST and largest. */}
            <div className="alc-summary__status">
              <StatusBadge status={caseData.status} />
            </div>
            {/* Patient/case identity SECOND. */}
            <h1 className="alc-summary__patient">{caseData.patientName}</h1>
            <div className="alc-summary__id">Case {caseData.id} · Patient {caseData.patientId}</div>
            <dl className="alc-summary__facts">
              <dt>Requested</dt><dd>{caseData.requestedMedication}</dd>
              <dt>Payer</dt><dd>{caseData.payer}</dd>
              <dt>Workflow</dt><dd>{WORKFLOW_LABEL[caseData.workflowType]}</dd>
            </dl>
          </section>

          <section className="alc-card" aria-label="Payer criteria checklist">
            <h2 className="alc-card__title">Payer criteria</h2>
            {caseData.criteria.map((c, i) => (
              <PayerCriterionRow key={i} criterion={c.criterion} state={c.state} detail={c.detail} />
            ))}
          </section>
        </div>

        {/* ── Center: evidence ledger (evidence THIRD in hierarchy) ── */}
        <div>
          {caseData.missingEvidence.length > 0 && (
            <div className="alc-missing" role="alert">
              <span aria-hidden="true">⚠</span>
              <div>
                <strong>Missing evidence</strong>
                <ul>
                  {caseData.missingEvidence.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            </div>
          )}

          <section aria-label="Evidence packet">
            <div className="alc-ws__sectionhead">
              <h2 className="alc-card__title" style={{ margin: 0 }}>Evidence packet</h2>
              <span className="alc-evrow__meta">{caseData.evidence.length} records</span>
            </div>
            <div className="alc-ledger">
              <div className="alc-ledger__head">
                <span>Record</span><span>Confidence</span><span>Verification</span><span>Actions</span>
              </div>
              <div className="alc-ledger__body">
                {caseData.evidence.map((e) => (
                  <EvidenceRow
                    key={e.id}
                    source={e.source}
                    date={e.date}
                    confidence={e.confidence}
                    verificationStatus={e.verificationStatus}
                    reviewerState={e.reviewerState}
                    sourceUrl={e.sourceUrl}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="alc-card" aria-label="Source documents">
            <h2 className="alc-card__title">Source documents</h2>
            <ul className="alc-srcdocs">
              {caseData.sourceDocuments.map((d) => (
                <li key={d.id}>
                  <span>{d.title}</span>
                  {d.url
                    ? <a className="alc-evrow__link" href={d.url} target="_blank" rel="noreferrer">Open</a>
                    : <span className="alc-evrow__meta">No file</span>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Right: persistent review gate + ARIA draft ── */}
        <div>
          <ReviewBlock
            requiredApprover={caseData.requiredApprover}
            approvalState={approvalState}
            requiresComment
            warning={caseData.reviewWarning}
            readOnly={isTerminal}
            onApprove={() => setApprovalState("approved")}
          />

          {isTerminal && caseData.outcome && (
            <section className="alc-card alc-ws__aria" aria-label="Recorded outcome">
              <h2 className="alc-card__title">Recorded outcome</h2>
              <dl className="alc-summary__facts">
                <dt>Decision</dt><dd>{caseData.outcome.decision}</dd>
                <dt>Payer response</dt><dd>{caseData.outcome.payerResponse}</dd>
                <dt>Reason</dt><dd>{caseData.outcome.reason}</dd>
              </dl>
              <div style={{ marginTop: "var(--space-3)" }}>
                <a className="alc-btn alc-btn--secondary alc-btn--md" href={`#/audit/${caseData.id.replace(/^#/, "")}`}>
                  View audit trail
                </a>
              </div>
              <div className="alc-ws__gatehint">Case closed — all actions are disabled except viewing the audit trail.</div>
            </section>
          )}

          {!isTerminal && (
            <section className="alc-card alc-ws__aria" aria-label="Packet actions">
              <h2 className="alc-card__title">Packet actions</h2>
              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <Tooltip label={approved ? "Export the approved packet" : "Requires clinician approval"}>
                  <Button variant="secondary" disabled={!approved}>Export packet</Button>
                </Tooltip>
                <Tooltip label={approved ? "Create a submission task" : "Requires clinician approval"}>
                  <Button variant="secondary" disabled={!approved}>Assign for submission</Button>
                </Tooltip>
              </div>
              {!approved && <div className="alc-ws__gatehint">Requires clinician approval</div>}

              {isAppeal && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  {canDraftAria ? (
                    <Button variant="primary" loading={drafting} onClick={onDraftAria}>
                      Draft appeal with ARIA
                    </Button>
                  ) : (
                    <Tooltip label="Evidence incomplete — resolve missing items before drafting.">
                      <Button variant="primary" disabled>Draft appeal with ARIA</Button>
                    </Tooltip>
                  )}
                  {draftError && <div className="alc-ws__gatehint" role="alert">{draftError}</div>}
                </div>
              )}
            </section>
          )}

          {(drafting || aria) && (
            <div className="alc-ws__aria">
              <AriaPanel
                draft={aria?.draft ?? ""}
                citations={aria?.citations ?? []}
                uncertaintyFlags={aria?.uncertaintyFlags ?? []}
                loading={drafting}
                approveBlockedReason={aria?.approveBlockedReason}
              />
            </div>
          )}

          {/* Read-only audit trail + provenance, below the review gate. */}
          <section className="alc-card alc-ws__aria" aria-label="Case history">
            <Tabs
              aria-label="Case history"
              tabs={[
                { id: "audit", label: "Audit trail", content: <CaseTimeline events={caseData.timeline} /> },
                { id: "provenance", label: "Provenance", content: <ProvenancePanel steps={provenance} /> },
              ]}
            />
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
