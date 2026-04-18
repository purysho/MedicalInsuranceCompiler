import { randomUUID } from "crypto";

export type FhirResource = Record<string, any> & { resourceType: string; id?: string };

type Store = Record<string, Record<string, FhirResource>>;

// ── Prompt Opinion UUID → internal patient ID aliases ─────────────────────────
const PO_ALIAS_MAP = new Map<string, string>([
  ["79f8fd18-5044-452d-b9bd-428b1e35e579", "patient-001"],
  ["147e21d9-ab4e-449c-aeb4-8f3d6f7b1b4c", "patient-ra-001"],
  ["d6417ffa-1ed8-4bb9-ae4c-d3820c9615f9", "patient-comorbid-001"],
  ["c03971b6-de14-485c-b8c5-e6a12a6c7978", "patient-incomplete-001"],
  ["b3966c57-148b-4027-bac9-1bffe6a95a2d", "patient-expired-001"],
  ["2ff631a2-7c7a-43db-8f34-75fbd7938450", "patient-paediatric-001"],
  ["776a2088-fe38-4a36-9478-101fbeb0b8b3", "patient-urgent-001"],
]);

function resolveAlias(id: string): string {
  return PO_ALIAS_MAP.get(id) ?? id;
}

export class FhirStore {
  private store: Store = {};

  create(resource: FhirResource): FhirResource {
    const rt = resource.resourceType;
    if (!rt) throw new Error("resource.resourceType required");
    const id = resource.id ?? randomUUID();
    const copy: FhirResource = { ...resource, id };
    this.store[rt] ??= {};
    this.store[rt][id] = copy;
    return copy;
  }

  read(resourceType: string, id: string): FhirResource | null {
    return this.store?.[resourceType]?.[id]
        ?? this.store?.[resourceType]?.[resolveAlias(id)]
        ?? null;
  }

  update(resourceType: string, id: string, resource: FhirResource): FhirResource {
    if (resourceType !== resource.resourceType) throw new Error("resourceType mismatch");
    const copy: FhirResource = { ...resource, id };
    this.store[resourceType] ??= {};
    this.store[resourceType][id] = copy;
    return copy;
  }

  delete(resourceType: string, id: string): boolean {
    if (!this.store?.[resourceType]?.[id]) return false;
    delete this.store[resourceType][id];
    return true;
  }

  search(resourceType: string, params: Record<string, string | string[]> = {}): FhirResource[] {
    const all = Object.values(this.store?.[resourceType] ?? {});
    const patient = params["patient"];
    const subject = params["subject"];
    const _id = params["_id"];
    const code = params["code"];

    return all.filter((r) => {
      if (_id && r.id !== _id) return false;

      const pid = (v: any) => {
        if (!v) return null;
        if (typeof v === "string") return v.replace(/^Patient\//, "");
        if (typeof v === "object" && typeof v.reference === "string") return v.reference.replace(/^Patient\//, "");
        return null;
      };

      const rawPatient = patient ? (Array.isArray(patient) ? patient[0] : patient) : null;
      const rawSubject = subject ? (Array.isArray(subject) ? subject[0] : subject) : null;
      const wantPatient = rawPatient ? resolveAlias(rawPatient.replace(/^Patient\//, "")) : null;
      const wantSubject = rawSubject ? resolveAlias(rawSubject.replace(/^Patient\//, "")) : null;

      if (wantPatient) {
        const rp = pid(r.patient) ?? pid(r.subject) ?? pid(r.for);
        if (!rp) return false;
        if (resolveAlias(rp) !== wantPatient && rp !== wantPatient) return false;
      }

      if (wantSubject) {
        const rs = pid(r.subject) ?? pid(r.patient);
        if (!rs) return false;
        if (resolveAlias(rs) !== wantSubject && rs !== wantSubject) return false;
      }

      if (code) {
        const want = Array.isArray(code) ? code[0] : code;
        const hay = JSON.stringify(r).toLowerCase();
        if (!hay.includes(String(want).toLowerCase())) return false;
      }

      return true;
    });
  }

  upsert(resourceType: string, id: string, resource: any): FhirResource {
    const copy: FhirResource = { ...resource, resourceType, id };
    this.store[resourceType] ??= {};
    this.store[resourceType][id] = copy;
    return copy;
  }

  listPatients(): FhirResource[] {
    return Object.values(this.store?.["Patient"] ?? {});
  }

  clear(): void {
    this.store = {};
  }

  dump(): Store {
    return this.store;
  }
}
