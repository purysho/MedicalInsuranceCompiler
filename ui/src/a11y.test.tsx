import React from "react";
import { describe, it, expect } from "vitest";
import axe from "axe-core";
import { render } from "./test/render";
import { AppShell } from "./layout/AppShell";
import { PageLayout } from "./layout/PageLayout";
import { CaseWorkspace } from "./pages/CaseWorkspace";
import { CaseListView } from "./pages/CaseList";
import { PatientDirectoryView } from "./pages/PatientDirectory";
import { NewCasePage } from "./pages/NewCasePage";
import { AuditTrailPage } from "./pages/AuditTrailPage";
import { Landing } from "./pages/marketing/Landing";
import { APPEAL_CASE } from "./fixtures/cases";
import { SCENARIO_OUTCOME } from "./fixtures/scenarios";

// Rules that need full-page context (a single main landmark, an <h1>, all
// content inside landmarks) are out of scope for component-level mounting.
const OFF = {
  region: { enabled: false },
  "landmark-one-main": { enabled: false },
  "landmark-unique": { enabled: false },
  "page-has-heading-one": { enabled: false },
  "landmark-no-duplicate-contentinfo": { enabled: false },
  // Contrast can't be computed in jsdom (no layout/canvas). It is verified
  // separately and exactly by tokens.contrast.test.ts against the token values.
  "color-contrast": { enabled: false },
};

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    rules: OFF,
  });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}

describe("WCAG AA (axe-core) — key screens have no violations", () => {
  it("App shell", async () => {
    const { container } = render(
      <AppShell activeNav="cases" onNavigate={() => {}}>
        <PageLayout title="Cases">content</PageLayout>
      </AppShell>
    );
    expect(await violations(container)).toEqual([]);
  });

  it("Case workspace (appeal)", async () => {
    const { container } = render(<CaseWorkspace caseData={APPEAL_CASE} />);
    expect(await violations(container)).toEqual([]);
  });

  it("Case workspace (terminal/outcome)", async () => {
    const { container } = render(<CaseWorkspace caseData={SCENARIO_OUTCOME} />);
    expect(await violations(container)).toEqual([]);
  });

  it("Case list", async () => {
    const { container } = render(
      <CaseListView cases={[{ id: "1", patientName: "A", medication: "M", payer: "P", status: "Intake", lastUpdated: "2024-05-01T00:00:00Z" }]} />
    );
    expect(await violations(container)).toEqual([]);
  });

  it("Patient directory", async () => {
    const { container } = render(
      <PatientDirectoryView patients={[{ patientId: "p1", patientName: "A", activeCases: 1, lastActivity: null }]} />
    );
    expect(await violations(container)).toEqual([]);
  });

  it("New case form", async () => {
    const { container } = render(<NewCasePage onSubmitCase={async () => ({ id: "x" })} />);
    expect(await violations(container)).toEqual([]);
  });

  it("Audit trail page", async () => {
    const { container } = render(<AuditTrailPage events={APPEAL_CASE.timeline} />);
    expect(await violations(container)).toEqual([]);
  });

  it("Marketing landing", async () => {
    const { container } = render(<Landing />);
    expect(await violations(container)).toEqual([]);
  });
});
