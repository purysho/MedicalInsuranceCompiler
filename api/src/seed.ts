import { FhirStore } from "./fhirStore.js";

// ── Patient ID constants ──────────────────────────────────────────────────────
export const PO_PATIENT_ID           = "79f8fd18-5044-452d-b9bd-428b1e35e579";
export const LEGACY_PATIENT_ID       = "patient-001";
export const RA_PATIENT_ID           = "patient-ra-001";
export const PO_RA_PATIENT_ID        = "147e21d9-ab4e-449c-aeb4-8f3d6f7b1b4c";
export const COMORBID_PATIENT_ID     = "patient-comorbid-001";
export const PO_COMORBID_PATIENT_ID  = "d6417ffa-1ed8-4bb9-ae4c-d3820c9615f9";
export const INCOMPLETE_PATIENT_ID   = "patient-incomplete-001";
export const EXPIRED_PATIENT_ID      = "patient-expired-001";
export const PAEDIATRIC_PATIENT_ID   = "patient-paediatric-001";
export const URGENT_PATIENT_ID       = "patient-urgent-001";

type SeedOpts = { scenario?: "complete" | "missing"; patientId?: string };

// ── Bernard Rieux — T2D, GLP-1 ───────────────────────────────────────────────
export function seedSynthetic(store: FhirStore, opts: SeedOpts = {}) {
  const scenario = opts.scenario ?? "complete";
  const pid = opts.patientId ?? LEGACY_PATIENT_ID;

  const patientIds = pid === PO_PATIENT_ID
    ? [PO_PATIENT_ID, LEGACY_PATIENT_ID]
    : [LEGACY_PATIENT_ID, PO_PATIENT_ID];

  for (const id of patientIds) {
    store.upsert("Patient", id, {
      resourceType: "Patient", id,
      name: [{ text: id === PO_PATIENT_ID ? "Bernard Rieux" : "Demo Patient" }],
      gender: "male", birthDate: "1947-01-03"
    });
    store.upsert("Coverage", `coverage-${id}`, {
      resourceType: "Coverage", id: `coverage-${id}`, status: "active",
      beneficiary: { reference: `Patient/${id}` }, payor: [{ display: "Demo Payer" }]
    });
    store.upsert("Condition", `condition-t2d-${id}`, {
      resourceType: "Condition", id: `condition-t2d-${id}`,
      subject: { reference: `Patient/${id}` },
      clinicalStatus: { coding: [{ code: "active" }] },
      code: { text: "Type 2 diabetes mellitus" }
    });
    if (scenario === "complete") {
      store.upsert("Observation", `obs-a1c-${id}`, {
        resourceType: "Observation", id: `obs-a1c-${id}`, status: "final",
        code: { text: "HbA1c" }, subject: { reference: `Patient/${id}` },
        effectiveDateTime: "2026-02-10", valueQuantity: { value: 8.4, unit: "%" }
      });
    }
    store.upsert("MedicationStatement", `medstmt-met-ehr-${id}`, {
      resourceType: "MedicationStatement", id: `medstmt-met-ehr-${id}`, status: "active",
      subject: { reference: `Patient/${id}` },
      medicationCodeableConcept: { text: "Metformin 500mg tablet" },
      note: [{ text: "EHR: listed as active" }]
    });
    store.upsert("MedicationStatement", `medstmt-met-pt-${id}`, {
      resourceType: "MedicationStatement", id: `medstmt-met-pt-${id}`, status: "stopped",
      subject: { reference: `Patient/${id}` },
      medicationCodeableConcept: { text: "Metformin 500mg tablet" },
      note: [{ text: "Patient: stopped due to GI intolerance" }]
    });
    store.upsert("MedicationDispense", `meddisp-met-${id}`, {
      resourceType: "MedicationDispense", id: `meddisp-met-${id}`, status: "completed",
      subject: { reference: `Patient/${id}` },
      medicationCodeableConcept: { text: "Metformin 500mg tablet" },
      whenHandedOver: "2025-10-01", quantity: { value: 60, unit: "tablet" }
    });
    store.upsert("Encounter", `enc-${id}`, {
      resourceType: "Encounter", id: `enc-${id}`, status: "finished",
      subject: { reference: `Patient/${id}` }
    });
  }

  store.upsert("Coverage", "coverage-001", {
    resourceType: "Coverage", id: "coverage-001", status: "active",
    beneficiary: { reference: `Patient/${LEGACY_PATIENT_ID}` }, payor: [{ display: "Demo Payer" }]
  });
}

