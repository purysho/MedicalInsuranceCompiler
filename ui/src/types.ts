// Shared clinical domain types for ALICE UI (PLAN 1 boundaries).

/** Canonical case states — exact labels from the build order. */
export type CaseStatus =
  | "Intake"
  | "Evidence review"
  | "Needs information"
  | "Packet ready"
  | "Clinician review"
  | "Assigned for submission"
  | "Submitted"
  | "Outcome recorded";

export const CASE_STATUS_ORDER: CaseStatus[] = [
  "Intake",
  "Evidence review",
  "Needs information",
  "Packet ready",
  "Clinician review",
  "Assigned for submission",
  "Submitted",
  "Outcome recorded",
];

/** Workflow type — initial prior authorization or a post-denial appeal. */
export type WorkflowType = "initial-pa" | "appeal";

/** Payer-criterion evaluation state. Never an autonomous coverage decision. */
export type CriterionState =
  | "supported"
  | "missing"
  | "conflicting"
  | "needs-clinician-confirmation";

export type Confidence = "high" | "medium" | "low";
export type VerificationStatus = "verified" | "unverified" | "disputed";
export type ReviewerState = "unreviewed" | "accepted" | "flagged";

export interface EvidenceItemRef {
  id: string;
  source: string;
  date: string;
  confidence: Confidence;
  verificationStatus: VerificationStatus;
  reviewerState: ReviewerState;
  sourceUrl?: string;
}

/** A citation chip linking a draft assertion back to an EvidenceItem. */
export interface Citation {
  id: string;
  label: string;
  evidenceItemId: string;
  sourceUrl?: string;
}

/** Immutable audit event. No edit/delete semantics anywhere in the UI. */
export interface AuditEvent {
  id: string;
  timestamp: string; // ISO 8601
  actor: string;
  action: string;
  ref?: string;
  description?: string;
}

/** Approval gate state for a ReviewBlock. */
export type ApprovalState = "pending" | "changes-requested" | "approved" | "blocked";
