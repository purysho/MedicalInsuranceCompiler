import React from "react";
import { ApprovalState } from "../../types";
import "./clinical.css";

const MAP: Record<ApprovalState, { tone: string; icon: string; label: string }> = {
  pending: { tone: "warning", icon: "◔", label: "Awaiting approval" },
  "changes-requested": { tone: "info", icon: "↺", label: "Changes requested" },
  approved: { tone: "success", icon: "✓", label: "Approved" },
  blocked: { tone: "danger", icon: "✕", label: "Blocked" },
};

/** Approval-state badge — icon + label, color as a secondary channel only. */
export function StatusBadgeApproval({ state }: { state: ApprovalState }) {
  const s = MAP[state];
  return (
    <span className={`alc-badge alc-badge--${s.tone}`}>
      <span className="alc-badge__icon" aria-hidden="true">{s.icon}</span>
      <span>{s.label}</span>
    </span>
  );
}