// ── Dorothea Brooke — Rheumatoid Arthritis, Adalimumab ───────────────────────
export function seedRA(store: FhirStore) {
  const ids = [RA_PATIENT_ID, PO_RA_PATIENT_ID];

  for (const id of ids) {
    store.upsert("Patient", id, {
      resourceType: "Patient", id,
      name: [{ family: "Brooke", given: ["Dorothea"], prefix: ["Ms."] }],
      birthDate: "1968-04-22", gender: "female",
    });
    store.upsert("Condition", `condition-ra-${id}`, {
      resourceType: "Condition", id: `condition-ra-${id}`,
      clinicalStatus: { coding: [{ code: "active" }] },
      code: { coding: [{ system: "http://snomed.info/sct", code: "69896004", display: "Rheumatoid arthritis" }], text: "Rheumatoid arthritis" },
      subject: { reference: `Patient/${id}` }, onsetDateTime: "2021-06-01",
    });
    store.upsert("Observation", `obs-das28-${id}`, {
      resourceType: "Observation", id: `obs-das28-${id}`, status: "final",
      code: { text: "DAS28 Disease Activity Score", coding: [{ display: "DAS28" }] },
      subject: { reference: `Patient/${id}` },
      effectiveDateTime: "2026-02-14", valueQuantity: { value: 4.8, unit: "score" },
    });
    store.upsert("MedicationStatement", `medstmt-mtx-ehr-${id}`, {
      resourceType: "MedicationStatement", id: `medstmt-mtx-ehr-${id}`, status: "stopped",
      medicationCodeableConcept: { text: "Methotrexate 15mg weekly" },
      subject: { reference: `Patient/${id}` },
      note: [{ text: "EHR: MTX 15mg/week stopped after 4 months due to elevated LFTs (hepatotoxicity)" }],
      effectivePeriod: { start: "2025-06-01", end: "2025-10-01" },
    });
    store.upsert("MedicationStatement", `medstmt-mtx-pt-${id}`, {
      resourceType: "MedicationStatement", id: `medstmt-mtx-pt-${id}`, status: "stopped",
      medicationCodeableConcept: { text: "Methotrexate 15mg weekly" },
      subject: { reference: `Patient/${id}` },
      note: [{ text: "Patient-reported: stopped methotrexate due to liver enzyme elevation" }],
    });
    store.upsert("MedicationStatement", `medstmt-hcq-${id}`, {
      resourceType: "MedicationStatement", id: `medstmt-hcq-${id}`, status: "stopped",
      medicationCodeableConcept: { text: "Hydroxychloroquine 200mg daily" },
      subject: { reference: `Patient/${id}` },
      note: [{ text: "HCQ 200mg daily — inadequate response after 6 months" }],
      effectivePeriod: { start: "2024-12-01", end: "2025-06-01" },
    });
    store.upsert("Coverage", `coverage-ra-${id}`, {
      resourceType: "Coverage", id: `coverage-ra-${id}`, status: "active",
      beneficiary: { reference: `Patient/${id}` }, payor: [{ display: "Aetna RA Plan" }],
    });
  }
}

