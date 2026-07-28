import React from "react";
import { CriterionState } from "../../types";
import "./clinical.css";

export interface PayerCriterionRowProps {
  criterion: string;
  state: CriterionState;
  detail?: string;
}

// Distinct icon per state so the state is legible without color.
const STATE: Record<CriterionState, { icon: string; label: string }> = {
  "supported": { icon: "✓", label: "Supported" },
  "missing": { icon: "!", label: "Missing" },
  "conflicting": { icon: "✕", label: "Conflicting" },
  "needs-clinician-confirmation": { icon: "?", label: "Needs clinician confirmation" },
};

/** One payer-criteria checklist row. Labels evidence mapping; never issues an
 * autonomous coverage decision. */
export function PayerCriterionRow({ criterion, state, detail }: PayerCriterionRowProps) {
  const s = STATE[state];
  return (
    <div className={`alc-crit alc-crit--${state}`}>
      <span className="alc-crit__icon" aria-hidden="true">{s.icon}</span>
      <div className="alc-crit__body">
        <div>{criterion}</div>
        <div className="alc-crit__state">{s.label}</div>
        {detail && <div className="alc-evrow__meta">{detail}</div>}
      </div>
    </div>
  );
}
