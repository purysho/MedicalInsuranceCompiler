import React from "react";
import { EmptyState } from "../primitives";
import "./clinical.css";

export interface ProvenanceStep {
  id: string;
  recorded?: string;
  activity: string;
  agent: string;
  used: string[];
  target: string[];
}

export interface ProvenancePanelProps {
  steps: ProvenanceStep[];
}

/**
 * Read-only FHIR Provenance chain for a packet. Each step (agent, activity,
 * used refs, target refs) is expandable via native <details>. No edit controls.
 */
export function ProvenancePanel({ steps }: ProvenancePanelProps) {
  if (steps.length === 0) {
    return <EmptyState heading="No provenance recorded" description="Agent activity will appear here once evidence is assembled." />;
  }
  return (
    <div className="alc-prov" aria-label="Provenance chain (read only)">
      {steps.map((s) => (
        <details key={s.id} className="alc-prov__step">
          <summary className="alc-prov__summary">
            <span className="alc-prov__agent">{s.agent}</span>
            <span className="alc-prov__activity">{s.activity}</span>
            {s.recorded && <span className="alc-auditrow__time">{new Date(s.recorded).toLocaleString("en-GB")}</span>}
          </summary>
          <div className="alc-prov__detail">
            <div>
              <span className="alc-field__label">Used ({s.used.length})</span>
              <ul className="alc-prov__refs">
                {s.used.length === 0 ? <li className="alc-evrow__meta">—</li> : s.used.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div>
              <span className="alc-field__label">Produced ({s.target.length})</span>
              <ul className="alc-prov__refs">
                {s.target.length === 0 ? <li className="alc-evrow__meta">—</li> : s.target.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
