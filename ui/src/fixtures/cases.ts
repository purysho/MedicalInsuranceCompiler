import { CaseData } from "../caseModel";

// Synthetic demo cases (no real PHI). Used by the workspace and acceptance
// scenarios. Patient identifiers are fictional.

export const APPEAL_CASE: CaseData = {
  id: "#552-01",
  status: "Clinician review",
  patientName: "Eleanor Vance",
  patientId: "patient-001",
  requestedMedication: "Adalimumab (Humira) 40mg",
  payer: "Meridian Health Plan",
  workflowType: "appeal",
  criteria: [
    { criterion: "Documented trial of a conventional DMARD ≥ 3 months", state: "supported" },
    { criterion: "Active disease despite first-line therapy", state: "supported" },
    { criterion: "Recent inflammatory markers (CRP/ESR) within 90 days", state: "supported" },
    { criterion: "TB screening prior to biologic initiation", state: "supported" },
    { criterion: "Prior denial rationale addressed", state: "needs-clinician-confirmation" },
  ],
  evidence: [
    { id: "ev-1", source: "Methotrexate trial note (4 mo)", date: "03/12/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#evidence-ev-1" },
    { id: "ev-2", source: "CRP 18 mg/L", date: "05/02/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#evidence-ev-2" },
    { id: "ev-3", source: "ESR 34 mm/hr", date: "05/02/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#evidence-ev-3" },
    { id: "ev-4", source: "QuantiFERON-TB negative", date: "04/28/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#evidence-ev-4" },
    { id: "ev-5", source: "Payer denial notice", date: "04/20/24", confidence: "medium", verificationStatus: "verified", reviewerState: "unreviewed", sourceUrl: "#evidence-ev-5" },
  ],
  sourceDocuments: [
    { id: "doc-1", title: "Rheumatology consult note (05/02/24)", url: "#doc-1" },
    { id: "doc-2", title: "Lab panel (05/02/24)", url: "#doc-2" },
    { id: "doc-3", title: "Denial letter (04/20/24)", url: "#doc-3" },
  ],
  missingEvidence: [],
  requiredApprover: "Clinician reviewer",
  approvalState: "pending",
  evidenceReady: true,
  timeline: [
    { id: "t1", timestamp: "2024-05-01T09:12:00Z", actor: "Intake staff (J. Ruiz)", action: "created the case", ref: "#552-01" },
    { id: "t2", timestamp: "2024-05-02T14:03:00Z", actor: "ALICE", action: "assembled evidence ledger", description: "5 records verified" },
    { id: "t3", timestamp: "2024-05-02T15:40:00Z", actor: "PA specialist (E. Vance)", action: "requested clinician approval" },
  ],
};

// An initial-PA case — ARIA drafting must NOT be offered here (appeals only).
export const PA_CASE: CaseData = {
  id: "#553-02",
  status: "Evidence review",
  patientName: "Marcus Bell",
  patientId: "patient-002",
  requestedMedication: "Semaglutide (Ozempic) 1mg",
  payer: "Northwind Insurance",
  workflowType: "initial-pa",
  criteria: [
    { criterion: "Type 2 diabetes diagnosis", state: "supported" },
    { criterion: "HbA1c within 90 days", state: "supported" },
    { criterion: "Trial of metformin", state: "supported" },
  ],
  evidence: [
    { id: "pa-ev-1", source: "HbA1c 8.1%", date: "05/10/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#evidence-pa-ev-1" },
    { id: "pa-ev-2", source: "Metformin Rx history", date: "01/15/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#evidence-pa-ev-2" },
  ],
  sourceDocuments: [{ id: "pa-doc-1", title: "Endocrinology note (05/10/24)", url: "#pa-doc-1" }],
  missingEvidence: [],
  requiredApprover: "Clinician reviewer",
  approvalState: "pending",
  evidenceReady: true,
  timeline: [
    { id: "pt1", timestamp: "2024-05-10T10:00:00Z", actor: "Intake staff", action: "created the case" },
  ],
};

import { SCENARIOS } from "./scenarios";

export const DEMO_CASES: Record<string, CaseData> = {
  "552-01": APPEAL_CASE,
  "553-02": PA_CASE,
  // Acceptance scenarios, keyed by their case id (without the leading '#').
  ...Object.fromEntries(Object.values(SCENARIOS).map((c) => [c.id.replace(/^#/, ""), c])),
};
