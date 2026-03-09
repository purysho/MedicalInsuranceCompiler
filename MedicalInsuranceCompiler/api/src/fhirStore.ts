import { randomUUID } from "crypto";

export type FhirResource = Record<string, any> & { resourceType: string; id?: string };

type Store = Record<string, Record<string, FhirResource>>;

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
    return this.store?.[resourceType]?.[id] ?? null;
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

      const wantPatient = patient ? (Array.isArray(patient) ? patient[0] : patient) : null;
      const wantSubject = subject ? (Array.isArray(subject) ? subject[0] : subject) : null;

      if (wantPatient) {
        const rp = pid(r.patient) ?? pid(r.subject) ?? pid(r.for);
        if (!rp) return false;
        if (rp !== wantPatient.replace(/^Patient\//, "")) return false;
      }

      if (wantSubject) {
        const rs = pid(r.subject) ?? pid(r.patient);
        if (!rs) return false;
        if (rs !== wantSubject.replace(/^Patient\//, "")) return false;
      }

      if (code) {
        const want = Array.isArray(code) ? code[0] : code;
        const hay = JSON.stringify(r).toLowerCase();
        if (!hay.includes(String(want).toLowerCase())) return false;
      }

      return true;
    });
  }


  clear(): void {
    this.store = {};
  }

  dump(): Store {
    return this.store;
  }
}
