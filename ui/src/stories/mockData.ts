import { AuditEvent, Citation } from "../types";

export const MOCK_EVENTS: AuditEvent[] = [
  { id: "e1", timestamp: "2024-05-01T09:12:00Z", actor: "Intake staff (J. Ruiz)", action: "created the case", ref: "Case #552-01" },
  { id: "e2", timestamp: "2024-05-01T09:20:00Z", actor: "ALICE", action: "assembled evidence ledger", description: "12 records normalized from EHR + uploads" },
  { id: "e3", timestamp: "2024-05-02T14:03:00Z", actor: "ALICE", action: "mapped payer criteria", description: "1 missing, 4 supported" },
  { id: "e4", timestamp: "2024-05-02T15:40:00Z", actor: "PA specialist (E. Vance)", action: "requested clinician approval", ref: "Review #01" },
];

export const MOCK_CITATIONS: Citation[] = [
  { id: "c1", label: "HbA1c 8.2% (05/02/24)", evidenceItemId: "obs-a1c-1", sourceUrl: "#evidence-obs-a1c-1" },
  { id: "c2", label: "Metformin trial 4 mo", evidenceItemId: "med-metformin", sourceUrl: "#evidence-med-metformin" },
  { id: "c3", label: "Denial notice (04/20)", evidenceItemId: "doc-denial-1", sourceUrl: "#evidence-doc-denial-1" },
];

export const MOCK_DRAFT = `Dear Reviewer,

We are submitting this appeal on behalf of the patient for coverage of the requested therapy. The patient has a documented HbA1c of 8.2% [1] and completed a four-month trial of metformin [2] without adequate glycemic control. The prior denial [3] did not account for this trial history.

We respectfully request reconsideration based on the evidence enclosed.

Sincerely,
Clinic Medication-Access Team`;
