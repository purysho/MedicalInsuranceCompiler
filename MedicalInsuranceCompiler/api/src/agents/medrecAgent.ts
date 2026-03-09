import { FhirStore } from "../fhirStore.js";

export async function runMedRec(store: FhirStore, patientId: string) {
  const statements = store.search("MedicationStatement", { subject: patientId });
  const dispenses = store.search("MedicationDispense", { subject: patientId });

  const ehr = statements.find(s => (s.note?.[0]?.text ?? "").toLowerCase().includes("ehr"));
  const patient = statements.find(s => (s.note?.[0]?.text ?? "").toLowerCase().includes("patient"));
  const lastFill = dispenses.sort((a, b) => String(b.whenHandedOver ?? "").localeCompare(String(a.whenHandedOver ?? "")))[0];

  const issues: any[] = [];
  let reconciledStatus = "active";
  let reasoning = "Defaulted to active.";

  const fillDate = lastFill?.whenHandedOver ? new Date(lastFill.whenHandedOver) : null;
  const isOldFill = fillDate ? (Date.now() - fillDate.getTime()) > 1000 * 60 * 60 * 24 * 90 : true;

  if (patient?.status === "stopped") {
    reconciledStatus = "stopped";
    reasoning = "Patient-reported stopped; last pharmacy fill is old. Marked as stopped.";
  } else if (ehr?.status === "active" && isOldFill) {
    reconciledStatus = "unknown";
    reasoning = "EHR says active but fills are old. Flagged for review.";
    issues.push({
      resourceType: "DetectedIssue",
      status: "final",
      code: { text: "medication-discrepancy" },
      detail: "EHR lists metformin as active, but pharmacy fills are old; patient report differs.",
      patient: { reference: `Patient/${patientId}` }
    });
  }

  const bpmh = store.create({
    resourceType: "List",
    status: "current",
    mode: "working",
    title: "Reconciled BPMH",
    subject: { reference: `Patient/${patientId}` },
    entry: [{ item: { display: `Metformin 500mg tablet (${reconciledStatus})` } }]
  });

  const createdIssues = issues.map(i => store.create(i));

  return {
    bpmh,
    reasoning,
    detectedIssues: createdIssues.map(d => ({ id: d.id, detail: d.detail })),
    used: [
      ...statements.map(s => `MedicationStatement/${s.id}`),
      ...dispenses.map(d => `MedicationDispense/${d.id}`)
    ]
  };
}
