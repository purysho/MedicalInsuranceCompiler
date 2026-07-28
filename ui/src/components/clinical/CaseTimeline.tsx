import React from "react";
import { AuditEvent } from "../../types";
import { AuditEventRow } from "./AuditEventRow";
import { EmptyState } from "../primitives";
import "./clinical.css";

export interface CaseTimelineProps {
  events: AuditEvent[];
}

/**
 * Immutable, scroll-locked case timeline. Read-only: it renders AuditEventRows
 * and exposes no edit affordance of any kind.
 */
export function CaseTimeline({ events }: CaseTimelineProps) {
  if (events.length === 0) {
    return <EmptyState heading="No events yet" description="Case activity will appear here." />;
  }
  return (
    <div className="alc-timeline" role="list" aria-label="Case timeline (read only)">
      {events.map((e) => (
        <div role="listitem" key={e.id}>
          <AuditEventRow event={e} />
        </div>
      ))}
    </div>
  );
}
