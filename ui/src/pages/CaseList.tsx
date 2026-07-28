import React, { useEffect, useMemo, useState } from "react";
import { CaseStatus, CASE_STATUS_ORDER } from "../types";
import { PageLayout } from "../layout/PageLayout";
import { StatusBadge } from "../components/clinical";
import { Button, EmptyState } from "../components/primitives";
import { apiGet } from "../api";
import { APPEAL_CASE, PA_CASE } from "../fixtures/cases";
import "./tables.css";

export interface CaseRow {
  id: string;
  patientName: string;
  medication: string;
  payer: string;
  status: CaseStatus;
  lastUpdated: string;
}

// Fixture rows so the demo list is populated even before any case is created.
const FIXTURE_ROWS: CaseRow[] = [APPEAL_CASE, PA_CASE].map((c) => ({
  id: c.id.replace(/^#/, ""),
  patientName: c.patientName,
  medication: c.requestedMedication,
  payer: c.payer,
  status: c.status,
  lastUpdated: c.timeline[c.timeline.length - 1]?.timestamp ?? "",
}));

export interface CaseListViewProps {
  cases: CaseRow[];
  onOpen?: (id: string) => void;
  onNewCase?: () => void;
  onOpenDirectory?: () => void;
}

/** Presentational, filterable case list. Status filter uses StatusBadge chips. */
export function CaseListView({ cases, onOpen, onNewCase, onOpenDirectory }: CaseListViewProps) {
  const [filter, setFilter] = useState<CaseStatus | "all">("all");
  const shown = useMemo(
    () => (filter === "all" ? cases : cases.filter((c) => c.status === filter)),
    [cases, filter]
  );
  const present = useMemo(() => {
    const set = new Set(cases.map((c) => c.status));
    return CASE_STATUS_ORDER.filter((s) => set.has(s));
  }, [cases]);

  return (
    <PageLayout title="Cases">
      <div className="alc-toolbar">
        <div className="alc-filterchips" role="group" aria-label="Filter by status">
          <button className="alc-filterchip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All ({cases.length})
          </button>
          {present.map((s) => (
            <button key={s} className="alc-filterchip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
              {s}
            </button>
          ))}
        </div>
        <span className="alc-toolbar__spacer" />
        {onOpenDirectory && <Button variant="ghost" onClick={onOpenDirectory}>Patient directory</Button>}
        {onNewCase && <Button variant="primary" onClick={onNewCase}>New case</Button>}
      </div>

      {shown.length === 0 ? (
        <EmptyState heading="No cases" description="No cases match this filter." />
      ) : (
        <div className="alc-table-wrap">
          <table className="alc-table">
            <thead>
              <tr>
                <th>Case ID</th><th>Patient</th><th>Medication</th><th>Payer</th><th>Status</th><th>Updated</th><th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.patientName}</td>
                  <td>{c.medication}</td>
                  <td>{c.payer}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.lastUpdated ? new Date(c.lastUpdated).toLocaleDateString("en-GB") : "—"}</td>
                  <td><button className="alc-linkbtn" onClick={() => onOpen?.(c.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}

/** Container: merges API cases with fixture rows. */
export function CaseList({ onOpen, onNewCase, onOpenDirectory }: Omit<CaseListViewProps, "cases">) {
  const [cases, setCases] = useState<CaseRow[]>(FIXTURE_ROWS);
  useEffect(() => {
    let cancelled = false;
    apiGet<{ cases: CaseRow[] }>("/api/cases")
      .then((r) => {
        if (cancelled) return;
        const api = r.cases ?? [];
        // Merge: fixtures first, then any API-created cases not already shown.
        const seen = new Set(FIXTURE_ROWS.map((c) => c.id));
        setCases([...FIXTURE_ROWS, ...api.filter((c) => !seen.has(c.id))]);
      })
      .catch(() => { /* fixtures already shown */ });
    return () => { cancelled = true; };
  }, []);
  return <CaseListView cases={cases} onOpen={onOpen} onNewCase={onNewCase} onOpenDirectory={onOpenDirectory} />;
}
