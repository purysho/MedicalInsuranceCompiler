import { CaseData } from "../caseModel";

// Five acceptance scenarios (synthetic data — no real PHI).

// 1) Incomplete evidence — missing HbA1c. ARIA drafting must be disabled.
export const SCENARIO_INCOMPLETE: CaseData = {
  id: "#901-01",
  status: "Needs information",
  patientName: "Nadia Okafor",
  patientId: "patient-901",
  requestedMedication: "Semaglutide (Ozempic) 1mg",
  payer: "Northwind Insurance",
  workflowType: "appeal",
  criteria: [
    { criterion: "Type 2 diabetes diagnosis", state: "supported" },
    { criterion: "Recent HbA1c within 90 days", state: "missing", detail: "No A1c result found in the ledger." },
    { criterion: "Trial of metformin ≥ 3 months", state: "supported" },
  ],
  evidence: [
    { id: "s1-ev1", source: "T2DM diagnosis note", date: "02/10/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#s1-ev1" },
    { id: "s1-ev2", source: "Metformin Rx history", date: "01/15/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#s1-ev2" },
  ],
  sourceDocuments: [{ id: "s1-doc1", title: "Endocrinology note (02/10/24)", url: "#s1-doc1" }],
  missingEvidence: ["HbA1c result within the last 90 days"],
  requiredApprover: "Clinician reviewer",
  approvalState: "pending",
  evidenceReady: false, // gates ARIA drafting
  timeline: [
    { id: "s1t1", timestamp: "2024-02-11T09:00:00Z", actor: "Intake staff", action: "created the case" },
    { id: "s1t2", timestamp: "2024-02-11T09:30:00Z", actor: "ALICE", action: "flagged missing evidence", description: "HbA1c not found" },
  ],
};

// 2) Conflicting evidence — two conflicting diagnoses. ReviewBlock warns.
export const SCENARIO_CONFLICTING: CaseData = {
  id: "#902-01",
  status: "Evidence review",
  patientName: "Theo Marsh",
  patientId: "patient-902",
  requestedMedication: "Adalimumab (Humira) 40mg",
  payer: "Meridian Health Plan",
  workflowType: "appeal",
  criteria: [
    { criterion: "Primary diagnosis", state: "conflicting", detail: "Condition/rheumatoid-arthritis conflicts with Condition/psoriatic-arthritis." },
    { criterion: "DMARD trial documented", state: "supported" },
    { criterion: "Active disease markers", state: "needs-clinician-confirmation" },
  ],
  evidence: [
    { id: "s2-ev1", source: "Condition: Rheumatoid arthritis", date: "03/01/24", confidence: "medium", verificationStatus: "disputed", reviewerState: "flagged", sourceUrl: "#s2-ev1" },
    { id: "s2-ev2", source: "Condition: Psoriatic arthritis", date: "03/20/24", confidence: "medium", verificationStatus: "disputed", reviewerState: "flagged", sourceUrl: "#s2-ev2" },
    { id: "s2-ev3", source: "Methotrexate trial note", date: "02/15/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#s2-ev3" },
  ],
  sourceDocuments: [{ id: "s2-doc1", title: "Rheumatology notes (03/2024)", url: "#s2-doc1" }],
  missingEvidence: [],
  requiredApprover: "Clinician reviewer",
  approvalState: "blocked",
  reviewWarning: "Conflicting evidence requires clinician resolution before packet can be approved.",
  evidenceReady: false,
  timeline: [
    { id: "s2t1", timestamp: "2024-03-21T10:00:00Z", actor: "ALICE", action: "detected conflicting diagnoses", description: "RA vs PsA" },
  ],
};

// 3) ARIA draft with a missing citation — approve blocked until resolved.
export const SCENARIO_UNCITED: CaseData = {
  id: "#903-01",
  status: "Clinician review",
  patientName: "Priya Anand",
  patientId: "patient-903",
  requestedMedication: "Adalimumab (Humira) 40mg",
  payer: "Meridian Health Plan",
  workflowType: "appeal",
  criteria: [
    { criterion: "DMARD trial documented", state: "supported" },
    { criterion: "Active disease markers", state: "supported" },
  ],
  evidence: [
    { id: "s3-ev1", source: "Methotrexate trial note", date: "02/15/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#s3-ev1" },
    { id: "s3-ev2", source: "CRP 20 mg/L", date: "05/01/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#s3-ev2" },
  ],
  sourceDocuments: [{ id: "s3-doc1", title: "Rheumatology note (05/01/24)", url: "#s3-doc1" }],
  missingEvidence: [],
  requiredApprover: "Clinician reviewer",
  approvalState: "pending",
  evidenceReady: true,
  ariaDraft: {
    draft:
      "Dear Reviewer,\n\nThe patient completed a methotrexate trial [1] with persistently elevated CRP [2].\n\n" +
      "The patient also reports substantial improvement in daily mobility over the past month.\n\nSincerely,\nCare team",
    citations: [
      { id: "s3-c1", label: "[1] Methotrexate trial note", evidenceItemId: "s3-ev1", sourceUrl: "#s3-ev1" },
      { id: "s3-c2", label: "[2] CRP 20 mg/L", evidenceItemId: "s3-ev2", sourceUrl: "#s3-ev2" },
    ],
    uncertaintyFlags: ["Paragraph 2 (mobility improvement) has no matching EvidenceItem."],
    approveBlockedReason: "Remove the uncited paragraph or add a citation before approving.",
  },
  timeline: [
    { id: "s3t1", timestamp: "2024-05-02T12:00:00Z", actor: "ARIA", action: "drafted appeal", description: "1 uncited paragraph flagged" },
  ],
};

