import React from "react";
import { AppShell } from "./layout/AppShell";
import { PageLayout } from "./layout/PageLayout";
import { useHashRoute, routeSegment } from "./layout/router";
import { EmptyState, Button } from "./components/primitives";
import { CaseWorkspace } from "./pages/CaseWorkspace";
import { AuditTrailPage } from "./pages/AuditTrailPage";
import { CaseList } from "./pages/CaseList";
import { PatientDirectory } from "./pages/PatientDirectory";
import { NewCasePage } from "./pages/NewCasePage";
import { MarketingSite } from "./pages/marketing";
import { DEMO_CASES, APPEAL_CASE } from "./fixtures/cases";

// Placeholder page shown for nav destinations that later build-order tasks fill
// in (Cases workspace = Task 5, Patient directory / case list = Task 7, etc.).
function Placeholder({ title, blurb }: { title: string; blurb: string }) {
  return (
    <PageLayout title={title}>
      <EmptyState
        icon="🗂"
        heading={title}
        description={blurb}
        action={<Button variant="secondary" onClick={() => { window.location.hash = "#/cases"; }}>Back to Cases</Button>}
      />
    </PageLayout>
  );
}

export default function App() {
  const [route, navigate] = useHashRoute();
  const seg = routeSegment(route);

  // Marketing pages live outside the app shell at real /marketing/* paths
  // (the server SPA-fallback serves index.html for them).
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  if (pathname.startsWith("/marketing")) {
    return <MarketingSite pathname={pathname} />;
  }

  let content: React.ReactNode;
  switch (seg) {
    case "cases": {
      // cases -> list; cases/<id> -> workspace for that case.
      const id = route.split("/")[1];
      if (!id) {
        content = (
          <CaseList
            onOpen={(cid) => navigate(`cases/${cid}`)}
            onNewCase={() => navigate("new-case")}
            onOpenDirectory={() => navigate("patients")}
          />
        );
      } else {
        const caseData = DEMO_CASES[id] || APPEAL_CASE;
        content = <CaseWorkspace caseData={caseData} />;
      }
      break;
    }
    case "patients":
      content = <PatientDirectory onOpenPatient={() => navigate("cases")} />;
      break;
    case "new-case":
      content = <NewCasePage onCreated={() => navigate("cases")} />;
      break;
    case "audit": {
      const id = route.split("/")[1];
      const caseData = (id && DEMO_CASES[id]) || APPEAL_CASE;
      content = <AuditTrailPage events={caseData.timeline} />;
      break;
    }
    case "tasks":
      content = <Placeholder title="Tasks" blurb="Assigned submission and review tasks appear here." />;
      break;
    case "evidence":
      content = <Placeholder title="Evidence" blurb="Source documents and the evidence ledger appear here." />;
      break;
    case "insights":
      content = <Placeholder title="Insights" blurb="Overturn rate, turnaround, and completeness metrics appear here." />;
      break;
    case "settings":
      content = <Placeholder title="Settings" blurb="Workspace, roles, and integration settings appear here." />;
      break;
    default:
      content = <Placeholder title="Not found" blurb={`No page for “${route}”.`} />;
  }

  return (
    <AppShell activeNav={seg} onNavigate={navigate}>
      {content}
    </AppShell>
  );
}
