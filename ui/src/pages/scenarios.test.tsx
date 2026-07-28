import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "../test/render";
import { CaseWorkspace } from "./CaseWorkspace";
import { AuditTrailPage } from "./AuditTrailPage";
import {
  SCENARIO_INCOMPLETE, SCENARIO_CONFLICTING, SCENARIO_UNCITED, SCENARIO_AWAITING, SCENARIO_OUTCOME,
} from "../fixtures/scenarios";

function findButton(c: HTMLElement, text: string) {
  return Array.from(c.querySelectorAll("button")).find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
}

describe("Scenario 1 — incomplete evidence", () => {
  it("shows Missing for the A1c criterion, a missing-evidence banner, and disables ARIA drafting", () => {
    const { container } = render(<CaseWorkspace caseData={SCENARIO_INCOMPLETE} />);
    // Missing criterion
    expect(container.querySelector(".alc-crit--missing")).toBeTruthy();
    expect(container.textContent).toContain("Recent HbA1c within 90 days");
    // missing-evidence banner
    const banner = container.querySelector(".alc-missing")!;
    expect(banner.textContent).toContain("HbA1c");
    // ARIA disabled with the incomplete-evidence tooltip
    const ariaBtn = findButton(container, "Draft appeal with ARIA")!;
    expect(ariaBtn.disabled).toBe(true);
    expect(container.textContent).toContain("Evidence incomplete — resolve missing items before drafting.");
  });
});

describe("Scenario 2 — conflicting evidence", () => {
  it("shows Conflicting + needs-clinician-confirmation and a ReviewBlock warning that blocks approval", () => {
    const { container } = render(<CaseWorkspace caseData={SCENARIO_CONFLICTING} />);
    expect(container.querySelector(".alc-crit--conflicting")).toBeTruthy();
    expect(container.querySelector(".alc-crit--needs-clinician-confirmation")).toBeTruthy();
    const warn = container.querySelector(".alc-review__warn")!;
    expect(warn.textContent).toContain("Conflicting evidence requires clinician resolution before packet can be approved.");
    // approval blocked
    expect(findButton(container, "Approve")!.disabled).toBe(true);
  });
});

describe("Scenario 3 — ARIA draft with a missing citation", () => {
  it("flags the uncited paragraph and disables Approve draft", () => {
    const { container } = render(<CaseWorkspace caseData={SCENARIO_UNCITED} />);
    // AriaPanel rendered (ariaDraft present)
    expect(container.querySelector(".alc-aria__review-banner")).toBeTruthy();
    // uncertainty flag shown
    expect(container.textContent).toMatch(/no matching EvidenceItem/i);
    // Approve draft disabled
    const approveDraft = findButton(container, "Approve draft")!;
    expect(approveDraft.disabled).toBe(true);
  });
});

describe("Scenario 4 — packet awaiting clinician approval", () => {
  it("is in Clinician review, disables export/submission, and shows the awaiting event", () => {
    const { container } = render(<CaseWorkspace caseData={SCENARIO_AWAITING} />);
    expect(container.textContent).toContain("Clinician review");
    expect(findButton(container, "Export packet")!.disabled).toBe(true);
    expect(findButton(container, "Assign for submission")!.disabled).toBe(true);
    // latest timeline event mentions awaiting clinician approval
    expect(container.textContent).toContain("Awaiting clinician approval");
  });
});

describe("Scenario 5 — completed appeal with auditable outcome", () => {
  it("shows the recorded outcome, disables all actions except View audit trail", () => {
    const { container } = render(<CaseWorkspace caseData={SCENARIO_OUTCOME} />);
    expect(container.textContent).toContain("Outcome recorded");
    expect(container.textContent).toContain("Appeal overturned — approved");
    expect(container.textContent).toContain("Prior authorization granted for 12 months");
    // packet-action buttons and the ARIA trigger are not rendered in terminal state
    expect(findButton(container, "Export packet")).toBeUndefined();
    expect(findButton(container, "Draft appeal with ARIA")).toBeUndefined();
    // the read-only ReviewBlock case actions are disabled
    expect(findButton(container, "Approved")!.disabled).toBe(true);
    expect(findButton(container, "Assign for submission")!.disabled).toBe(true);
    // View audit trail is available (as a link)
    const link = Array.from(container.querySelectorAll("a")).find((a) => a.textContent?.includes("View audit trail"));
    expect(link).toBeTruthy();
  });

  it("full audit trail reconstructs Intake -> Outcome recorded", () => {
    const { container } = render(<AuditTrailPage events={SCENARIO_OUTCOME.timeline} />);
    const rows = container.querySelectorAll('[role="listitem"]');
    expect(rows.length).toBe(SCENARIO_OUTCOME.timeline.length);
    expect(container.textContent).toContain("created the case");
    expect(container.textContent).toContain("recorded outcome");
  });
});