// 4) Packet awaiting clinician approval — Clinician review state.
export const SCENARIO_AWAITING: CaseData = {
  id: "#904-01",
  status: "Clinician review",
  patientName: "Owen Fitzgerald",
  patientId: "patient-904",
  requestedMedication: "Etanercept (Enbrel) 50mg",
  payer: "Cascade Mutual",
  workflowType: "appeal",
  criteria: [
    { criterion: "DMARD trial documented", state: "supported" },
    { criterion: "Active disease markers", state: "supported" },
    { criterion: "TB screening", state: "supported" },
  ],
  evidence: [
    { id: "s4-ev1", source: "Methotrexate trial note", date: "01/10/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#s4-ev1" },
    { id: "s4-ev2", source: "QuantiFERON-TB negative", date: "04/22/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#s4-ev2" },
  ],
  sourceDocuments: [{ id: "s4-doc1", title: "Packet draft (05/01/24)", url: "#s4-doc1" }],
  missingEvidence: [],
  requiredApprover: "Clinician reviewer",
  approvalState: "pending",
  evidenceReady: true,
  timeline: [
    { id: "s4t1", timestamp: "2024-05-01T09:00:00Z", actor: "ALICE", action: "composed packet" },
    { id: "s4t2", timestamp: "2024-05-01T09:05:00Z", actor: "ALICE", action: "Awaiting clinician approval" },
  ],
};

// 5) Completed appeal with an auditable outcome — Outcome recorded.
export const SCENARIO_OUTCOME: CaseData = {
  id: "#905-01",
  status: "Outcome recorded",
  patientName: "Lena Castellanos",
  patientId: "patient-905",
  requestedMedication: "Adalimumab (Humira) 40mg",
  payer: "Meridian Health Plan",
  workflowType: "appeal",
  criteria: [
    { criterion: "DMARD trial documented", state: "supported" },
    { criterion: "Active disease markers", state: "supported" },
  ],
  evidence: [
    { id: "s5-ev1", source: "Methotrexate trial note", date: "01/05/24", confidence: "high", verificationStatus: "verified", reviewerState: "accepted", sourceUrl: "#s5-ev1" },
  ],
  sourceDocuments: [{ id: "s5-doc1", title: "Final appeal packet (05/01/24)", url: "#s5-doc1" }],
  missingEvidence: [],
  requiredApprover: "Clinician reviewer",
  approvalState: "approved",
  evidenceReady: true,
  outcome: {
    decision: "Appeal overturned — approved",
    payerResponse: "Prior authorization granted for 12 months",
    reason: "Documented DMARD failure and active disease met medical-necessity criteria.",
  },
  timeline: [
    { id: "s5t1", timestamp: "2024-04-01T09:00:00Z", actor: "Intake staff", action: "created the case" },
    { id: "s5t2", timestamp: "2024-04-02T09:00:00Z", actor: "ALICE", action: "assembled evidence ledger" },
    { id: "s5t3", timestamp: "2024-04-03T09:00:00Z", actor: "ARIA", action: "drafted appeal" },
    { id: "s5t4", timestamp: "2024-04-04T09:00:00Z", actor: "Clinician reviewer", action: "approved the packet" },
    { id: "s5t5", timestamp: "2024-04-05T09:00:00Z", actor: "PA specialist", action: "submitted to payer" },
    { id: "s5t6", timestamp: "2024-04-20T09:00:00Z", actor: "PA specialist", action: "recorded outcome", description: "Appeal overturned" },
  ],
};

export const SCENARIOS: Record<string, CaseData> = {
  incomplete: SCENARIO_INCOMPLETE,
  conflicting: SCENARIO_CONFLICTING,
  uncited: SCENARIO_UNCITED,
  awaiting: SCENARIO_AWAITING,
  outcome: SCENARIO_OUTCOME,
};