// ── Eleanor Vance — T2D + RA comorbid, Dual auth ─────────────────────────────
export function seedComorbid(store: FhirStore) {
  const ids = [COMORBID_PATIENT_ID, PO_COMORBID_PATIENT_ID];

  for (const id of ids) {
    store.upsert("Patient", id, {
      resourceType: "Patient", id,
      name: [{ text: "Eleanor Vance" }],
      birthDate: "1971-09-14", gender: "female",
    });
    store.upsert("Condition", `condition-t2d-${id}`, {
      resourceType: "Condition", id: `condition-t2d-${id}`,
      clinicalStatus: { coding: [{ code: "active" }] },
      code: { text: "Type 2 diabetes mellitus" },
      subject: { reference: `Patient/${id}` }, onsetDateTime: "2018-03-01",
    });
    store.upsert("Condition", `condition-ra-${id}`, {
      resourceType: "Condition", id: `condition-ra-${id}`,
      clinicalStatus: { coding: [{ code: "active" }] },
      code: { coding: [{ system: "http://snomed.info/sct", code: "69896004", display: "Rheumatoid arthritis" }], text: "Rheumatoid arthritis" },
      subject: { reference: `Patient/${id}` }, onsetDateTime: "2020-07-01",
    });
    store.upsert("Observation", `obs-a1c-${id}`, {
      resourceType: "Observation", id: `obs-a1c-${id}`, status: "final",
      code: { text: "HbA1c" },
      subject: { reference: `Patient/${id}` },
      effectiveDateTime: "2026-02-20", valueQuantity: { value: 9.1, unit: "%" },
    });
    store.upsert("Observation", `obs-das28-${id}`, {
      resourceType: "Observation", id: `obs-das28-${id}`, status: "final",
      code: { text: "DAS28 Disease Activity Score", coding: [{ display: "DAS28" }] },
      subject: { reference: `Patient/${id}` },
      effectiveDateTime: "2026-02-20", valueQuantity: { value: 5.6, unit: "score" },
    });
    store.upsert("MedicationStatement", `medstmt-met-${id}`, {
      resourceType: "MedicationStatement", id: `medstmt-met-${id}`, status: "stopped",
      medicationCodeableConcept: { text: "Metformin 1000mg" },
      subject: { reference: `Patient/${id}` },
      note: [{ text: "Stopped due to GI intolerance and renal function concerns" }],
      effectivePeriod: { start: "2024-01-01", end: "2024-08-01" },
    });
    store.upsert("MedicationStatement", `medstmt-sglt2-${id}`, {
      resourceType: "MedicationStatement", id: `medstmt-sglt2-${id}`, status: "stopped",
      medicationCodeableConcept: { text: "Empagliflozin (SGLT-2 inhibitor) 10mg" },
      subject: { reference: `Patient/${id}` },
      note: [{ text: "SGLT-2 trial stopped — recurrent UTIs" }],
      effectivePeriod: { start: "2024-08-01", end: "2025-01-01" },
    });
    store.upsert("MedicationStatement", `medstmt-mtx-${id}`, {
      resourceType: "MedicationStatement", id: `medstmt-mtx-${id}`, status: "stopped",
      medicationCodeableConcept: { text: "Methotrexate 15mg weekly" },
      subject: { reference: `Patient/${id}` },
      note: [{ text: "MTX stopped after 5 months — inadequate response + hepatotoxicity risk" }],
      effectivePeriod: { start: "2025-01-01", end: "2025-06-01" },
    });
    store.upsert("MedicationStatement", `medstmt-lef-${id}`, {
      resourceType: "MedicationStatement", id: `medstmt-lef-${id}`, status: "stopped",
      medicationCodeableConcept: { text: "Leflunomide 20mg daily" },
      subject: { reference: `Patient/${id}` },
      note: [{ text: "Leflunomide stopped — inadequate disease control after 6 months" }],
      effectivePeriod: { start: "2025-06-01", end: "2025-12-01" },
    });
    store.upsert("Coverage", `coverage-${id}`, {
      resourceType: "Coverage", id: `coverage-${id}`, status: "active",
      beneficiary: { reference: `Patient/${id}` }, payor: [{ display: "UnitedHealthcare Choice" }],
    });
  }
}

// ── Marcus Webb — Incomplete clinical note (missing HbA1c) ───────────────────
export function seedIncomplete(store: FhirStore) {
  const id = INCOMPLETE_PATIENT_ID;

  store.upsert("Patient", id, {
    resourceType: "Patient", id,
    name: [{ text: "Marcus Webb" }],
    gender: "male", birthDate: "1965-08-14",
  });
  store.upsert("Condition", `condition-t2d-${id}`, {
    resourceType: "Condition", id: `condition-t2d-${id}`,
    clinicalStatus: { coding: [{ code: "active" }] },
    code: { text: "Type 2 diabetes mellitus" },
    subject: { reference: `Patient/${id}` }, onsetDateTime: "2022-05-01",
  });
  // NOTE: No HbA1c Observation — intentionally missing to trigger denial
  store.upsert("MedicationStatement", `medstmt-met-${id}`, {
    resourceType: "MedicationStatement", id: `medstmt-met-${id}`, status: "stopped",
    medicationCodeableConcept: { text: "Metformin 500mg tablet" },
    subject: { reference: `Patient/${id}` },
    note: [{ text: "Stopped due to GI intolerance — documented by GP 2024-11-01" }],
    effectivePeriod: { start: "2024-06-01", end: "2024-11-01" },
  });
  store.upsert("Coverage", `coverage-${id}`, {
    resourceType: "Coverage", id: `coverage-${id}`, status: "active",
    beneficiary: { reference: `Patient/${id}` }, payor: [{ display: "BlueCross PPO" }],
  });
  // Flag the incomplete record
  store.upsert("Flag", `flag-incomplete-${id}`, {
    resourceType: "Flag", id: `flag-incomplete-${id}`, status: "active",
    subject: { reference: `Patient/${id}` },
    code: { text: "Incomplete clinical documentation — HbA1c result pending" },
    period: { start: new Date().toISOString() },
  });
}

