import { FhirStore } from "./fhirStore.js";

// ── Patient ID constants ──────────────────────────────────────────────────────
export const PO_PATIENT_ID = "79f8fd18-5044-452d-b9bd-428b1e35e579";
export const LEGACY_PATIENT_ID = "patient-001";
export const RA_PATIENT_ID = "patient-ra-001";

type SeedOpts = { scenario?: "complete" | "missing"; patientId?: string };

// ── Bernard Rieux — T2D patient ───────────────────────────────────────────────
export function seedSynthetic(store: FhirStore, opts: SeedOpts = {}) {
  const scenario = opts.scenario ?? "complete";
  const pid = opts.patientId ?? LEGACY_PATIENT_ID;

  const patientIds = pid === PO_PATIENT_ID
    ? [PO_PATIENT_ID, LEGACY_PATIENT_ID]
    : [LEGACY_PATIENT_ID, PO_PATIENT_ID];

  for (const id of patientIds) {
    store.create({
      resourceType: "Patient", id,
      name: [{ text: id === PO_PATIENT_ID ? "Bernard Rieux" : "Demo Patient" }],
      gender: "male", birthDate: "1947-01-03"
    });
    store.create({
      resourceType: "Coverage", id: `coverage-${id}`, status: "active",
      beneficiary: { reference: `Patient/${id}` }, payor: [{ display: "Demo Payer" }]
    });
    store.create({
      resourceType: "Condition", id: `condition-t2d-${id}`,
      subject: { reference: `Patient/${id}` },
      clinicalStatus: { coding: [{ code: "active" }] },
      code: { text: "Type 2 diabetes mellitus" }
    });
    if (scenario === "complete") {
      store.create({
        resourceType: "Observation", id: `obs-a1c-${id}`, status: "final",
        code: { text: "HbA1c" }, subject: { reference: `Patient/${id}` },
        effectiveDateTime: "2026-02-10", valueQuantity: { value: 8.4, unit: "%" }
      });
    }
    store.create({
      resourceType: "MedicationStatement", id: `medstmt-met-ehr-${id}`, status: "active",
      subject: { reference: `Patient/${id}` },
      medicationCodeableConcept: { text: "Metformin 500mg tablet" },
      note: [{ text: "EHR: listed as active" }]
    });
    store.create({
      resourceType: "MedicationStatement", id: `medstmt-met-pt-${id}`, status: "stopped",
      subject: { reference: `Patient/${id}` },
      medicationCodeableConcept: { text: "Metformin 500mg tablet" },
      note: [{ text: "Patient: stopped due to GI intolerance" }]
    });
    store.create({
      resourceType: "MedicationDispense", id: `meddisp-met-${id}`, status: "completed",
      subject: { reference: `Patient/${id}` },
      medicationCodeableConcept: { text: "Metformin 500mg tablet" },
      whenHandedOver: "2025-10-01", quantity: { value: 60, unit: "tablet" }
    });
    store.create({
      resourceType: "Encounter", id: `enc-${id}`, status: "finished",
      subject: { reference: `Patient/${id}` }
    });
  }

  store.create({
    resourceType: "Coverage", id: "coverage-001", status: "active",
    beneficiary: { reference: `Patient/${LEGACY_PATIENT_ID}` }, payor: [{ display: "Demo Payer" }]
  });
}

// ── Dorothea Brooke — Rheumatoid Arthritis patient ────────────────────────────
export function seedRA(store: FhirStore) {
  if (store.read("Patient", RA_PATIENT_ID)) return;

  store.upsert("Patient", RA_PATIENT_ID, {
    resourceType: "Patient", id: RA_PATIENT_ID,
    name: [{ family: "Brooke", given: ["Dorothea"], prefix: ["Ms."] }],
    birthDate: "1968-04-22", gender: "female",
  });
  store.upsert("Coverage", "coverage-ra-001", {
    resourceType: "Coverage", id: "coverage-ra-001", status: "active",
    beneficiary: { reference: `Patient/${RA_PATIENT_ID}` }, payor: [{ display: "Aetna RA Plan" }],
  });
  store.upsert("Condition", `condition-ra-${RA_PATIENT_ID}`, {
    resourceType: "Condition", id: `condition-ra-${RA_PATIENT_ID}`,
    clinicalStatus: { coding: [{ code: "active" }] },
    code: { coding: [{ system: "http://snomed.info/sct", code: "69896004", display: "Rheumatoid arthritis" }], text: "Rheumatoid arthritis" },
    subject: { reference: `Patient/${RA_PATIENT_ID}` }, onsetDateTime: "2021-06-01",
  });
  store.upsert("Observation", `obs-das28-${RA_PATIENT_ID}`, {
    resourceType: "Observation", id: `obs-das28-${RA_PATIENT_ID}`, status: "final",
    code: { text: "DAS28 Disease Activity Score", coding: [{ display: "DAS28" }] },
    subject: { reference: `Patient/${RA_PATIENT_ID}` },
    effectiveDateTime: "2026-02-14", valueQuantity: { value: 4.8, unit: "score" },
  });
  store.upsert("MedicationStatement", `medstmt-mtx-ehr-${RA_PATIENT_ID}`, {
    resourceType: "MedicationStatement", id: `medstmt-mtx-ehr-${RA_PATIENT_ID}`, status: "stopped",
    medicationCodeableConcept: { text: "Methotrexate 15mg weekly" },
    subject: { reference: `Patient/${RA_PATIENT_ID}` },
    note: [{ text: "EHR: MTX 15mg/week stopped after 4 months due to elevated LFTs (hepatotoxicity)" }],
    effectivePeriod: { start: "2025-06-01", end: "2025-10-01" },
  });
  store.upsert("MedicationStatement", `medstmt-mtx-pt-${RA_PATIENT_ID}`, {
    resourceType: "MedicationStatement", id: `medstmt-mtx-pt-${RA_PATIENT_ID}`, status: "stopped",
    medicationCodeableConcept: { text: "Methotrexate 15mg weekly" },
    subject: { reference: `Patient/${RA_PATIENT_ID}` },
    note: [{ text: "Patient-reported: stopped methotrexate due to liver enzyme elevation" }],
  });
  store.upsert("MedicationStatement", `medstmt-hcq-${RA_PATIENT_ID}`, {
    resourceType: "MedicationStatement", id: `medstmt-hcq-${RA_PATIENT_ID}`, status: "stopped",
    medicationCodeableConcept: { text: "Hydroxychloroquine 200mg daily" },
    subject: { reference: `Patient/${RA_PATIENT_ID}` },
    note: [{ text: "HCQ 200mg daily — inadequate response after 6 months" }],
    effectivePeriod: { start: "2024-12-01", end: "2025-06-01" },
  });
}
