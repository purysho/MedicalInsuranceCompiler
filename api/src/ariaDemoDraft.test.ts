import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isDemoMode, buildAriaDemoDraft } from "./ariaDemoDraft.js";

const ENV_KEYS = ["OPENAI_BASE_URL", "ALICE_DEMO_MODE"] as const;

describe("isDemoMode", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("is on when no provider base URL is configured", () => {
    expect(isDemoMode()).toBe(true);
  });

  it("is off once a provider base URL is configured", () => {
    process.env.OPENAI_BASE_URL = "https://api.openai.com/v1";
    expect(isDemoMode()).toBe(false);
  });

  it("can be forced on even with a provider configured", () => {
    process.env.OPENAI_BASE_URL = "https://api.openai.com/v1";
    process.env.ALICE_DEMO_MODE = "1";
    expect(isDemoMode()).toBe(true);
  });
});

describe("buildAriaDemoDraft", () => {
  const ctx = {
    patientName: "Jordan Ellis",
    requestedMedication: "adalimumab 40mg",
    payer: "Northwind Health",
    evidence: [
      { source: "Rheumatology consult note", date: "2026-02-11" },
      { source: "Methotrexate trial record", date: "2025-11-03" },
    ],
  };

  it("labels the output as a sample so it cannot pass as model output", () => {
    const { text } = buildAriaDemoDraft(ctx);
    expect(text).toMatch(/SAMPLE DRAFT/);
    expect(text).toMatch(/without a language model/i);
  });

  it("uses the real case facts and cites evidence by bracket index", () => {
    const { text } = buildAriaDemoDraft(ctx);
    expect(text).toContain("Jordan Ellis");
    expect(text).toContain("adalimumab 40mg");
    expect(text).toContain("Northwind Health");
    expect(text).toContain("[1] Rheumatology consult note (2026-02-11)");
    expect(text).toContain("[2] Methotrexate trial record (2025-11-03)");
  });

  it("always flags that the draft needs clinician verification", () => {
    const { uncertaintyFlags } = buildAriaDemoDraft(ctx);
    expect(uncertaintyFlags.length).toBeGreaterThan(0);
    expect(uncertaintyFlags.join(" ")).toMatch(/verified against the source record/i);
  });

  it("is deterministic", () => {
    expect(buildAriaDemoDraft(ctx).text).toBe(buildAriaDemoDraft(ctx).text);
  });

  it("degrades safely with no context at all", () => {
    const { text, uncertaintyFlags } = buildAriaDemoDraft();
    expect(text).toMatch(/SAMPLE DRAFT/);
    expect(text).toContain("the patient");
    expect(uncertaintyFlags.join(" ")).toMatch(/no verifiable citations/i);
  });

  it("flags the empty-evidence case explicitly", () => {
    const { uncertaintyFlags } = buildAriaDemoDraft({ ...ctx, evidence: [] });
    expect(uncertaintyFlags.join(" ")).toMatch(/No approved evidence/i);
  });
});
