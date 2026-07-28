import React from "react";
import { AuditEvent } from "../../types";
import "./clinical.css";

export interface AuditEventRowProps {
  event: AuditEvent;
}

function fmt(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-GB", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Immutable audit event row. Renders timestamp, actor, action, ref. There are
 * intentionally NO edit/delete controls — the audit trail is append-only.
 */
export function AuditEventRow({ event }: AuditEventRowProps) {
  return (
    <div className="alc-auditrow">
      <time className="alc-auditrow__time" dateTime={event.timestamp}>{fmt(event.timestamp)}</time>
      <div>
        <span className="alc-auditrow__actor">{event.actor}</span>{" "}
        <span className="alc-auditrow__action">{event.action}</span>
        {event.description && <div className="alc-evrow__meta">{event.description}</div>}
        {event.ref && <div className="alc-auditrow__ref">Ref: {event.ref}</div>}
      </div>
    </div>
  );
}
