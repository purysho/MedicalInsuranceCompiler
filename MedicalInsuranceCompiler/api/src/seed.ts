import { FhirStore } from "./fhirStore.js";

export function seedSynthetic(store: FhirStore, opts: { scenario?: "complete" | "missing" } = {}) {
  const scenario = opts.scenario ?? "complete";
  store.create({
    resourceType: "Patient",
    id: "patient-001",
    name: [{ text: "Demo Patient" }],
    gender: "female",
    birthDate: "1984-03-15"
  });

  store.create({
    resourceType: "Coverage",
    id: "coverage-001",
    status: "active",
    beneficiary: { reference: "Patient/patient-001" },
    payor: [{ display: "Demo Payer" }]
  });

  store.create({
    resourceType: "Condition",
    id: "condition-t2d-001",
    subject: { reference: "Patient/patient-001" },
    clinicalStatus: { coding: [{ code: "active" }] },
    code: { text: "Type 2 diabetes mellitus" }
  });

  if (scenario === "complete") {
  store.create({
    resourceType: "Observation",
    id: "obs-a1c-001",
    status: "final",
    code: { text: "HbA1c" },
    subject: { reference: "Patient/patient-001" },
    effectiveDateTime: "2026-02-10",
    valueQuantity: { value: 8.4, unit: "%" }
  });

}

  store.create({
    resourceType: "MedicationStatement",
    id: "medstmt-met-ehr",
    status: "active",
    subject: { reference: "Patient/patient-001" },
    medicationCodeableConcept: { text: "Metformin 500mg tablet" },
    note: [{ text: "EHR: listed as active" }]
  });

  store.create({
    resourceType: "MedicationStatement",
    id: "medstmt-met-pt",
    status: "stopped",
    subject: { reference: "Patient/patient-001" },
    medicationCodeableConcept: { text: "Metformin 500mg tablet" },
    note: [{ text: "Patient: stopped due to GI intolerance" }]
  });

  store.create({
    resourceType: "MedicationDispense",
    id: "meddisp-met-001",
    status: "completed",
    subject: { reference: "Patient/patient-001" },
    medicationCodeableConcept: { text: "Metformin 500mg tablet" },
    whenHandedOver: "2025-10-01",
    quantity: { value: 60, unit: "tablet" }
  });

  store.create({
    resourceType: "Encounter",
    id: "enc-001",
    status: "finished",
    subject: { reference: "Patient/patient-001" }
  });
}
