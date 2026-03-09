/**
 * fhirClient.ts
 *
 * SMART Health IT public FHIR R4 client.
 * Performs live lookups against https://r4.smarthealthit.org
 * and imports patients + clinical resources into ALICE's local store.
 *
 * This demonstrates real interoperability — ALICE can ingest any
 * FHIR-compliant patient record and run prior auth on it immediately.
 */

import { FhirStore } from "./fhirStore.js";

const SMART_BASE = "https://r4.smarthealthit.org";

export type SmartPatientSummary = {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
  source: "smart-health-it";
};

export type ImportResult = {
  patientId: string;
  patientName: string;
  resourcesImported: number;
  resourceBreakdown: Record<string, number>;
  priorAuthRelevance: {
    hasT2D: boolean;
    hasHbA1c: boolean;
    hasMetformin: boolean;
    suitableForGlp1PriorAuth: boolean;
    notes: string[];
  };
  cached: boolean;
};

/**
 * Search for patients on SMART Health IT by name or condition
 */
export async function searchSmartPatients(
  query: string,
  maxResults: number = 5
): Promise<SmartPatientSummary[]> {
  // Search by name
  const url = `${SMART_BASE}/Patient?name=${encodeURIComponent(query)}&_count=${maxResults}`;
  const res = await fetch(url, {
    headers: { Accept: "application/fhir+json" },
  });

  if (!res.ok) {
    throw new Error(`SMART Health IT search failed: ${res.status} ${res.statusText}`);
  }

  const bundle = await res.json() as any;
  const entries = bundle.entry ?? [];

  return entries.map((e: any) => {
    const p = e.resource;
    const nameObj = p.name?.[0];
    const name = nameObj
      ? [nameObj.prefix?.[0], nameObj.given?.[0], nameObj.family].filter(Boolean).join(" ")
      : "Unknown";
    return {
      id: p.id,
      name,
      birthDate: p.birthDate ?? "unknown",
      gender: p.gender ?? "unknown",
      source: "smart-health-it" as const,
    };
  });
}

/**
 * Search for patients with T2D on SMART Health IT
 * Uses condition search to find diabetes patients
 */
export async function searchDiabetesPatients(
  maxResults: number = 10
): Promise<SmartPatientSummary[]> {
  // Search conditions for T2D ICD-10 code E11
  const url = `${SMART_BASE}/Condition?code=E11,44054006&_include=Condition:patient&_count=${maxResults * 2}`;
  const res = await fetch(url, {
    headers: { Accept: "application/fhir+json" },
  });

  if (!res.ok) {
    throw new Error(`SMART Health IT condition search failed: ${res.status}`);
  }

  const bundle = await res.json() as any;
  const entries = bundle.entry ?? [];

  const patients: SmartPatientSummary[] = [];
  const seen = new Set<string>();

  for (const e of entries) {
    if (e.resource?.resourceType !== "Patient") continue;
    const p = e.resource;
    if (seen.has(p.id)) continue;
    seen.add(p.id);

    const nameObj = p.name?.[0];
    const name = nameObj
      ? [nameObj.prefix?.[0], nameObj.given?.[0], nameObj.family].filter(Boolean).join(" ")
      : "Unknown";

    patients.push({
      id: p.id,
      name,
      birthDate: p.birthDate ?? "unknown",
      gender: p.gender ?? "unknown",
      source: "smart-health-it",
    });

    if (patients.length >= maxResults) break;
  }

  return patients;
}

/**
 * Fetch a full patient record from SMART Health IT and import into ALICE's store.
 * Pulls: Patient, Conditions, Observations, MedicationStatements,
 *        MedicationRequests, AllergyIntolerances, Encounters
 */
