import { FhirStore } from "./fhirStore.js";

// Prompt Opinion patient ID for Bernard Rieux
export const PO_PATIENT_ID = "79f8fd18-5044-452d-b9bd-428b1e35e579";
// Keep legacy ID working too
export const LEGACY_PATIENT_ID = "patient-001";

export function seedSynthetic(store: FhirStore, opts: { scenario?: "complete" | "missing"; patientId?: string } = {}) {
  const scenario = opts.scenario ?? "complete";
  // Support both the Prompt Opinion patient ID and the legacy demo ID
  const pid = opts.patientId ?? LEGACY_PATIENT_ID;

  // Seed both IDs so either works
  const patientIds = pid === PO_PATIENT_ID
    ? [PO_PATIENT_ID, LEGACY_PATIENT_ID]
    : [LEGACY_PATIENT_ID, PO_PATIENT_ID];

  for (const id of patientIds) {
    store.create({
      resourceType: "Patient",
      id,
      name: [{ text: id === PO_PATIENT_ID ? "Bernard Rieux" : "Demo Patient" }],
      gender: "male",
      birthDate: "1947-01-03"
    });

    store.create({
      resourceType: "Coverage",
      id: `coverage-${id}`,
      status: "active",
      beneficiary: { reference: `Patient/${id}` },
      payor: [{ display: "Demo Payer" }]
    });

    store.create({
      resourceType: "Condition",
      id: `condition-t2d-${id}`,
      subject: { reference: `Patient/${id}` },
      clinicalStatus: { coding: [{ code: "active" }] },
      code: { text: "Type 2 diabetes mellitus" }
    });

    if (scenario === "complete") {
      store.create({
        resourceType: "Observation",
        id: `obs-a1c-${id}`,
        status: "final",
        code: { text: "HbA1c" },
        subject: { reference: `Patient/${id}` },
        effectiveDateTime: "2026-02-10",
        valueQuantity: { value: 8.4, unit: "%" }
      });
    }

    store.create({
      resourceType: "MedicationStatement",
      id: `medstmt-met-ehr-${id}`,
      status: "active",
      subject: { reference: `Patient/${id}` },
      medicationCodeableConcept: { text: "Metformin 500mg tablet" },
      note: [{ text: "EHR: listed as active" }]
    });

    store.create({
      resourceType: "MedicationStatement",
      id: `medstmt-met-pt-${id}`,
      status: "stopped",
      subject: { reference: `Patient/${id}` },
      medicationCodeableConcept: { text: "Metformin 500mg tablet" },
      note: [{ text: "Patient: stopped due to GI intolerance" }]
    });

    store.create({
      resourceType: "MedicationDispense",
      id: `meddisp-met-${id}`,
      status: "completed",
      subject: { reference: `Patient/${id}` },
      medicationCodeableConcept: { text: "Metformin 500mg tablet" },
      whenHandedOver: "2025-10-01",
      quantity: { value: 60, unit: "tablet" }
    });

    store.create({
      resourceType: "Encounter",
      id: `enc-${id}`,
      status: "finished",
      subject: { reference: `Patient/${id}` }
    });
  }

  // Keep legacy coverage-001 for backward compat
  store.create({
    resourceType: "Coverage",
    id: "coverage-001",
    status: "active",
    beneficiary: { reference: `Patient/${LEGACY_PATIENT_ID}` },
    payor: [{ display: "Demo Payer" }]
  });
}
