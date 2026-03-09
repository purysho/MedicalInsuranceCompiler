import { FhirStore } from "../fhirStore.js";

export async function runComposePacket(
  store: FhirStore,
  args: {
    patientId: string;
    coverageId: string;
    medicationRequestId: string;
    evidenceDocId: string;
    bpmhListId: string;
  }
) {
  const { patientId, coverageId, medicationRequestId, evidenceDocId, bpmhListId } = args;

  const claim = store.create({
    resourceType: "Claim",
    status: "active",
    type: { text: "prior-auth" },
    patient: { reference: `Patient/${patientId}` },
    insurance: [{ coverage: { reference: `Coverage/${coverageId}` } }],
    supportingInfo: [
      { sequence: 1, category: { text: "BPMH" }, valueReference: { reference: `List/${bpmhListId}` } },
      { sequence: 2, category: { text: "EvidenceSummary" }, valueReference: { reference: `DocumentReference/${evidenceDocId}` } },
      { sequence: 3, category: { text: "MedicationRequest" }, valueReference: { reference: `MedicationRequest/${medicationRequestId}` } }
    ]
  });

  const task = store.create({
    resourceType: "Task",
    status: "requested",
    intent: "order",
    for: { reference: `Patient/${patientId}` },
    focus: { reference: `Claim/${claim.id}` },
    description: "Prior authorization submission (demo)"
  });

  const bundleEntries = [
    store.read("Patient", patientId),
    store.read("Coverage", coverageId),
    store.read("MedicationRequest", medicationRequestId),
    store.read("List", bpmhListId),
    store.read("DocumentReference", evidenceDocId),
    claim,
    task
  ].filter(Boolean) as any[];

  const bundle = store.create({
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: bundleEntries.map((r: any) => ({
      fullUrl: `${r.resourceType}/${r.id}`,
      resource: r
    }))
  });

  return { claim, task, bundle };
}