export async function importPatientFromSmart(
  smartPatientId: string,
  store: FhirStore,
  options: { forceRefresh?: boolean } = {}
): Promise<ImportResult> {
  // Check if already cached
  const existing = store.read("Patient", smartPatientId);
  if (existing && !options.forceRefresh) {
    return buildImportResult(smartPatientId, existing, store, true);
  }

  // Fetch patient demographics
  const patientRes = await fetch(`${SMART_BASE}/Patient/${smartPatientId}`, {
    headers: { Accept: "application/fhir+json" },
  });
  if (!patientRes.ok) {
    throw new Error(`Patient ${smartPatientId} not found on SMART Health IT`);
  }
  const patient = await patientRes.json() as any;

  // Import patient (preserve original ID)
  store.upsert("Patient", smartPatientId, patient);

  // Fetch all relevant resource types in parallel
  const resourceTypes = [
    "Condition",
    "Observation",
    "MedicationStatement",
    "MedicationRequest",
    "MedicationDispense",
    "AllergyIntolerance",
    "Encounter",
    "DiagnosticReport",
  ];

  const fetches = resourceTypes.map(async (rt) => {
    try {
      const url = `${SMART_BASE}/${rt}?patient=${smartPatientId}&_count=50`;
      const r = await fetch(url, { headers: { Accept: "application/fhir+json" } });
      if (!r.ok) return { rt, resources: [] };
      const b = await r.json() as any;
      return { rt, resources: (b.entry ?? []).map((e: any) => e.resource).filter(Boolean) };
    } catch {
      return { rt, resources: [] };
    }
  });

  const results = await Promise.all(fetches);
  const breakdown: Record<string, number> = { Patient: 1 };

  for (const { rt, resources } of results) {
    breakdown[rt] = resources.length;
    for (const resource of resources) {
      if (resource.id) {
        store.upsert(rt, resource.id, resource);
      }
    }
  }

  return buildImportResult(smartPatientId, patient, store, false, breakdown);
}

function buildImportResult(
  patientId: string,
  patient: any,
  store: FhirStore,
  cached: boolean,
  breakdown?: Record<string, number>
): ImportResult {
  const nameObj = patient.name?.[0];
  const patientName = nameObj
    ? [nameObj.prefix?.[0], nameObj.given?.[0], nameObj.family].filter(Boolean).join(" ")
    : "Unknown";

  // Analyse clinical relevance for GLP-1 prior auth
  const conditions = store.search("Condition", { subject: patientId });
  const observations = store.search("Observation", { subject: patientId });
  const medStatements = store.search("MedicationStatement", { subject: patientId });
  const medRequests = store.search("MedicationRequest", { subject: patientId });

  const allMedText = JSON.stringify([...medStatements, ...medRequests]).toLowerCase();
  const allCondText = JSON.stringify(conditions).toLowerCase();
  const allObsText = JSON.stringify(observations).toLowerCase();

  const hasT2D =
    allCondText.includes("type 2") ||
    allCondText.includes("e11") ||
    allCondText.includes("44054006") ||
    allCondText.includes("diabetes mellitus");

  const hasHbA1c =
    allObsText.includes("hba1c") ||
    allObsText.includes("a1c") ||
    allObsText.includes("glycated") ||
    allObsText.includes("4548-4") ||
    allObsText.includes("17856-6");

  const hasMetformin =
    allMedText.includes("metformin");

  const notes: string[] = [];
  if (!hasT2D) notes.push("No T2D diagnosis found — may not qualify for GLP-1 prior auth");
  if (!hasHbA1c) notes.push("No HbA1c observation found — AI note extraction may be needed");
  if (!hasMetformin) notes.push("No metformin history found — step therapy criterion may be unmet");
  if (hasT2D && hasHbA1c && hasMetformin) notes.push("All three prior auth criteria appear to be present in FHIR data");

  const resourcesImported = breakdown
    ? Object.values(breakdown).reduce((a, b) => a + b, 0)
    : Object.values(
        ["Condition","Observation","MedicationStatement","MedicationRequest","AllergyIntolerance"]
          .reduce((acc, rt) => ({ ...acc, [rt]: store.search(rt, { subject: patientId }).length }), {} as Record<string, number>)
      ).reduce((a, b) => a + b, 0);

  return {
    patientId,
    patientName,
    resourcesImported,
    resourceBreakdown: breakdown ?? {},
    priorAuthRelevance: {
      hasT2D,
      hasHbA1c,
      hasMetformin,
      suitableForGlp1PriorAuth: hasT2D,
      notes,
    },
    cached,
  };
}
