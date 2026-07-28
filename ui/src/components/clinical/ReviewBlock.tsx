import React, { useState } from "react";
import { ApprovalState } from "../../types";
import { Button, Textarea } from "../primitives";
import { StatusBadgeApproval } from "./ApprovalBadge";
import "./clinical.css";

export interface ReviewBlockProps {
  requiredApprover: string;
  approvalState: ApprovalState;
  requiresComment?: boolean;
  /** Optional blocking warning (e.g. conflicting evidence) shown prominently. */
  warning?: string;
  /** Terminal/closed cases: disable all controls (read-only record). */
  readOnly?: boolean;
  onApprove: (comment: string) => void;
  onComment?: (comment: string) => void;
  onHandoff?: () => void;
}

/**
 * Approval gate. This is load-bearing: nothing downstream (packet export, task
 * handoff, ARIA delivery) may proceed until approvalState is "approved".
 * When requiresComment is true, Approve stays disabled until a comment exists.
 */
export function ReviewBlock({
  requiredApprover,
  approvalState,
  requiresComment = false,
  warning,
  readOnly = false,
  onApprove,
  onComment,
  onHandoff,
}: ReviewBlockProps) {
  const [comment, setComment] = useState("");
  const approved = approvalState === "approved";
  const blocked = approvalState === "blocked" || !!warning;
  const approveDisabled = readOnly || approved || blocked || (requiresComment && comment.trim().length === 0);
  const handoffDisabled = readOnly || !approved;

  return (
    <section className="alc-review" aria-label="Reviewer approval gate">
      <div className="alc-review__head">
        <div>
          <h3 className="alc-review__title">Review &amp; approval</h3>
          <div className="alc-review__approver">Required approver: {requiredApprover}</div>
        </div>
        <StatusBadgeApproval state={approvalState} />
      </div>

      {warning && (
        <div className="alc-review__warn" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{warning}</span>
        </div>
      )}

      <Textarea
        label="Reviewer comment"
        helperText={requiresComment ? "A comment is required before approval." : "Optional."}
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          onComment?.(e.target.value);
        }}
        disabled={approved || readOnly}
      />

      <div className="alc-review__actions">
        <Button
          variant="primary"
          disabled={approveDisabled}
          onClick={() => onApprove(comment)}
        >
          {approved ? "Approved" : "Approve"}
        </Button>
        <Button
          variant="secondary"
          disabled={handoffDisabled}
          onClick={() => onHandoff?.()}
        >
          Assign for submission
        </Button>
      </div>
    </section>
  );
}
