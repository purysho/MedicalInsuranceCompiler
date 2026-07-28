import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, click } from "../test/render";
import { AppShell, NAV_ITEMS } from "./AppShell";
import { PageLayout } from "./PageLayout";

function Harness({ onNav }: { onNav?: (id: string) => void }) {
  const [active, setActive] = useState("cases");
  return (
    <AppShell activeNav={active} onNavigate={(id) => { setActive(id); onNav?.(id); }}>
      <PageLayout title="Cases">content</PageLayout>
    </AppShell>
  );
}

describe("AppShell navigation", () => {
  it("renders the ALICE wordmark and the five nav items", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector(".alc-wordmark")?.textContent).toContain("ALICE");
    const navBtns = container.querySelectorAll(".alc-nav__item");
    expect(navBtns.length).toBe(NAV_ITEMS.length);
    expect(Array.from(navBtns).map((b) => b.textContent)).toEqual(
      expect.arrayContaining(["Cases", "Tasks", "Evidence", "Insights", "Settings"].map((s) => expect.stringContaining(s)))
    );
  });

  it("ARIA is NOT a nav item", () => {
    const { container } = render(<Harness />);
    const labels = Array.from(container.querySelectorAll(".alc-nav__item")).map((b) => b.textContent ?? "");
    expect(labels.some((l) => /ARIA/i.test(l))).toBe(false);
  });

  it("marks the active nav item with aria-current=page", () => {
    const { container } = render(<Harness />);
    const current = container.querySelector('[aria-current="page"]')!;
    expect(current.textContent).toContain("Cases");
  });

  it("clicking a nav item activates it (keyboard-reachable buttons)", () => {
    const onNav = vi.fn();
    const { container } = render(<Harness onNav={onNav} />);
    const evidenceBtn = Array.from(container.querySelectorAll(".alc-nav__item")).find((b) => b.textContent?.includes("Evidence"))!;
    click(evidenceBtn);
    expect(onNav).toHaveBeenCalledWith("evidence");
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain("Evidence");
  });

  it("nav items are real <button>s (Tab-focusable, Enter/Space activate natively)", () => {
    const { container } = render(<Harness />);
    for (const el of container.querySelectorAll(".alc-nav__item")) {
      expect(el.tagName).toBe("BUTTON");
    }
  });
});

describe("top bar", () => {
  it("renders workspace, global search, notifications and a user role chip", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector(".alc-topbar__workspace")).toBeTruthy();
    expect(container.querySelector('input[aria-label="Global search"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Notifications"]')).toBeTruthy();
    expect(container.querySelector(".alc-topbar__role")).toBeTruthy();
  });
});

describe("branding gate", () => {
  it("no h1/h2 contains ARIA as a standalone product name", () => {
    const { container } = render(<Harness />);
    for (const h of container.querySelectorAll("h1, h2")) {
      expect(/\bARIA\b/.test(h.textContent ?? "")).toBe(false);
    }
  });
});
