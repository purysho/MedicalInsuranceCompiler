import React, { act } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, click } from "../test/render";
import { CaseListView, CaseRow } from "./CaseList";
import { PatientDirectoryView, PatientRow } from "./PatientDirectory";
import { NewCasePage } from "./NewCasePage";

const ROWS: CaseRow[] = [
  { id: "552-01", patientName: "Eleanor Vance", medication: "Humira", payer: "Meridian", status: "Clinician review", lastUpdated: "2024-05-02T15:40:00Z" },
  { id: "553-02", patientName: "Marcus Bell", medication: "Ozempic", payer: "Northwind", status: "Evidence review", lastUpdated: "2024-05-10T10:00:00Z" },
  { id: "554-03", patientName: "Ada Cole", medication: "Enbrel", payer: "Meridian", status: "Clinician review", lastUpdated: "2024-05-11T10:00:00Z" },
];

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("CaseList filtering", () => {
  it("shows all rows by default and filters by status", () => {
    const { container } = render(<CaseListView cases={ROWS} />);
    expect(container.querySelectorAll("tbody tr").length).toBe(3);
    const chip = Array.from(container.querySelectorAll(".alc-filterchip")).find((b) => b.textContent === "Evidence review")!;
    click(chip);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Marcus Bell");
  });

  it("Open fires with the case id", () => {
    const onOpen = vi.fn();
    const { container } = render(<CaseListView cases={ROWS} onOpen={onOpen} />);
    click(Array.from(container.querySelectorAll(".alc-linkbtn"))[0]);
    expect(onOpen).toHaveBeenCalledWith("552-01");
  });
});

describe("PatientDirectory search", () => {
  const PATIENTS: PatientRow[] = [
    { patientId: "patient-001", patientName: "Eleanor Vance", activeCases: 1, lastActivity: "2024-05-02T15:40:00Z" },
    { patientId: "patient-002", patientName: "Marcus Bell", activeCases: 2, lastActivity: "2024-05-10T10:00:00Z" },
  ];

  it("filters by name", () => {
    const { container } = render(<PatientDirectoryView patients={PATIENTS} />);
    setValue(container.querySelector('input[type="search"]')!, "marcus");
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Marcus Bell");
  });

  it("filters by patient ID", () => {
    const { container } = render(<PatientDirectoryView patients={PATIENTS} />);
    setValue(container.querySelector('input[type="search"]')!, "patient-001");
    expect(container.querySelectorAll("tbody tr").length).toBe(1);
    expect(container.textContent).toContain("Eleanor Vance");
  });
});

describe("NewCasePage validation", () => {
  it("blocks submit when required fields are missing", async () => {
    const onSubmitCase = vi.fn().mockResolvedValue({ id: "x" });
    const { container } = render(<NewCasePage onSubmitCase={onSubmitCase} />);
    const form = container.querySelector("form")!;
    act(() => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(onSubmitCase).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[role="alert"]').length).toBeGreaterThan(0);
  });

  it("submits when all required fields are filled", async () => {
    const onSubmitCase = vi.fn().mockResolvedValue({ id: "case-9" });
    const { container } = render(<NewCasePage onSubmitCase={onSubmitCase} />);
    const inputs = container.querySelectorAll("input");
    setValue(inputs[0] as HTMLInputElement, "Eleanor Vance");
    setValue(inputs[1] as HTMLInputElement, "Humira");
    setValue(inputs[2] as HTMLInputElement, "Meridian");
    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(onSubmitCase).toHaveBeenCalledWith(
      expect.objectContaining({ patientName: "Eleanor Vance", medication: "Humira", payer: "Meridian" })
    );
  });
});
