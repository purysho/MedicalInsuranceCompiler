import { FhirStore } from "../fhirStore.js";

export async function runEvidence(store: FhirStore, patientId: string, bpmhListId: string) {
  const conditions = store.search("Condition", { subject: patientId });
  const observations = store.search("Observation", { subject: patientId });

  const hasT2D = conditions.some(c => (c.code?.text ?? "").toLowerCase().includes("type 2"));
  const a1c = observations.find(o => (o.code?.text ?? "").toLowerCase().includes("a1c"));

  const statements = store.search("MedicationStatement", { subject: patientId });
  const intoleranceStmt = statements.find(s => (s.note?.[0]?.text ?? "").toLowerCase().includes("intolerance"));
  const intolerance = intoleranceStmt?.note?.[0]?.text ?? null;

  const a1cValue = a1c?.valueQuantity?.value ?? null;
  const a1cDate = a1c?.effectiveDateTime ?? null;

  const summaryText =
    `Evidence Summary (demo)\n` +
    `- T2D diagnosis: ${hasT2D ? "YES" : "NO"}\n` +
    `- HbA1c: ${a1cValue ?? "MISSING"}% (${a1cDate ?? "unknown date"})\n` +
    `- Metformin intolerance: ${intolerance ? intolerance : "not documented"}\n` +
    `- BPMH: List/${bpmhListId}\n`;

  const evidenceDoc = store.create({
    resourceType: "DocumentReference",
    status: "current",
    type: { text: "Prior Authorization Evidence Summary" },
    subject: { reference: `Patient/${patientId}` },
    date: new Date().toISOString(),
    content: [{
      attachment: {
        contentType: "text/plain",
        data: Buffer.from(summaryText, "utf8").toString("base64"),
        title: "EvidenceSummary.txt"
      }
    }]
  });

  return {
    derived: { hasT2D, a1cValue: typeof a1cValue === "number" ? a1cValue : (a1cValue ? Number(a1cValue) : null), a1cDate, intolerance },
    evidenceDoc,
    used: [
      ...conditions.map(c => `Condition/${c.id}`),
      ...observations.map(o => `Observation/${o.id}`),
      ...statements.map(s => `MedicationStatement/${s.id}`),
      `List/${bpmhListId}`
    ]
  };
}
