import { FhirStore } from "./fhirStore.js";

// Cases are persisted as FHIR Task resources tagged as medication-access cases.
const CASE_CODE = "medication-access-case";

export interface CaseInput {
  patientId?: string;
  patientName?: string;
  medication: string;
  payer: string;
  workflowType: "initial-pa" | "appeal";
  status?: string;
}

export interface CaseRecord {
  id: string;
  patientId: string;
  patientName: string;
  medication: string;
  payer: string;
  workflowType: "initial-pa" | "appeal";
  status: string;
  lastUpdated: string;
}

function input(task: any, typeText: string): string | undefined {
  return (task.input ?? []).find((i: any) => i.type?.text === typeText)?.valueString;
}

function toRecord(task: any): CaseRecord {
  return {
    id: task.id,
    patientId: (task.for?.reference ?? "").replace(/^Patient\//, ""),
    patientName: task.for?.display ?? "Unknown",
    medication: task.description ?? "",
    payer: input(task, "payer") ?? "",
    workflowType: (input(task, "workflowType") as CaseRecord["workflowType"]) ?? "initial-pa",
    status: task.businessStatus?.text ?? "Intake",
    lastUpdated: task.lastModified ?? task.authoredOn ?? new Date().toISOString(),
  };
}

/** Validate + create a case (Task resource). Throws on missing required fields. */
export function createCase(store: FhirStore, data: CaseInput): CaseRecord {
  const missing: string[] = [];
  if (!data.medication?.trim()) missing.push("medication");
  if (!data.payer?.trim()) missing.push("payer");
  if (!data.workflowType) missing.push("workflowType");
  if (!data.patientId?.trim() && !data.patientName?.trim()) missing.push("patient");
  if (data.workflowType && data.workflowType !== "initial-pa" && data.workflowType !== "appeal") {
    throw new Error("workflowType must be 'initial-pa' or 'appeal'");
  }
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(", ")}`);

  const now = new Date().toISOString();
  const patientId = data.patientId?.trim() || `patient-${Math.random().toString(36).slice(2, 8)}`;
  const patientName = data.patientName?.trim()
    || (store.read("Patient", patientId) as any)?.name?.[0]?.text
    || patientId;

  const task = store.create({
    resourceType: "Task",
    status: "requested",
    intent: "order",
    code: { text: CASE_CODE },
    description: data.medication.trim(),
    for: { reference: `Patient/${patientId}`, display: patientName },
    authoredOn: now,
    lastModified: now,
    businessStatus: { text: data.status ?? "Intake" },
    input: [
      { type: { text: "payer" }, valueString: data.payer.trim() },
      { type: { text: "workflowType" }, valueString: data.workflowType },
    ],
  });
  return toRecord(task);
}

/** List all medication-access cases as summary records. */
export function listCases(store: FhirStore): CaseRecord[] {
  return store
    .search("Task", {})
    .filter((t: any) => t.code?.text === CASE_CODE)
    .map(toRecord)
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
}

/** Patient directory rows: name, id, active case count, last activity. */
export interface PatientDirectoryRow {
  patientId: string;
  patientName: string;
  activeCases: number;
  lastActivity: string | null;
}

export function listPatientDirectory(store: FhirStore): PatientDirectoryRow[] {
  const cases = listCases(store);
  const byPatient = new Map<string, PatientDirectoryRow>();

  for (const p of store.listPatients() as any[]) {
    const name = p.name?.[0]?.text ?? p.id;
    byPatient.set(p.id, { patientId: p.id, patientName: name, activeCases: 0, lastActivity: null });
  }
  for (const c of cases) {
    const row = byPatient.get(c.patientId) ?? {
      patientId: c.patientId, patientName: c.patientName, activeCases: 0, lastActivity: null,
    };
    row.activeCases += 1;
    if (!row.lastActivity || c.lastUpdated > row.lastActivity) row.lastActivity = c.lastUpdated;
    byPatient.set(c.patientId, row);
  }
  return Array.from(byPatient.values()).sort((a, b) => a.patientName.localeCompare(b.patientName));
}
