import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, click } from "../../test/render";
import {
  StatusBadge, EvidenceRow, PayerCriterionRow, CaseTimeline, AuditEventRow, ReviewBlock, AriaPanel,
} from "./index";
import { MOCK_EVENTS, MOCK_CITATIONS, MOCK_DRAFT } from "../../stories/mockData";

// Import every story to prove they mount with mock data (Task 3 done-when).
import statusStory from "../../stories/StatusBadge.story";
import evStory from "../../stories/EvidenceRow.story";
import critStory from "../../stories/PayerCriterionRow.story";
import timelineStory from "../../stories/CaseTimeline.story";
import reviewStory from "../../stories/ReviewBlock.story";
import ariaStory from "../../stories/AriaPanel.story";

describe("clinical components render", () => {
  it("StatusBadge shows a non-color icon plus the label", () => {
    const { container } = render(<StatusBadge status="Submitted" />);
    expect(container.textContent).toContain("Submitted");
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy(); // icon channel
  });

  it("EvidenceRow renders confidence + verification as text (not color alone) and a source link", () => {
    const { container } = render(
      <EvidenceRow source="A1c" date="05/02/24" confidence="high" verificationStatus="verified" reviewerState="accepted" sourceUrl="https://x.test" />
    );
    expect(container.textContent).toContain("High");
    expect(container.textContent).toContain("Verified");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://x.test");
  });

  it("PayerCriterionRow gives each state a distinct icon+label", () => {
    for (const state of ["supported", "missing", "conflicting", "needs-clinician-confirmation"] as const) {
      const { container } = render(<PayerCriterionRow criterion="c" state={state} />);
      expect(container.querySelector(`.alc-crit--${state}`)).toBeTruthy();
    }
  });

  it("AuditEventRow renders timestamp, actor and action", () => {
    const { container } = render(<AuditEventRow event={MOCK_EVENTS[0]} />);
    expect(container.querySelector("time")).toBeTruthy();
    expect(container.textContent).toContain("created the case");
  });
});

describe("CaseTimeline is read-only", () => {
  it("renders events but exposes no edit/delete controls (no buttons/inputs)", () => {
    const { container } = render(<CaseTimeline events={MOCK_EVENTS} />);
    expect(container.querySelectorAll('[role="listitem"]').length).toBe(MOCK_EVENTS.length);
    expect(container.querySelectorAll("button").length).toBe(0);
    expect(container.querySelectorAll("input, textarea, select").length).toBe(0);
  });
});

describe("ReviewBlock approval gate", () => {
  it("Approve is disabled until a comment is entered when requiresComment is true", () => {
    const onApprove = vi.fn();
    function Harness() {
      const [approved, setApproved] = useState(false);
      return (
        <ReviewBlock
          requiredApprover="Clinician reviewer"
          approvalState={approved ? "approved" : "pending"}
          requiresComment
          onApprove={(c) => { onApprove(c); setApproved(true); }}
        />
      );
    }
    const { container } = render(<Harness />);
    const approveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Approve")!;
    expect(approveBtn.disabled).toBe(true); // no comment yet
    click(approveBtn);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("Assign for submission is disabled until approvalState is approved", () => {
    const { container } = render(
      <ReviewBlock requiredApprover="Clinician reviewer" approvalState="pending" onApprove={() => {}} onHandoff={() => {}} />
    );
    const handoff = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Assign for submission")!;
    expect(handoff.disabled).toBe(true);
  });

  it("a blocking warning disables approval", () => {
    const { container } = render(
      <ReviewBlock requiredApprover="Clinician reviewer" approvalState="pending" warning="Conflicting evidence" onApprove={() => {}} />
    );
    const approveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Approve")!;
    expect(approveBtn.disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Conflicting evidence");
  });
});

describe("AriaPanel invariants", () => {
  it("always renders the non-dismissable human-review banner", () => {
    const { container } = render(<AriaPanel draft={MOCK_DRAFT} citations={MOCK_CITATIONS} uncertaintyFlags={[]} />);
    const banner = container.querySelector(".alc-aria__review-banner")!;
    expect(banner.textContent).toContain("Human review required before submission");
    // no dismiss control on the banner
    expect(banner.querySelector("button")).toBeNull();
  });

  it("renders the banner even in loading state", () => {
    const { container } = render(<AriaPanel draft="" citations={[]} uncertaintyFlags={[]} loading />);
    expect(container.querySelector(".alc-aria__review-banner")).toBeTruthy();
    expect(container.textContent).toContain("ARIA is drafting");
  });

  it("citation chips link to their EvidenceItem", () => {
    const { container } = render(<AriaPanel draft={MOCK_DRAFT} citations={MOCK_CITATIONS} uncertaintyFlags={[]} />);
    const chips = container.querySelectorAll(".alc-aria__chip");
    expect(chips.length).toBe(MOCK_CITATIONS.length);
    expect((chips[0] as HTMLAnchorElement).getAttribute("href")).toBeTruthy();
  });

  it("Approve draft is disabled when a blocking reason (uncited paragraph) is present", () => {
    const { container } = render(
      <AriaPanel draft={MOCK_DRAFT} citations={MOCK_CITATIONS} uncertaintyFlags={["x"]} approveBlockedReason="Uncited paragraph" />
    );
    const approve = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Approve draft")!;
    expect(approve.disabled).toBe(true);
  });
});

describe("story files mount with mock data", () => {
  for (const story of [statusStory, evStory, critStory, timelineStory, reviewStory, ariaStory]) {
    it(`${story.title}: ${story.scenes.length} scenes render`, () => {
      expect(story.scenes.length).toBeGreaterThanOrEqual(3);
      for (const scene of story.scenes) {
        const { container, unmount } = render(<>{scene.node}</>);
        expect(container.childElementCount).toBeGreaterThan(0);
        unmount();
      }
    });
  }
});