// ── Sandra Okonkwo — Expired prior auth (approved 13 months ago) ─────────────
export function seedExpired(store: FhirStore) {
  const id = EXPIRED_PATIENT_ID;

  store.upsert("Patient", id, {
    resourceType: "Patient", id,
    name: [{ text: "Sandra Okonkwo" }],
    gender: "female", birthDate: "1958-11-02",
  });
  store.upsert("Condition", `condition-t2d-${id}`, {
    resourceType: "Condition", id: `condition-t2d-${id}`,
    clinicalStatus: { coding: [{ code: "active" }] },
    code: { text: "Type 2 diabetes mellitus" },
    subject: { reference: `Patient/${id}` }, onsetDateTime: "2019-02-01",
  });
  store.upsert("Observation", `obs-a1c-${id}`, {
    resourceType: "Observation", id: `obs-a1c-${id}`, status: "final",
    code: { text: "HbA1c" },
    subject: { reference: `Patient/${id}` },
    effectiveDateTime: "2026-03-01",
    valueQuantity: { value: 7.6, unit: "%" },
    note: [{ text: "Measured at renewal visit — prior auth expired, re-authorization required" }],
  });
  store.upsert("MedicationStatement", `medstmt-met-${id}`, {
    resourceType: "MedicationStatement", id: `medstmt-met-${id}`, status: "stopped",
    medicationCodeableConcept: { text: "Metformin 500mg tablet" },
    subject: { reference: `Patient/${id}` },
    note: [{ text: "GI intolerance documented 2023" }],
    effectivePeriod: { start: "2023-01-01", end: "2023-06-01" },
  });
  // The expired prior auth Task
  store.upsert("Task", `task-prior-auth-expired-${id}`, {
    resourceType: "Task", id: `task-prior-auth-expired-${id}`,
    status: "completed",
    description: "Prior Authorization — Semaglutide 1mg weekly (GLP-1) — PREVIOUSLY APPROVED",
    for: { reference: `Patient/${id}` },
    executionPeriod: {
      start: "2024-02-15",
      end:   "2025-02-15",  // expired ~13 months ago
    },
    note: [{ text: "AUTH-7291-XP: Approved 2024-02-15, expired 2025-02-15. Patient maintained on therapy throughout. Renewal required — HbA1c remains at 7.6%." }],
  });
  store.upsert("Coverage", `coverage-${id}`, {
    resourceType: "Coverage", id: `coverage-${id}`, status: "active",
    beneficiary: { reference: `Patient/${id}` }, payor: [{ display: "Aetna PPO Plus" }],
  });
}

// ── Jamie Chen — Paediatric, Type 1 Diabetes, Insulin ───────────────────────
export function seedPaediatric(store: FhirStore) {
  const id = PAEDIATRIC_PATIENT_ID;

  store.upsert("Patient", id, {
    resourceType: "Patient", id,
    name: [{ text: "Jamie Chen" }],
    gender: "male", birthDate: "2012-03-19",
    extension: [{ url: "http://hl7.org/fhir/StructureDefinition/patient-guardianContact", valueBoolean: true }],
  });
  store.upsert("Condition", `condition-t1d-${id}`, {
    resourceType: "Condition", id: `condition-t1d-${id}`,
    clinicalStatus: { coding: [{ code: "active" }] },
    code: {
      text: "Type 1 diabetes mellitus",
      coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: "E10", display: "Type 1 diabetes mellitus" }]
    },
    subject: { reference: `Patient/${id}` }, onsetDateTime: "2020-05-01",
  });
  store.upsert("Observation", `obs-a1c-${id}`, {
    resourceType: "Observation", id: `obs-a1c-${id}`, status: "final",
    code: { text: "HbA1c" },
    subject: { reference: `Patient/${id}` },
    effectiveDateTime: "2026-03-10",
    valueQuantity: { value: 9.8, unit: "%" },
    interpretation: [{ coding: [{ code: "H", display: "High" }] }],
  });
  store.upsert("Observation", `obs-weight-${id}`, {
    resourceType: "Observation", id: `obs-weight-${id}`, status: "final",
    code: { text: "Body weight", coding: [{ system: "http://loinc.org", code: "29463-7" }] },
    subject: { reference: `Patient/${id}` },
    effectiveDateTime: "2026-03-10",
    valueQuantity: { value: 42, unit: "kg" },
  });
  store.upsert("MedicationStatement", `medstmt-insulin-${id}`, {
    resourceType: "MedicationStatement", id: `medstmt-insulin-${id}`, status: "active",
    medicationCodeableConcept: { text: "Insulin glargine (Lantus) — weight-based dosing" },
    subject: { reference: `Patient/${id}` },
    dosage: [{ text: "0.3 units/kg/day subcutaneous — paediatric weight-based regimen" }],
    note: [{ text: "Guardian consent on file. Paediatric endocrinology referral confirmed." }],
  });
  store.upsert("Coverage", `coverage-${id}`, {
    resourceType: "Coverage", id: `coverage-${id}`, status: "active",
    beneficiary: { reference: `Patient/${id}` },
    payor: [{ display: "CHIP / Medicaid Paediatric Programme" }],
    subscriberId: "CHIP-2012-CHN-4921",
  });
}

