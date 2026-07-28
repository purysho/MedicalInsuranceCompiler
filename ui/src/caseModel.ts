import {
  CaseStatus, WorkflowType, CriterionState, EvidenceItemRef, Citation, AuditEvent, ApprovalState,
} from "./types";

export interface CriterionEntry {
  criterion: string;
  state: CriterionState;
  detail?: string;
}

export interface SourceDocument {
  id: string;
  title: string;
  url?: string;
}

export interface AriaDraftData {
  draft: string;
  citations: Citation[];
  uncertaintyFlags: string[];
  /** When set, ARIA's "Approve draft" is blocked (e.g. uncited paragraph). */
  approveBlockedReason?: string;
}

export interface CaseData {
  id: string;
  status: CaseStatus;
  patientName: string;
  patientId: string;
  requestedMedication: string;
  payer: string;
  workflowType: WorkflowType;
  criteria: CriterionEntry[];
  evidence: EvidenceItemRef[];
  sourceDocuments: SourceDocument[];
  missingEvidence: string[];
  requiredApprover: string;
  approvalState: ApprovalState;
  /** True once evidence assembly reaches "Evidence ready" — gates ARIA drafting. */
  evidenceReady: boolean;
  /** Present when ARIA has produced a draft for this case. */
  ariaDraft?: AriaDraftData;
  timeline: AuditEvent[];
  /** Optional blocking warning surfaced on the ReviewBlock. */
  reviewWarning?: string;
  /** Present when the case has reached "Outcome recorded". */
  outcome?: {
    decision: string;
    payerResponse: string;
    reason: string;
  };
}
