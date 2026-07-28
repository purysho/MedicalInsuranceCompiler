import { describe, it, expect } from "vitest";
import { FhirStore } from "./fhirStore.js";
import { writeProvenance } from "./agents/auditAgent.js";
import { collectCaseProvenance } from "./provenance.js";

describe("collectCaseProvenance", () => {
  it("returns provenance whose targets/used-entities touch the patient bundle", () => {
    const store = new FhirStore();
    store.create({ resourceType: "Patient", id: "p1" });
    const doc = store.create({ resourceType: "DocumentReference", id: "d1", subject: { reference: "Patient/p1" } });
    store.create({ resourceType: "Patient", id: "p2" });
    const otherDoc = store.create({ resourceType: "DocumentReference", id: "d2", subject: { reference: "Patient/p2" } });

    writeProvenance(store, {
      activityText: "assemble-evidence",
      agent: "ALICE",
      usedRefs: ["Patient/p1"],
      targetRefs: [`DocumentReference/${doc.id}`],
    });
    writeProvenance(store, {
      activityText: "unrelated",
      agent: "ALICE",
      usedRefs: ["Patient/p2"],
      targetRefs: [`DocumentReference/${otherDoc.id}`],
    });

    const steps = collectCaseProvenance(store, "p1");
    expect(steps.length).toBe(1);
    expect(steps[0].activity).toBe("assemble-evidence");
    expect(steps[0].agent).toBe("ALICE");
    expect(steps[0].target[0]).toContain("DocumentReference/d1");
  });

  it("returns an empty list for a patient with no provenance (read-only, no throw)", () => {
    const store = new FhirStore();
    store.create({ resourceType: "Patient", id: "lonely" });
    expect(collectCaseProvenance(store, "lonely")).toEqual([]);
  });
});
