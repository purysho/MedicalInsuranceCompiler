import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "../../test/render";
import { Landing } from "./Landing";
import { BuyerPage, BUYERS } from "./BuyerPage";
import { MarketingSite } from "./index";

describe("Marketing landing", () => {
  it("includes the human-review safeguards section", () => {
    const { container } = render(<Landing />);
    expect(container.textContent).toContain("Human-review safeguards");
    expect(container.textContent).toMatch(/reviewer signs off|human review required/i);
  });

  it("states the ALICE tagline and does not claim autonomous decisions", () => {
    const { container } = render(<Landing />);
    expect(container.textContent).toContain("ALICE prepares the work. Your team makes the decision.");
    expect(container.textContent).toMatch(/not a clinical decision-maker|No autonomous coverage decision|never makes autonomous/i);
  });

  it("does NOT present ARIA as a standalone product name in H1/H2 headings", () => {
    const { container } = render(<Landing />);
    for (const h of container.querySelectorAll("h1, h2")) {
      expect(/\bARIA\b/.test(h.textContent ?? "")).toBe(false);
    }
  });

  it("renders the 7-step workflow diagram", () => {
    const { container } = render(<Landing />);
    expect(container.querySelectorAll(".mkt__step").length).toBe(7);
  });

  it("does not use the ARIA token chip styling on marketing", () => {
    const { container } = render(<Landing />);
    expect(container.querySelector(".alc-aria__chip")).toBeNull();
    expect(container.querySelector(".alc-aria__badge")).toBeNull();
  });
});

describe("Buyer pages", () => {
  for (const slug of Object.keys(BUYERS)) {
    it(`${slug}: includes safeguards and no ARIA in H1/H2`, () => {
      const { container } = render(<BuyerPage slug={slug} />);
      expect(container.textContent).toContain("Human-review safeguards");
      for (const h of container.querySelectorAll("h1, h2")) {
        expect(/\bARIA\b/.test(h.textContent ?? "")).toBe(false);
      }
    });
  }

  it("MarketingSite routes /marketing/pa-teams to the buyer page", () => {
    const { container } = render(<MarketingSite pathname="/marketing/pa-teams" />);
    expect(container.textContent).toContain(BUYERS["pa-teams"].title);
  });

  it("MarketingSite routes /marketing/ to the landing", () => {
    const { container } = render(<MarketingSite pathname="/marketing/" />);
    expect(container.querySelectorAll(".mkt__step").length).toBe(7);
  });
});
