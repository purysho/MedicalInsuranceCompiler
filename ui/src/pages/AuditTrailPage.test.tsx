import React from "react";
import { describe, it, expect } from "vitest";
import { render, click } from "../test/render";
import { AuditTrailPage } from "./AuditTrailPage";
import { ProvenancePanel, ProvenanceStep } from "../components/clinical/ProvenancePanel";
import { APPEAL_CASE } from "../fixtures/cases";

const STEPS: ProvenanceStep[] = [
  { id: "pr1", recorded: "2024-05-02T14:03:00Z", activity: "assemble-evidence", agent: "ALICE", used: ["Patient/patient-001"], target: ["DocumentReference/d1"] },
  { id: "pr2", recorded: "2024-05-02T15:00:00Z", activity: "compose-packet", agent: "ALICE", used: ["DocumentReference/d1"], target: ["DocumentReference/packet-1"] },
  { id: "pr3", recorded: "2024-05-02T15:40:00Z", activity: "draft-appeal", agent: "ARIA", used: ["DocumentReference/packet-1"], target: ["DocumentReference/appeal-1"] },
];

describe("AuditTrailPage is read-only", () => {
  it("has the read-only heading and renders the timeline", () => {
    const { container } = render(<AuditTrailPage events={APPEAL_CASE.timeline} />);
    const h1 = container.querySelector("h1")!;
    expect(h1.textContent).toContain("read only");
    expect(container.querySelectorAll('[role="listitem"]').length).toBe(APPEAL_CASE.timeline.length);
  });

  it("exposes NO edit/delete/hide controls (no button/input/textarea/select)", () => {
    const { container } = render(<AuditTrailPage events={APPEAL_CASE.timeline} provenance={STEPS} />);
    expect(container.querySelectorAll("button, input, textarea, select").length).toBe(0);
  });
});

describe("ProvenancePanel", () => {
  it("renders every provenance step for a case", () => {
    const { container } = render(<ProvenancePanel steps={STEPS} />);
    expect(container.querySelectorAll(".alc-prov__step").length).toBe(STEPS.length);
    expect(container.textContent).toContain("assemble-evidence");
    expect(container.textContent).toContain("draft-appeal");
  });

  it("each step is expandable (native details/summary) and read-only", () => {
    const { container } = render(<ProvenancePanel steps={STEPS} />);
    const first = container.querySelector("details")!;
    expect(first.querySelector("summary")).toBeTruthy();
    // read-only: no form controls inside the provenance chain
    expect(container.querySelectorAll("button, input, textarea, select").length).toBe(0);
    // expanding does not throw
    click(first.querySelector("summary"));
  });

  it("shows an empty state when there is no provenance", () => {
    const { container } = render(<ProvenancePanel steps={[]} />);
    expect(container.textContent).toContain("No provenance recorded");
  });
});
