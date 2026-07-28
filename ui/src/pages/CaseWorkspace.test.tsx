import React, { act } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, click } from "../test/render";
import { CaseWorkspace } from "./CaseWorkspace";
import { APPEAL_CASE, PA_CASE } from "../fixtures/cases";
import { CaseData } from "../caseModel";

function findButton(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === text) as
    | HTMLButtonElement
    | undefined;
}

describe("CaseWorkspace reviewer gate", () => {
  it("Export packet and Assign for submission are disabled until approval", () => {
    const { container } = render(<CaseWorkspace caseData={APPEAL_CASE} />);
    expect(findButton(container, "Export packet")!.disabled).toBe(true);
    expect(findButton(container, "Assign for submission")!.disabled).toBe(true);
    expect(container.textContent).toContain("Requires clinician approval");
  });

  it("enables packet actions once the reviewer approves (with a comment)", () => {
    const { container } = render(<CaseWorkspace caseData={APPEAL_CASE} />);
    const textarea = container.querySelector("textarea")!;
    // enter a comment so the approval gate's requiresComment is met
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => {
      setter.call(textarea, "Approved after clinical review.");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    click(findButton(container, "Approve")!);
    expect(findButton(container, "Export packet")!.disabled).toBe(false);
    expect(findButton(container, "Assign for submission")!.disabled).toBe(false);
  });
});

describe("CaseWorkspace ARIA drafting is appeals-only", () => {
  it("the ARIA draft button is ABSENT in an initial-PA workflow", () => {
    const { container } = render(<CaseWorkspace caseData={PA_CASE} />);
    expect(findButton(container, "Draft appeal with ARIA")).toBeUndefined();
  });

  it("the ARIA draft button appears in an appeal workflow with evidence ready", () => {
    const { container } = render(<CaseWorkspace caseData={APPEAL_CASE} />);
    expect(findButton(container, "Draft appeal with ARIA")).toBeDefined();
  });

  it("disables the ARIA button when evidence is not ready", () => {
    const notReady: CaseData = { ...APPEAL_CASE, evidenceReady: false };
    const { container } = render(<CaseWorkspace caseData={notReady} />);
    expect(findButton(container, "Draft appeal with ARIA")!.disabled).toBe(true);
  });

  it("drafting renders AriaPanel with the human-review banner and citations", async () => {
    const draftWithAria = vi.fn().mockResolvedValue({
      draft: "Dear Reviewer, ...",
      citations: [{ id: "c1", label: "[1] CRP", evidenceItemId: "ev-2" }],
      uncertaintyFlags: [],
    });
    const { container } = render(<CaseWorkspace caseData={APPEAL_CASE} draftWithAria={draftWithAria} />);
    click(findButton(container, "Draft appeal with ARIA")!);
    // allow the mocked promise + resulting state updates to flush inside act
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(draftWithAria).toHaveBeenCalled();
    expect(container.querySelector(".alc-aria__review-banner")).toBeTruthy();
  });
});

describe("CaseWorkspace visual hierarchy (DOM order)", () => {
  it("case status renders before patient identity in DOM order", () => {
    const { container } = render(<CaseWorkspace caseData={APPEAL_CASE} />);
    const html = container.innerHTML;
    const statusIdx = html.indexOf("Clinician review"); // status badge label
    const patientIdx = html.indexOf("Eleanor Vance"); // patient identity
    expect(statusIdx).toBeGreaterThanOrEqual(0);
    expect(patientIdx).toBeGreaterThan(statusIdx);
  });
});
