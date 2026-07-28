import { FhirStore } from "./fhirStore.js";

export interface ProvenanceStep {
  id: string;
  recorded?: string;
  activity: string;
  agent: string;
  used: string[];
  target: string[];
}

function patientRefOf(r: any): string | null {
  const ref = r?.subject ?? r?.patient ?? r?.for;
  if (!ref) return null;
  if (typeof ref === "string") return ref.replace(/^Patient\//, "");
  if (typeof ref.reference === "string") return ref.reference.replace(/^Patient\//, "");
  return null;
}

/**
 * Collect the FHIR Provenance chain for a case. Cases are patient-centric in
 * V1, so caseId resolves to a patient. Returns every Provenance whose target or
 * used-entity references touch a resource in the patient's bundle (or the
 * patient directly). Read-only — never mutates the store.
 */
export function collectCaseProvenance(store: FhirStore, caseId: string): ProvenanceStep[] {
  const patient = store.read("Patient", caseId);
  const resolvedPid = patient?.id ?? caseId;

  // Build the set of "ResourceType/id" that belong to this patient's bundle.
  const belongs = new Set<string>([`Patient/${resolvedPid}`, `Patient/${caseId}`]);
  const dump = store.dump();
  for (const [rt, byId] of Object.entries(dump)) {
    if (rt === "Provenance") continue;
    for (const [id, r] of Object.entries(byId as Record<string, any>)) {
      const rp = patientRefOf(r);
      if (rp && (rp === resolvedPid || rp === caseId)) belongs.add(`${rt}/${id}`);
    }
  }

  const refMatches = (ref?: string) =>
    !!ref && (belongs.has(ref) || ref.includes(resolvedPid) || ref.includes(caseId));

  return store
    .search("Provenance", {})
    .filter((p: any) => {
      const targets = (p.target ?? []).map((t: any) => t.reference);
      const used = (p.entity ?? []).map((e: any) => e.what?.reference);
      return [...targets, ...used].some(refMatches);
    })
    .map((p: any) => ({
      id: p.id,
      recorded: p.recorded,
      activity: p.activity?.text ?? "activity",
      agent: p.agent?.[0]?.who?.display ?? "unknown",
      used: (p.entity ?? []).map((e: any) => e.what?.reference).filter(Boolean),
      target: (p.target ?? []).map((t: any) => t.reference).filter(Boolean),
    }));
}
