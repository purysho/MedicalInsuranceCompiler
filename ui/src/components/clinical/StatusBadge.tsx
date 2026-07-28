import React from "react";
import { CaseStatus } from "../../types";
import "./clinical.css";

type Tone = "neutral" | "info" | "warning" | "primary" | "success" | "danger";

// Each status pairs a color TONE with a distinct ICON + the text label, so the
// state is never conveyed by color alone.
const MAP: Record<CaseStatus, { tone: Tone; icon: string }> = {
  "Intake": { tone: "neutral", icon: "○" },
  "Evidence review": { tone: "info", icon: "◐" },
  "Needs information": { tone: "warning", icon: "!" },
  "Packet ready": { tone: "primary", icon: "▢" },
  "Clinician review": { tone: "info", icon: "◔" },
  "Assigned for submission": { tone: "primary", icon: "➤" },
  "Submitted": { tone: "success", icon: "↑" },
  "Outcome recorded": { tone: "success", icon: "✓" },
};

export interface StatusBadgeProps {
  status: CaseStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { tone, icon } = MAP[status];
  return (
    <span className={`alc-badge alc-badge--${tone}`}>
      <span className="alc-badge__icon" aria-hidden="true">{icon}</span>
      <span>{status}</span>
    </span>
  );
}
