import React, { useEffect, useMemo, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { EmptyState } from "../components/primitives";
import { apiGet } from "../api";
import "./tables.css";

export interface PatientRow {
  patientId: string;
  patientName: string;
  activeCases: number;
  lastActivity: string | null;
}

const FIXTURE_PATIENTS: PatientRow[] = [
  { patientId: "patient-001", patientName: "Eleanor Vance", activeCases: 1, lastActivity: "2024-05-02T15:40:00Z" },
  { patientId: "patient-002", patientName: "Marcus Bell", activeCases: 1, lastActivity: "2024-05-10T10:00:00Z" },
];

export interface PatientDirectoryViewProps {
  patients: PatientRow[];
  onOpenPatient?: (patientId: string) => void;
}

/** Presentational, searchable patient directory. */
export function PatientDirectoryView({ patients, onOpenPatient }: PatientDirectoryViewProps) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.patientName.toLowerCase().includes(q) || p.patientId.toLowerCase().includes(q)
    );
  }, [patients, query]);

  return (
    <PageLayout title="Patient directory">
      <div className="alc-toolbar">
        <input
          className="alc-toolbar__search"
          type="search"
          placeholder="Search by patient name or ID…"
          aria-label="Search patients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState heading="No patients found" description="No patient matches your search." />
      ) : (
        <div className="alc-table-wrap">
          <table className="alc-table">
            <thead>
              <tr><th>Patient</th><th>ID</th><th>Active cases</th><th>Last activity</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.patientId}>
                  <td>{p.patientName}</td>
                  <td>{p.patientId}</td>
                  <td>{p.activeCases}</td>
                  <td>{p.lastActivity ? new Date(p.lastActivity).toLocaleDateString("en-GB") : "—"}</td>
                  <td><button className="alc-linkbtn" onClick={() => onOpenPatient?.(p.patientId)}>View cases</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}

export function PatientDirectory({ onOpenPatient }: Omit<PatientDirectoryViewProps, "patients">) {
  const [patients, setPatients] = useState<PatientRow[]>(FIXTURE_PATIENTS);
  useEffect(() => {
    let cancelled = false;
    apiGet<{ patients: PatientRow[] }>("/api/patients")
      .then((r) => { if (!cancelled && r.patients?.length) setPatients(r.patients); })
      .catch(() => { /* fixtures shown */ });
    return () => { cancelled = true; };
  }, []);
  return <PatientDirectoryView patients={patients} onOpenPatient={onOpenPatient} />;
}
