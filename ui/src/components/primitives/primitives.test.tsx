import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, click, keyDown } from "../../test/render";
import {
  Button, IconButton, TextInput, Textarea, Select, Checkbox, Radio,
  Tabs, Avatar, Tooltip, Toast, EmptyState, ConfirmDialog,
} from "./index";

describe("primitives render without error", () => {
  it("Button renders its label and default variant/size classes", () => {
    const { container } = render(<Button>Save packet</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.textContent).toContain("Save packet");
    expect(btn.className).toContain("alc-btn--primary");
    expect(btn.className).toContain("alc-btn--md");
  });

  it("IconButton always carries an accessible label", () => {
    const { container } = render(<IconButton label="Flag for review">⚑</IconButton>);
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toBe("Flag for review");
  });

  it("TextInput links label, error message and aria-invalid", () => {
    const { container } = render(
      <TextInput label="Medication" error="Required" required defaultValue="" />
    );
    const input = container.querySelector("input")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const err = container.querySelector('[role="alert"]')!;
    expect(err.textContent).toContain("Required");
    expect(input.getAttribute("aria-describedby")).toBe(err.id);
  });

  it("Textarea and Select render with labels and options", () => {
    const ta = render(<Textarea label="Notes" />);
    expect(ta.container.querySelector("textarea")).toBeTruthy();
    const sel = render(
      <Select label="Payer" options={[{ value: "a", label: "Aetna" }]} placeholder="Choose" />
    );
    expect(sel.container.querySelectorAll("option").length).toBe(2);
  });

  it("Checkbox and Radio render text labels", () => {
    const c = render(<Checkbox label="Confirm evidence complete" />);
    expect(c.container.textContent).toContain("Confirm evidence complete");
    const r = render(<Radio name="wf" label="Appeal" />);
    expect(r.container.querySelector('input[type="radio"]')).toBeTruthy();
  });

  it("Avatar falls back to initials", () => {
    const { container } = render(<Avatar name="Eleanor Vance" />);
    expect(container.textContent).toContain("EV");
    expect(container.querySelector('[aria-label="Eleanor Vance"]')).toBeTruthy();
  });

  it("Tooltip and EmptyState render", () => {
    const t = render(<Tooltip label="More info"><button>hover</button></Tooltip>);
    expect(t.container.querySelector('[role="tooltip"]')?.textContent).toContain("More info");
    const e = render(<EmptyState heading="No cases yet" description="Create one" />);
    expect(e.container.textContent).toContain("No cases yet");
  });

  it("Toast pairs color with a non-color word for status", () => {
    const { container } = render(<Toast variant="warning">Conflicting evidence</Toast>);
    expect(container.querySelector(".alc-toast--warning")).toBeTruthy();
    // non-color channel: the word "Warning" is present for screen readers
    expect(container.textContent).toContain("Warning");
  });
});

describe("Button disabled + loading behavior", () => {
  it("disabled Button is not clickable", () => {
    const onClick = vi.fn();
    const { container } = render(<Button disabled onClick={onClick}>Export</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.disabled).toBe(true);
    click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading Button is busy and disabled", () => {
    const onClick = vi.fn();
    const { container } = render(<Button loading onClick={onClick}>Drafting</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.disabled).toBe(true);
    click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Tabs keyboard navigation + aria roles", () => {
  const tabs = [
    { id: "a", label: "Overview", content: <p>Overview panel</p> },
    { id: "b", label: "Evidence", content: <p>Evidence panel</p> },
    { id: "c", label: "Audit", content: <p>Audit panel</p> },
  ];

  it("has tablist/tab/tabpanel roles and one selected tab", () => {
    const { container } = render(<Tabs tabs={tabs} aria-label="Case sections" />);
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
    const tabEls = container.querySelectorAll('[role="tab"]');
    expect(tabEls.length).toBe(3);
    expect(container.querySelectorAll('[aria-selected="true"]').length).toBe(1);
  });

  it("ArrowRight moves selection to the next tab", () => {
    const { container } = render(<Tabs tabs={tabs} aria-label="Case sections" />);
    const first = container.querySelectorAll('[role="tab"]')[0];
    keyDown(first, "ArrowRight");
    const selected = container.querySelector('[aria-selected="true"]')!;
    expect(selected.textContent).toBe("Evidence");
  });
});

describe("ConfirmDialog focus trap + escape", () => {
  function Harness() {
    const [open, setOpen] = useState(true);
    return (
      <ConfirmDialog
        open={open}
        title="Discard draft?"
        confirmLabel="Discard"
        confirmVariant="danger"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        This cannot be undone.
      </ConfirmDialog>
    );
  }

  it("renders a modal dialog with an accessible name", () => {
    const { container } = render(<Harness />);
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(container.ownerDocument.body.textContent).toContain("Discard draft?");
  });

  it("Escape cancels and unmounts the dialog", () => {
    render(<Harness />);
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    keyDown(document.body, "Escape");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