// ── Rosa Martinez — Urgent/expedited, T2D, HbA1c 11.2%, post-DKA ─────────────
export function seedUrgent(store: FhirStore) {
  const id = URGENT_PATIENT_ID;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  store.upsert("Patient", id, {
    resourceType: "Patient", id,
    name: [{ text: "Rosa Martinez" }],
    gender: "female", birthDate: "1971-07-30",
  });
  store.upsert("Condition", `condition-t2d-${id}`, {
    resourceType: "Condition", id: `condition-t2d-${id}`,
    clinicalStatus: { coding: [{ code: "active" }] },
    code: { text: "Type 2 diabetes mellitus" },
    subject: { reference: `Patient/${id}` }, onsetDateTime: "2015-09-01",
  });
  store.upsert("Condition", `condition-dka-${id}`, {
    resourceType: "Condition", id: `condition-dka-${id}`,
    clinicalStatus: { coding: [{ code: "active" }] },
    code: {
      text: "Diabetic ketoacidosis — recent acute episode",
      coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: "E11.10", display: "DKA without coma" }]
    },
    subject: { reference: `Patient/${id}` },
    onsetDateTime: oneWeekAgo,
    note: [{ text: "Admitted to ED 7 days ago. ICU stay 48hrs. Now medically stable but glycaemic control critical." }],
  });
  store.upsert("Observation", `obs-a1c-${id}`, {
    resourceType: "Observation", id: `obs-a1c-${id}`, status: "final",
    code: { text: "HbA1c" },
    subject: { reference: `Patient/${id}` },
    effectiveDateTime: today,
    valueQuantity: { value: 11.2, unit: "%" },
    interpretation: [{ coding: [{ code: "HH", display: "Critical high — immediate intervention required" }] }],
  });
  store.upsert("MedicationStatement", `medstmt-met-${id}`, {
    resourceType: "MedicationStatement", id: `medstmt-met-${id}`, status: "stopped",
    medicationCodeableConcept: { text: "Metformin 1000mg" },
    subject: { reference: `Patient/${id}` },
    note: [{ text: "Contraindicated post-DKA. GI intolerance also documented. Permanently discontinued." }],
    effectivePeriod: { start: "2024-01-01", end: oneWeekAgo.slice(0, 10) },
  });
  // Active inpatient encounter — signals urgency/expedited review required
  store.upsert("Encounter", `enc-hosp-${id}`, {
    resourceType: "Encounter", id: `enc-hosp-${id}`,
    status: "in-progress",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "IMP", display: "Inpatient" },
    subject: { reference: `Patient/${id}` },
    period: { start: oneWeekAgo },
    reasonCode: [{ text: "Diabetic ketoacidosis — urgent glycaemic stabilisation required" }],
    priority: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActPriority", code: "UR", display: "Urgent/Expedited — 24hr turnaround required" }] },
    hospitalization: {
      admitSource: { coding: [{ code: "emd", display: "Emergency department" }] },
      dischargeDisposition: { coding: [{ code: "home", display: "Pending — patient still inpatient" }] },
    },
  });
  store.upsert("Coverage", `coverage-${id}`, {
    resourceType: "Coverage", id: `coverage-${id}`, status: "active",
    beneficiary: { reference: `Patient/${id}` }, payor: [{ display: "UnitedHealthcare Choice Plus" }],
  });
}
