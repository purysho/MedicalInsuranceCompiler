import React from "react";
import { AuditEvent } from "../types";
import { PageLayout } from "../layout/PageLayout";
import { CaseTimeline, ProvenancePanel } from "../components/clinical";
import { ProvenanceStep } from "../components/clinical/ProvenancePanel";

export interface AuditTrailPageProps {
  events: AuditEvent[];
  provenance?: ProvenanceStep[];
}

/**
 * Read-only case audit trail. Renders the immutable timeline and (optionally)
 * the FHIR provenance chain. There are intentionally NO edit/delete/hide
 * controls anywhere on this page.
 */
export function AuditTrailPage({ events, provenance = [] }: AuditTrailPageProps) {
  return (
    <PageLayout title="Case audit trail — read only">
      <CaseTimeline events={events} />
      {provenance.length > 0 && (
        <section style={{ marginTop: "var(--space-4)" }} aria-label="Provenance chain">
          <h2 style={{ fontSize: "var(--text-md)", margin: "0 0 var(--space-2)" }}>Provenance chain</h2>
          <ProvenancePanel steps={provenance} />
        </section>
      )}
    </PageLayout>
  );
}
