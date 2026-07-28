import { describe, it, expect } from "vitest";
import { FhirStore } from "./fhirStore.js";
import { createCase, listCases, listPatientDirectory } from "./cases.js";

describe("createCase validation", () => {
  it("throws when required fields are missing", () => {
    const store = new FhirStore();
    expect(() => createCase(store, { medication: "", payer: "", workflowType: "appeal" } as any))
      .toThrow(/Missing required fields/);
    expect(() => createCase(store, { patientName: "A", medication: "Humira", payer: "", workflowType: "appeal" } as any))
      .toThrow(/payer/);
  });

  it("rejects an invalid workflow type", () => {
    const store = new FhirStore();
    expect(() => createCase(store, { patientName: "A", medication: "X", payer: "P", workflowType: "bogus" as any }))
      .toThrow(/workflowType/);
  });

  it("creates a case Task and lists it", () => {
    const store = new FhirStore();
    const rec = createCase(store, { patientName: "Eleanor Vance", medication: "Humira", payer: "Meridian", workflowType: "appeal" });
    expect(rec.medication).toBe("Humira");
    expect(rec.payer).toBe("Meridian");
    expect(rec.workflowType).toBe("appeal");
    expect(rec.status).toBe("Intake");

    const cases = listCases(store);
    expect(cases.length).toBe(1);
    expect(cases[0].patientName).toBe("Eleanor Vance");
  });

  it("patient directory aggregates active case counts", () => {
    const store = new FhirStore();
    store.create({ resourceType: "Patient", id: "p1", name: [{ text: "Eleanor Vance" }] });
    createCase(store, { patientId: "p1", patientName: "Eleanor Vance", medication: "Humira", payer: "M", workflowType: "appeal" });
    createCase(store, { patientId: "p1", patientName: "Eleanor Vance", medication: "Ozempic", payer: "N", workflowType: "initial-pa" });
    const dir = listPatientDirectory(store);
    const row = dir.find((r) => r.patientId === "p1")!;
    expect(row.activeCases).toBe(2);
    expect(row.lastActivity).toBeTruthy();
  });
});
