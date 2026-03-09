import { useEffect, useMemo, useRef, useState } from "react";

// In production we default to same-origin (no CORS headaches). For local dev, set VITE_API_URL.
const API = (import.meta.env.VITE_API_URL ?? "").trim();

type AnyObj = any;
type Scenario = "complete" | "missing";

async function post(path: string, body: AnyObj) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function get(path: string) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function asArray(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "object") return Object.values(v);
  return [];
}

function formatIsoDate(d?: string) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toISOString().slice(0, 10);
}

export default function App() {
  const [scenario, setScenario] = useState<Scenario>("complete");
  const [policyVariant, setPolicyVariant] = useState<"standard" | "strict">("standard");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [seeded, setSeeded] = useState(false);
  const [patientId] = useState("patient-001");
  const [coverageId] = useState("coverage-001");

  const [messy, setMessy] = useState<AnyObj | null>(null);
  const [medrec, setMedrec] = useState<AnyObj | null>(null);
  const [medReq, setMedReq] = useState<AnyObj | null>(null);

  const [policy, setPolicy] = useState<AnyObj | null>(null);
  const [evidence, setEvidence] = useState<AnyObj | null>(null);
  const [packet, setPacket] = useState<AnyObj | null>(null);
  const [decision, setDecision] = useState<AnyObj | null>(null);

  const [trace, setTrace] = useState<AnyObj | null>(null);
  const [messages, setMessages] = useState<AnyObj | null>(null);
  const [mcpLog, setMcpLog] = useState<AnyObj | null>(null);
  const [bundleView, setBundleView] = useState<any | null>(null);
  const [selectedResourceType, setSelectedResourceType] = useState<string>("ClaimResponse");

  const lastRunRef = useRef<number>(0);

  // Audit trail state
  const [auditTrail, setAuditTrail] = useState<any | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditView, setAuditView] = useState<"timeline" | "graph">("timeline");

  // SMART Health IT state
  const [smartQuery, setSmartQuery] = useState("");
  const [smartResults, setSmartResults] = useState<any[]>([]);
  const [smartImported, setSmartImported] = useState<any | null>(null);
  const [smartBusy, setSmartBusy] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);

  function resetState(keepSeeded = false) {
    setError(null);
    setMedrec(null);
    setMedReq(null);
    setPolicy(null);
    setEvidence(null);
    setPacket(null);
    setDecision(null);
    setTrace(null);
    setMessages(null);
    setMcpLog(null);
    setBundleView(null);
    if (!keepSeeded) {
      setSeeded(false);
      setMessy(null);
    }
  }

  // Derive some useful “context” even before evidence runs (from seeded data).
  const derivedFromDump = useMemo(() => {
    const dump = messy ?? {};
    const conditions = asArray(dump.Condition);
    const obs = asArray(dump.Observation);

    const hasT2D = conditions.some((c: any) => JSON.stringify(c).toLowerCase().includes("type 2"));
    const a1cObs = obs.find((o: any) => JSON.stringify(o).toLowerCase().includes("a1c"));
    const a1cValue =
      a1cObs?.valueQuantity?.value ??
      a1cObs?.value?.value ??
      a1cObs?.valueQuantity?.code ??
      null;
    const a1cDate = a1cObs?.effectiveDateTime ?? a1cObs?.issued ?? null;

    // naive metformin presence check (seeded meds are metformin)
    const medStatements = asArray(dump.MedicationStatement);
    const hasMetforminTrial = medStatements.some((m: any) => (m.medicationCodeableConcept?.text ?? "").toLowerCase().includes("metformin"));

    return { hasT2D, a1cValue, a1cDate, hasMetforminTrial };
  }, [messy]);

  const requestContext = useMemo(() => {
    const a1cValue = evidence?.derived?.a1cValue ?? derivedFromDump.a1cValue;
    const a1cDate = evidence?.derived?.a1cDate ?? derivedFromDump.a1cDate;
    const hasT2D = (evidence?.derived?.hasT2D ?? derivedFromDump.hasT2D) === true;

    const intolerance = evidence?.derived?.intolerance;
    const hasMetforminIntolerance = !!intolerance;

    const hasMetforminTrial = derivedFromDump.hasMetforminTrial || hasMetforminIntolerance;

    const usedRefs: string[] = [];
    if (medrec?.used) usedRefs.push(...medrec.used);
    if (evidence?.evidenceDoc?.id) usedRefs.push(`DocumentReference/${evidence.evidenceDoc.id}`);
    if (medrec?.bpmh?.id) usedRefs.push(`List/${medrec.bpmh.id}`);
    if (medReq?.medicationRequest?.id) usedRefs.push(`MedicationRequest/${medReq.medicationRequest.id}`);
    usedRefs.push(`Patient/${patientId}`, `Coverage/${coverageId}`);

    return { hasT2D, a1cValue, a1cDate, hasMetforminTrial, hasMetforminIntolerance, policyVariant, usedRefs };
  }, [evidence, derivedFromDump, medrec, medReq, patientId, coverageId, policyVariant]);

  const step = useMemo(() => {
    if (!seeded) return 1;
    if (!medrec?.bpmh?.id) return 2;
    if (!medReq?.medicationRequest?.id) return 3;
    if (!evidence?.evidenceDoc?.id) return 4;
    if (!packet?.bundle?.id) return 5;
    if (!decision?.claimResponse?.id) return 6;
    return 7;
  }, [seeded, medrec, medReq, evidence, packet, decision]);

  async function safeRun<T>(label: string, fn: () => Promise<T>) {
    const runId = Date.now();
    lastRunRef.current = runId;
    setBusy(label);
    setError(null);
    try {
      const out = await fn();
      // Ignore late responses if a newer run started.
      if (lastRunRef.current !== runId) return out;
      return out;
    } catch (e: any) {
      if (lastRunRef.current === runId) setError(e?.message ?? String(e));
      throw e;
    } finally {
      if (lastRunRef.current === runId) setBusy(null);
    }
  }

  async function onSeed() {
    return safeRun("Seeding Synthetic FHIR", async () => {
      await post("/seed", { scenario });
      setSeeded(true);
      const dump = await get("/fhir-dump");
      setMessy(dump);

      // reset downstream
      setPolicy(null);
      setMedrec(null);
      setEvidence(null);
      setPacket(null);
      setDecision(null);
      setTrace(null);
      setMessages(null);
      setMedReq(null);

      return true;
    });
  }


  async function onMedRec() {
    return safeRun("Running MedRec Agent", async () => {
      const out = await post("/run/medrec", { patientId });
      setMedrec(out);
      return out;
    });
  }


  async function onPrescribe() {
    return safeRun("Creating MedicationRequest", async () => {
      const out = await post("/clinician/prescribe", { patientId });
      setMedReq(out);
      return out;
    });
  }


  async function onEvidence(bpmhListIdOverride?: string) {
    const bpmhListId = bpmhListIdOverride ?? medrec?.bpmh?.id;
    if (!bpmhListId) {
      setError("Run MedRec first (Step 2).");
      return null;
    }
    return safeRun("Gathering Evidence", async () => {
      const out = await post("/run/evidence", { patientId, bpmhListId });
      setEvidence(out);
      return out;
    });
  }

  async function onPolicy() {
    return safeRun("Checking Policy", async () => {
      const out = await post("/run/policy-check", { requestContext });
      setPolicy(out);
      return out;
    });
  }


  async function onCompose(overrides?: {
    medicationRequestId?: string;
    evidenceDocId?: string;
    bpmhListId?: string;
  }) {
    const medicationRequestId = overrides?.medicationRequestId ?? medReq?.medicationRequest?.id;
    const evidenceDocId = overrides?.evidenceDocId ?? evidence?.evidenceDoc?.id;
    const bpmhListId = overrides?.bpmhListId ?? medrec?.bpmh?.id;

    if (!medicationRequestId) {
      setError("Prescribe GLP-1 first (Step 3).");
      return null;
    }
    if (!evidenceDocId) {
      setError("Gather Evidence first (Step 4).");
      return null;
    }
    if (!bpmhListId) {
      setError("Run MedRec first (Step 2).");
      return null;
    }

    return safeRun("Composing Packet (FHIR Bundle)", async () => {
      const out = await post("/run/compose", {
        patientId,
        coverageId,
        medicationRequestId,
        evidenceDocId,
        bpmhListId
      });
      setPacket(out);
      return out;
    });
  }

  async function onSubmit(claimIdOverride?: string) {
    const claimId = claimIdOverride ?? packet?.claim?.id;
    if (!claimId) {
      setError("Compose Packet first (Step 5).");
      return null;
    }
    return safeRun("Submitting to Payer", async () => {
      const out = await post("/run/submit", { requestContext, claimId });
      setDecision(out);
      return out;
    });
  }

  async function onTrace() {
    return safeRun("Loading Trace", async () => {
      const out = await get("/trace");
      setTrace(out);
      return out;
    });
  }


  async function onMessages() {
    return safeRun("Loading A2A Messages", async () => {
      const out = await get("/messages");
      setMessages(out);
      return out;
    });
  }

  async function onLoadAudit() {
    setAuditBusy(true);
    try {
      const res = await get("/api/audit/patient-001");
      setAuditTrail(res);
    } catch (e: any) {
      setAuditTrail(null);
    } finally {
      setAuditBusy(false);
    }
  }

  async function onSmartSearch() {
    if (!smartQuery.trim()) return;
    setSmartBusy(true);
    setSmartError(null);
    setSmartResults([]);
    try {
      const res = await post("/api/smart/search", { query: smartQuery, maxResults: 6 });
      setSmartResults(res.patients ?? []);
      if (!res.patients?.length) setSmartError("No patients found. Try a different name.");
    } catch (e: any) {
      setSmartError(e.message);
    } finally {
      setSmartBusy(false);
    }
  }

  async function onSmartImport(patientId: string) {
    setSmartBusy(true);
    setSmartError(null);
    try {
      const res = await post("/api/smart/import", { smartPatientId: patientId });
      setSmartImported(res);
    } catch (e: any) {
      setSmartError(e.message);
    } finally {
      setSmartBusy(false);
    }
  }

  async function onMcpLog() {
    return safeRun("Loading MCP Tool Log", async () => {
      const out = await get("/mcp-log");
      setMcpLog(out);
      return out;
    });
  }

  async function loadBundleForExplorer() {
    const bundleId = packet?.bundle?.id;
    if (!bundleId) {
      setError("Compose Packet first to create a Bundle.");
      return null;
    }
    return safeRun("Loading Bundle", async () => {
      const r = await fetch(`${API}/packet/${bundleId}`);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const json = await r.json();
      setBundleView(json);
      return json;
    });
  }

  // Denial → Fix → Resubmit loop
  async function fixAndResubmit() {
    try {
      // simulate a new HbA1c lab arriving
      await safeRun("Simulating HbA1c Lab", async () => {
        return post("/simulate/lab", { patientId, value: 8.4 });
      });
      // refresh dump so policy pre-derivation updates
      const dump = await safeRun("Refreshing Data", async () => get("/fhir-dump"));
      if (dump) setMessy(dump);

      // rerun evidence + compose + submit using current IDs
      const bpmhId = medrec?.bpmh?.id;
      const mrId = medReq?.medicationRequest?.id;
      if (!bpmhId || !mrId) {
        setError("Need MedRec + MedicationRequest before resubmitting.");
        return;
      }
      const evidenceOut = await onEvidence(bpmhId);
      const composeOut = await onCompose({
        medicationRequestId: mrId,
        evidenceDocId: evidenceOut?.evidenceDoc?.id,
        bpmhListId: bpmhId
      });
      await onSubmit(composeOut?.claim?.id);
      await onTrace();
      await onMessages();
      await onMcpLog();
    } catch {
      // handled by safeRun
    }
  }


  async function runFullDemo() {
    try {
      await onSeed();
      const medrecOut = await onMedRec();
      const prescribeOut = await onPrescribe();
      const evidenceOut = await onEvidence(medrecOut?.bpmh?.id);
      await onPolicy();
      const composeOut = await onCompose({
        medicationRequestId: prescribeOut?.medicationRequest?.id,
        evidenceDocId: evidenceOut?.evidenceDoc?.id,
        bpmhListId: medrecOut?.bpmh?.id
      });
      await onSubmit(composeOut?.claim?.id);
      await onTrace();
      await onMessages();
      await onMcpLog();
    } catch {
      // errors are already surfaced via setError in safeRun
    }
  }

  function downloadBundle() {
    const bundleId = packet?.bundle?.id;
    if (!bundleId) return alert("Compose Packet first to create a Bundle.");
    window.open(`${API}/packet/${bundleId}`, "_blank");
  }

  // Messy sources panels
  const medStatements = useMemo(() => asArray(messy?.MedicationStatement), [messy]);
  const dispenses = useMemo(() => asArray(messy?.MedicationDispense), [messy]);

  const medsEhr = medStatements.filter((m: any) => (m.note?.[0]?.text ?? "").toLowerCase().includes("ehr"));
  const medsPatient = medStatements.filter((m: any) => (m.note?.[0]?.text ?? "").toLowerCase().includes("patient"));
  const fills = dispenses;

  const policyMissing = (policy?.missing ?? []) as string[];
  const decisionMissing = (decision?.policyResult?.missing ?? []) as string[];

  const bundleEntries = packet?.bundle?.entry ?? [];
  const bundleCount = Array.isArray(bundleEntries) ? bundleEntries.length : 0;
  const bundleTypes = Array.from(
    new Set(
      (Array.isArray(bundleEntries) ? bundleEntries : []).map((e: any) => e?.resource?.resourceType).filter(Boolean)
    )
  );

  const agentsExecuted = useMemo(() => {
    // Derived from provenance activities if present
    const prov = asArray(trace?.provenance);
    const names = prov
      .map((p: any) => p?.agent?.display ?? p?.activity?.text ?? "")
      .map((s: string) => String(s))
      .filter((s: string) => s.length > 0);

    // If provenance isn't loaded, use messages list
    if (names.length > 0) return Array.from(new Set(names));
    const msgs = asArray(messages?.messages);
    return Array.from(new Set(msgs.map((m: any) => m.to).filter(Boolean)));
  }, [trace, messages]);

  useEffect(() => {
    // On first load, if API is same-origin, show a gentle hint if not seeded yet.
    // (No-op: purely for UX, kept simple.)
  }, []);

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <div className="logo">A</div>
          <div>
            <h1>ALICE</h1>
            <div className="sub">Automated Lifecycle for Insurance &amp; Clinical Evidence</div>
          </div>
        </div>

        <div className="btnrow">
          <span className={`badge ${API ? "info" : ""}`}>
            {API ? `API: ${API}` : "API: same-origin"}
          </span>
          <button className="primary" onClick={runFullDemo} disabled={!!busy}>
            {busy ? "Running…" : "Run Full Demo"}
          </button>
          <button className="ghost" onClick={() => resetState(false)} disabled={!!busy}>
            Reset
          </button>
        </div>
      </div>

      <div className="pills">
        <StepPill n={1} label="Seed Data" active={step === 1} done={seeded} />
        <StepPill n={2} label="MedRec" active={step === 2} done={!!medrec?.bpmh?.id} />
        <StepPill n={3} label="Prescribe GLP-1" active={step === 3} done={!!medReq?.medicationRequest?.id} />
        <StepPill n={4} label="Gather Evidence" active={step === 4} done={!!evidence?.evidenceDoc?.id} />
        <StepPill n={5} label="Packet (Bundle)" active={step === 5} done={!!packet?.bundle?.id} />
        <StepPill n={6} label="Decision" active={step === 6} done={!!decision?.claimResponse?.id} />
        <StepPill n={7} label="Trace" active={step === 7} done={!!trace?.provenance} />
      </div>

      {error ? (
        <div className="card" style={{ borderColor: "rgba(220,38,38,0.35)" }}>
          <h2>Something went wrong</h2>
          <div className="muted">{error}</div>
        </div>
      ) : null}

      <div className="grid">
        {/* Sidebar */}
        <div className="list">
          <div className="card">
            <h2>Demo Steps</h2>
            <div className="list">
              <DemoStep n={1} text="Seed synthetic FHIR data" done={seeded} />
              <DemoStep n={2} text="Run MedRec to reconcile meds (BPMH)" done={!!medrec?.bpmh?.id} />
              <DemoStep n={3} text="Prescribe GLP-1 (MedicationRequest)" done={!!medReq?.medicationRequest?.id} />
              <DemoStep n={4} text="Gather clinical evidence (Condition + A1c + history)" done={!!evidence?.evidenceDoc?.id} />
              <DemoStep n={5} text="Compose prior auth packet (FHIR Bundle)" done={!!packet?.bundle?.id} />
              <DemoStep n={6} text="Submit to payer + receive ClaimResponse" done={!!decision?.claimResponse?.id} />
            </div>

            <div className="kv" style={{ marginTop: 12 }}>
              <span className="muted">Scenario</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={`small ${scenario === "complete" ? "primary" : ""}`}
                  onClick={() => setScenario("complete")}
                  disabled={!!busy}
                >
                  Complete
                </button>
                <button
                  className={`small ${scenario === "missing" ? "primary" : ""}`}
                  onClick={() => setScenario("missing")}
                  disabled={!!busy}
                >
                  Missing Evidence
                </button>
              </div>
            </div>

            <div className="kv" style={{ marginTop: 12 }}>
              <span className="muted">Policy Variant</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className={`small ${policyVariant === "standard" ? "primary" : ""}`}
                  onClick={() => setPolicyVariant("standard")}
                  disabled={!!busy}
                  title="A1c threshold 7.0"
                >
                  Standard
                </button>
                <button
                  className={`small ${policyVariant === "strict" ? "primary" : ""}`}
                  onClick={() => setPolicyVariant("strict")}
                  disabled={!!busy}
                  title="A1c threshold 8.0"
                >
                  Strict
                </button>
              </div>
            </div>

            <div className="kv" style={{ marginTop: 12 }}>
              <button className="small" onClick={onSeed} disabled={!!busy}>
                1) Seed Data
              </button>
              <button className="small" onClick={downloadBundle} disabled={!packet?.bundle?.id || !!busy}>
                Download Bundle JSON
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Standards + Agents</h2>
            <div className="muted">This demo is built to show interoperable agents coordinating via standards.</div>

            <div className="list" style={{ marginTop: 10 }}>
              <div className="item">
                <strong>FHIR</strong>
                <span>Shared clinical data model for meds, evidence, and the prior-auth packet.</span>
              </div>
              <div className="item">
                <strong>MCP Tools</strong>
                <span>Agents access system capabilities through tool calls (fhir.*, policy.check).</span>
              </div>
              <div className="item">
                <strong>A2A</strong>
                <span>Agent-to-agent messages coordinate provider and payer workflows.</span>
              </div>
              <div className="item">
                <strong>Provenance</strong>
                <span>Every step records an audit trail linking outputs to the specific inputs used.</span>
              </div>
            </div>

            <div className="kv" style={{ marginTop: 12 }}>
              <button className="small" onClick={onTrace} disabled={!seeded || !!busy}>Trace</button>
              <button className="small" onClick={onMessages} disabled={!seeded || !!busy}>A2A Messages</button>
              <button className="small" onClick={onMcpLog} disabled={!seeded || !!busy}>MCP Tools</button>
            </div>
          </div>

          {/* SMART Health IT Panel */}
          <div className="card">
            <h2>🌐 SMART Health IT</h2>
            <div className="muted" style={{ marginBottom: 10 }}>
              Live FHIR R4 patient lookup via <strong>r4.smarthealthit.org</strong>. Import real patients and run full prior auth pipeline.
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Search patient by name…"
                value={smartQuery}
                onChange={e => setSmartQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onSmartSearch()}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit", fontSize: 13 }}
                disabled={smartBusy}
              />
              <button className="small primary" onClick={onSmartSearch} disabled={smartBusy || !smartQuery.trim()}>
                {smartBusy ? "…" : "Search"}
              </button>
            </div>

            {smartError && <div className="muted" style={{ color: "rgba(220,100,100,0.9)", marginBottom: 8, fontSize: 12 }}>{smartError}</div>}

            {smartResults.length > 0 && (
              <div className="list" style={{ marginBottom: 10 }}>
                {smartResults.map(p => (
                  <div key={p.id} className="item" style={{ flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                      <div>
                        <strong style={{ fontSize: 13 }}>{p.name}</strong>
                        <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>{p.birthDate} · {p.gender}</span>
                      </div>
                      <button
                        className="small"
                        onClick={() => onSmartImport(p.id)}
                        disabled={smartBusy}
                        style={{ fontSize: 11 }}
                      >
                        Import
                      </button>
                    </div>
                    <div className="muted" style={{ fontSize: 10, fontFamily: "monospace" }}>{p.id}</div>
                  </div>
                ))}
              </div>
            )}

            {smartImported && (
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: 10, fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>✅ Imported: {smartImported.patientName}</div>
                <div className="kv"><span className="muted">Patient ID</span><code style={{ fontSize: 11 }}>{smartImported.patientId}</code></div>
                <div className="kv"><span className="muted">Resources</span><span>{smartImported.resourcesImported}</span></div>
                <div className="kv"><span className="muted">T2D</span><span>{smartImported.priorAuthRelevance?.hasT2D ? "✅ Yes" : "❌ No"}</span></div>
                <div className="kv"><span className="muted">HbA1c</span><span>{smartImported.priorAuthRelevance?.hasHbA1c ? "✅ Found" : "❌ Not found"}</span></div>
                <div className="kv"><span className="muted">Metformin</span><span>{smartImported.priorAuthRelevance?.hasMetformin ? "✅ Found" : "❌ Not found"}</span></div>
                {smartImported.priorAuthRelevance?.notes?.map((n: string, i: number) => (
                  <div key={i} className="muted" style={{ fontSize: 11, marginTop: 4 }}>• {n}</div>
                ))}
                {smartImported.priorAuthRelevance?.suitableForGlp1PriorAuth && (
                  <div style={{ marginTop: 8, padding: "4px 8px", background: "rgba(34,197,94,0.12)", borderRadius: 4, fontSize: 11 }}>
                    Ready for prior auth — use patient ID above in Prompt Opinion chat
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Metrics (Demo)</h2>
            <div className="split" style={{ marginTop: 10 }}>
              <Metric label="Agents observed" value={agentsExecuted.length} />
              <Metric label="A2A messages" value={asArray(messages?.messages).length} />
              <Metric label="FHIR packet resources" value={bundleCount} />
              <Metric label="MCP tool calls" value={asArray(mcpLog?.tools).length} />
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              Demo metrics are computed locally for presentation (not a benchmark).
            </div>
          </div>

          <div className="card">
            <h2>Feasibility Notes</h2>
            <div className="list" style={{ marginTop: 10 }}>
              <div className="item"><strong>Synthetic data only</strong><span>No PHI is used in this demo.</span></div>
              <div className="item"><strong>Human-in-the-loop</strong><span>Clinicians can review BPMH & evidence before submission.</span></div>
              <div className="item"><strong>Auditability</strong><span>Provenance links decisions to exact FHIR inputs.</span></div>
              <div className="item"><strong>Interoperability</strong><span>FHIR packets can be exchanged across systems without vendor lock-in.</span></div>
            </div>
          </div>

          <div className="card">
            <h2>Messy Medication Sources</h2>
            <div className="muted">Three sources disagree; MedRec produces a Best Possible Medication History.</div>
            <div className="split" style={{ marginTop: 10 }}>
              <SourceCol title="EHR Med List" items={medsEhr.map((m: any) => ({
                primary: `${m.medicationCodeableConcept?.text ?? "Medication"} — ${m.status ?? "unknown"}`,
                secondary: "source: EHR"
              }))} />
              <SourceCol title="Pharmacy Fills" items={fills.map((m: any) => ({
                primary: `${m.medicationCodeableConcept?.text ?? "Medication"} — last: ${formatIsoDate(m.whenHandedOver)}`,
                secondary: "source: pharmacy"
              }))} />
              <SourceCol title="Patient Reported" items={medsPatient.map((m: any) => ({
                primary: `${m.medicationCodeableConcept?.text ?? "Medication"} — ${m.status ?? "unknown"}`,
                secondary: "source: patient"
              }))} />
            </div>

            <div className="kv" style={{ marginTop: 12 }}>
              <button className="small" onClick={onMedRec} disabled={!seeded || !!busy}>
                2) Run MedRec Agent
              </button>
              <button className="small" onClick={onPrescribe} disabled={!seeded || !!busy}>
                3) Prescribe GLP-1
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="list">
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2>Policy Check</h2>
                <div className="muted">Coverage criteria for GLP-1 prior authorization (demo policy).</div>
              </div>
              <div className="btnrow">
                <button className="small" onClick={onPolicy} disabled={!seeded || !!busy}>
                  4) Policy Check
                </button>
              </div>
            </div>

            {policy ? (
              <div className="split" style={{ marginTop: 12 }}>
                <div>
                  <div className="badge info">{policy.policyName}</div>
                  <div className="list" style={{ marginTop: 10 }}>
                    {(policy.requires ?? []).map((r: any) => (
                      <div key={r.key} className="item">
                        <strong>✓ {r.label}</strong>
                        <span>Evidence can be derived from FHIR resources (Condition, Observation, BPMH).</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="badge bad">Missing / Fails</div>
                  <div className="list" style={{ marginTop: 10 }}>
                    {policyMissing.length === 0 ? (
                      <div className="item">
                        <strong>✅ Meets criteria</strong>
                        <span>Proceed to compose and submit the packet.</span>
                      </div>
                    ) : (
                      policyMissing.map((m: string, i: number) => (
                        <div key={i} className="item">
                          <strong>✕ {m}</strong>
                          <span>Gather evidence to satisfy this requirement.</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>
                Click “Policy Check” to fetch criteria and see what’s missing.
              </div>
            )}
          </div>

          <div className="split">
            <div className="card">
              <h2>Reconciled BPMH (MedRec Output)</h2>
              {medrec?.bpmh ? (
                <>
                  <div className="badge good">List/{medrec.bpmh.id}</div>
                  <div className="muted" style={{ marginTop: 8 }}>{medrec.reasoning}</div>

                  <div className="kv" style={{ marginTop: 12 }}>
                    <span className="badge info">Detected Issues</span>
                    <span className="badge">{(medrec.detectedIssues ?? []).length} issues</span>
                  </div>

                  <div className="list" style={{ marginTop: 10 }}>
                    {(medrec.detectedIssues ?? []).length === 0 ? (
                      <div className="item"><strong>No conflicts detected</strong><span>Sources agree.</span></div>
                    ) : (
                      medrec.detectedIssues.map((d: any) => (
                        <div key={d.id} className="item">
                          <strong>DetectedIssue/{d.id}</strong>
                          <span>{d.detail}</span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="muted">Run MedRec to generate BPMH + conflicts.</div>
              )}

              <div className="kv" style={{ marginTop: 12 }}>
                <button className="small" onClick={() => onEvidence()} disabled={!seeded || !!busy}>
                  5) Gather Evidence
                </button>
                <span className={`badge ${evidence?.evidenceDoc ? "good" : ""}`}>
                  {evidence?.evidenceDoc ? `DocumentReference/${evidence.evidenceDoc.id}` : "No evidence document yet"}
                </span>
              </div>

              {evidence?.derived ? (
                <div className="list" style={{ marginTop: 10 }}>
                  <div className="item">
                    <strong>Evidence Used</strong>
                    <span>
                      {evidence.derived.hasT2D ? "✓ Type 2 Diabetes" : "✕ Missing T2D"} •{" "}
                      {evidence.derived.a1cValue ? `✓ HbA1c ${evidence.derived.a1cValue}` : "✕ Missing HbA1c"} •{" "}
                      {evidence.derived.intolerance ? "✓ Metformin intolerance documented" : "• Metformin trial inferred"}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="card">
              <h2>Packet + Decision</h2>

              <div className="kv">
                <span className="badge info">Packet</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="small" onClick={() => onCompose()} disabled={!seeded || !!busy}>
                    6) Compose Packet
                  </button>
                  <button className="small" onClick={() => onSubmit()} disabled={!seeded || !!busy}>
                    7) Submit
                  </button>
                  <button className="small" onClick={loadBundleForExplorer} disabled={!packet?.bundle?.id || !!busy}>
                    Bundle Explorer
                  </button>
                </div>
              </div>

              <div className="list" style={{ marginTop: 10 }}>
                <div className="item">
                  <strong>FHIR Bundle</strong>
                  <span>
                    {packet?.bundle?.id ? `Bundle/${packet.bundle.id} • ${bundleCount} resources • ${bundleTypes.join(", ")}` : "Not composed yet"}
                  </span>
                </div>
                {packet?.claim ? (
                  <div className="item">
                    <strong>Claim/{packet.claim.id}</strong>
                    <span>Prior authorization request</span>
                  </div>
                ) : null}
                {packet?.task ? (
                  <div className="item">
                    <strong>Task/{packet.task.id}</strong>
                    <span>Workflow status</span>
                  </div>
                ) : null}
              </div>

              <div className="kv" style={{ marginTop: 12 }}>
                <span className="badge info">Decision</span>
                {decision?.claimResponse ? (
                  <span className={`badge ${decisionMissing.length === 0 ? "good" : "bad"}`}>
                    {decisionMissing.length === 0 ? "APPROVED" : "DENIED"}
                  </span>
                ) : (
                  <span className="badge">No decision yet</span>
                )}
              </div>

              {decision?.claimResponse ? (
                <div className="list" style={{ marginTop: 10 }}>
                  <div className="item">
                    <strong>{decision.claimResponse.disposition}</strong>
                    <span>
                      {decisionMissing.length === 0
                        ? "Approved based on policy criteria."
                        : "Denied due to missing/failed criteria."}
                    </span>
                  </div>

                  <div className="item">
                    <strong>Decision Explanation</strong>
                    <span>
                      Policy variant: <b>{policyVariant}</b> • {(policy?.requires ?? []).map((r: any) => r.label).join(" • ")}
                    </span>
                    <span style={{ marginTop: 6 }}>
                      {decisionMissing.length === 0 ? (
                        <span style={{ color: "var(--good)", fontWeight: 700 }}>✔ All criteria satisfied</span>
                      ) : (
                        <span style={{ color: "var(--bad)", fontWeight: 700 }}>
                          ✕ Missing: {decisionMissing.join(", ")}
                        </span>
                      )}
                    </span>
                  </div>

                  {decisionMissing.length > 0 ? (
                    <div className="item">
                      <strong>Denial Recovery Loop</strong>
                      <span>
                        In real workflows, missing labs arrive later. Click below to simulate a new HbA1c result, rebuild the packet, and resubmit.
                      </span>
                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="small" onClick={fixAndResubmit} disabled={!!busy}>
                          Fix (Simulate HbA1c) + Resubmit
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="muted" style={{ marginTop: 10 }}>
                  Submit to payer to get a ClaimResponse.
                </div>
              )}
            </div>
          </div>

          {bundleView ? (
            <div className="card">
              <div className="kv">
                <div>
                  <h2>FHIR Bundle Explorer</h2>
                  <div className="muted">Browse the packet contents without downloading JSON.</div>
                </div>
                <button className="small" onClick={() => setBundleView(null)} disabled={!!busy}>
                  Close
                </button>
              </div>

              <div className="split" style={{ marginTop: 12 }}>
                <div>
                  <div className="badge info">Bundle/{bundleView.id}</div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    {Array.isArray(bundleView.entry) ? `${bundleView.entry.length} resources` : ""}
                  </div>
                  <div className="list" style={{ marginTop: 12 }}>
                    {bundleTypes.map((t) => (
                      <button
                        key={t}
                        className={`small ${selectedResourceType === t ? "primary" : ""}`}
                        onClick={() => setSelectedResourceType(t)}
                        disabled={!!busy}
                        style={{ marginBottom: 6 }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="badge">{selectedResourceType}</div>
                  <pre className="code" style={{ marginTop: 10, maxHeight: 360, overflow: "auto" }}>
                    {JSON.stringify(
                      (asArray(bundleView.entry)
                        .map((e: any) => e?.resource)
                        .filter((r: any) => r?.resourceType === selectedResourceType)
                        .slice(0, 3)),
                      null,
                      2
                    )}
                  </pre>
                  <div className="muted" style={{ marginTop: 8 }}>
                    Showing up to 3 resources of this type.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="split">
            <div className="card">
              <div className="kv">
                <div>
                  <h2>Provenance Trace</h2>
                  <div className="muted">Every step links “used” and “created” FHIR resources.</div>
                </div>
                <button className="small" onClick={onTrace} disabled={!seeded || !!busy}>
                  Trace
                </button>
              </div>

              {trace?.provenance ? (
                <table className="table" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Activity</th>
                      <th>Targets</th>
                      <th>Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asArray(trace.provenance).slice(0, 8).map((p: any, i: number) => (
                      <tr key={i}>
                        <td>{String(p.recorded ?? "").slice(0, 19).replace("T", " ")}</td>
                        <td>{p.activity?.text ?? "Provenance"}</td>
                        <td>{asArray(p.target).map((t: any) => t.reference).slice(0, 2).join(", ")}</td>
                        <td>{asArray(p.entity).map((e: any) => e.what?.reference).slice(0, 2).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="muted" style={{ marginTop: 12 }}>Click Trace after running steps.</div>
              )}
            </div>

            <div className="card">
              <div className="kv">
                <div>
                  <h2>A2A Transcript</h2>
                  <div className="muted">Agent-to-agent messages exchanged during the workflow.</div>
                </div>
                <button className="small" onClick={onMessages} disabled={!seeded || !!busy}>
                  A2A Messages
                </button>
              </div>

              {messages?.messages ? (
                <div className="list" style={{ marginTop: 12, maxHeight: 280, overflow: "auto", paddingRight: 6 }}>
                  {asArray(messages.messages).slice().reverse().slice(0, 12).map((m: any) => (
                    <div key={m.id} className="item">
                      <strong>{m.from} → {m.to}</strong>
                      <span>{m.type} • {String(m.ts ?? "").replace("T", " ").slice(0, 19)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted" style={{ marginTop: 12 }}>Click A2A Messages to see transcript.</div>
              )}

              <div className="kv" style={{ marginTop: 12 }}>
                <span className="badge info">Agents Executed</span>
                <span className="badge">{agentsExecuted.length || 0}</span>
              </div>
              <div className="list" style={{ marginTop: 10 }}>
                {agentsExecuted.slice(0, 6).map((a: string, i: number) => (
                  <div key={i} className="item">
                    <strong>{a}</strong>
                    <span>Executed during this run</span>
                  </div>
                ))}
              </div>

              <div className="item" style={{ marginTop: 10 }}>
                <strong>Summary</strong>
                <span>FHIR resources in packet: {bundleCount || 0} • Agents invoked: {agentsExecuted.length || 0}</span>
              </div>

              <div className="kv" style={{ marginTop: 14 }}>
                <div>
                  <span className="badge info">MCP Tool Log</span>
                  <span className="badge" style={{ marginLeft: 8 }}>{asArray(mcpLog?.tools).length}</span>
                </div>
                <button className="small" onClick={onMcpLog} disabled={!seeded || !!busy}>
                  MCP Tools
                </button>
              </div>

              {mcpLog?.tools ? (
                <pre className="code" style={{ marginTop: 10, maxHeight: 220, overflow: "auto" }}>
{asArray(mcpLog.tools)
  .slice()
  .reverse()
  .slice(0, 10)
  .map((t: any) => `${String(t.ts ?? "").slice(11, 19)}  ${t.agent ?? ""}  ${t.tool}  ${JSON.stringify(t.argsPreview)}`)
  .join("\n")}
                </pre>
              ) : (
                <div className="muted" style={{ marginTop: 10 }}>Click MCP Tools to load the tool invocation log.</div>
              )}
            </div>
          </div>

          <div className="card">
            <h2>Controls</h2>
            <div className="muted">Manual controls (useful during judging).</div>
            <div className="btnrow" style={{ marginTop: 10 }}>
              <button onClick={onSeed} disabled={!!busy}>Seed</button>
              <button onClick={onMedRec} disabled={!seeded || !!busy}>MedRec</button>
              <button onClick={onPrescribe} disabled={!seeded || !!busy}>Prescribe</button>
              <button onClick={() => onEvidence()} disabled={!seeded || !!busy}>Evidence</button>
              <button onClick={onPolicy} disabled={!seeded || !!busy}>Policy</button>
              <button onClick={() => onCompose()} disabled={!seeded || !!busy}>Compose</button>
              <button onClick={() => onSubmit()} disabled={!seeded || !!busy}>Submit</button>
              <button onClick={downloadBundle} disabled={!packet?.bundle?.id || !!busy}>Download Bundle</button>
            </div>
            {busy ? <div className="muted" style={{ marginTop: 10 }}>Running: {busy}</div> : null}
          </div>
        </div>
      </div>

      {/* ── Audit Trail Visualization ─────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 24, borderColor: "rgba(139,92,246,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>🔍 Audit Trail & Provenance</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`small ${auditView === "timeline" ? "primary" : ""}`}
              onClick={() => setAuditView("timeline")}
            >Timeline</button>
            <button
              className={`small ${auditView === "graph" ? "primary" : ""}`}
              onClick={() => setAuditView("graph")}
            >Graph</button>
            <button className="small" onClick={onLoadAudit} disabled={auditBusy}>
              {auditBusy ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {!auditTrail ? (
          <div className="muted" style={{ textAlign: "center", padding: "32px 0" }}>
            Run a prior authorization to generate an audit trail.
            <br />
            <button className="small" style={{ marginTop: 12 }} onClick={onLoadAudit}>Load Audit Trail</button>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {[
                { label: "Decision", value: auditTrail.finalDecision?.toUpperCase() ?? "PENDING",
                  color: auditTrail.finalDecision === "approved" ? "rgba(34,197,94,0.8)"
                    : auditTrail.finalDecision === "denied" ? "rgba(239,68,68,0.8)"
                    : auditTrail.finalDecision === "appealed" ? "rgba(251,191,36,0.8)"
                    : "rgba(148,163,184,0.8)" },
                { label: "Events", value: auditTrail.summary.totalEvents, color: "rgba(139,92,246,0.8)" },
                { label: "Agents", value: auditTrail.summary.agentsInvolved.join(", "), color: "rgba(59,130,246,0.8)" },
                { label: "AI Decisions", value: auditTrail.summary.aiDecisionsMade, color: "rgba(236,72,153,0.8)" },
                { label: "FHIR Created", value: auditTrail.summary.fhirResourcesCreated, color: "rgba(20,184,166,0.8)" },
                { label: "Appeal", value: auditTrail.summary.appealDrafted ? "Yes" : "No",
                  color: auditTrail.summary.appealDrafted ? "rgba(251,191,36,0.8)" : "rgba(148,163,184,0.5)" },
                { label: "Duration", value: auditTrail.summary.durationMs ? `${(auditTrail.summary.durationMs/1000).toFixed(1)}s` : "—", color: "rgba(148,163,184,0.8)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${color}`, borderRadius: 8, padding: "8px 14px", minWidth: 80 }}>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color }}>{String(value)}</div>
                </div>
              ))}
            </div>

            {/* Data sources */}
            {auditTrail.summary.dataSourcesUsed?.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                <span className="muted" style={{ fontSize: 11 }}>Data sources:</span>
                {auditTrail.summary.dataSourcesUsed.map((ds: string) => (
                  <span key={ds} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background:
                    ds === "fhir-local" ? "rgba(59,130,246,0.15)" :
                    ds === "fhir-smart-health-it" ? "rgba(20,184,166,0.15)" :
                    ds === "ai-note-extraction" ? "rgba(236,72,153,0.15)" :
                    ds === "ai-policy-check" ? "rgba(139,92,246,0.15)" :
                    ds === "ai-appeal" ? "rgba(251,191,36,0.15)" :
                    "rgba(148,163,184,0.15)",
                    color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.08)"
                  }}>
                    {ds === "fhir-local" ? "📋 Local FHIR" :
                     ds === "fhir-smart-health-it" ? "🌐 SMART Health IT" :
                     ds === "ai-note-extraction" ? "🤖 AI Note Extraction" :
                     ds === "ai-policy-check" ? "⚖️ AI Policy Check" :
                     ds === "ai-appeal" ? "📝 AI Appeal" :
                     ds === "synthetic-seed" ? "🧪 Synthetic" : ds}
                  </span>
                ))}
              </div>
            )}

            {auditView === "timeline" ? (
              /* TIMELINE VIEW */
              <div style={{ position: "relative" }}>
                {/* Vertical line */}
                <div style={{ position: "absolute", left: 18, top: 0, bottom: 0, width: 2, background: "rgba(139,92,246,0.2)", borderRadius: 2 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {(auditTrail.events ?? []).map((event: any, i: number) => {
                    const agentColor = event.agent === "ALICE" ? "#3b82f6"
                      : event.agent === "ARIA" ? "#f59e0b"
                      : "#6b7280";
                    const typeIcon = event.type === "pipeline_start" ? "▶" :
                      event.type === "pipeline_complete" ? "✓" :
                      event.type === "ai_decision" ? "🤖" :
                      event.type === "agent_handoff" ? "↗" :
                      event.type === "resource_created" ? "+" :
                      event.type === "appeal_drafted" ? "📝" :
                      event.type === "tool_called" ? "⚙" : "●";
                    const isAI = event.type === "ai_decision" || event.type === "appeal_drafted";
                    return (
                      <div key={event.id ?? i} style={{ display: "flex", gap: 12, paddingBottom: 16, position: "relative" }}>
                        {/* Node */}
                        <div style={{ width: 38, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: `${agentColor}22`, border: `2px solid ${agentColor}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, zIndex: 1, position: "relative",
                          }}>{typeIcon}</div>
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 8,
                          border: `1px solid ${isAI ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.06)"}`,
                          padding: "10px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: agentColor }}>{event.agent}</span>
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(148,163,184,0.7)",
                                background: "rgba(0,0,0,0.2)", padding: "1px 6px", borderRadius: 4 }}>{event.action}</span>
                            </div>
                            <span style={{ fontSize: 10, color: "rgba(100,116,139,0.8)", whiteSpace: "nowrap" }}>
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: "rgba(226,232,240,0.85)", marginBottom: event.aiDecision ? 8 : 0 }}>
                            {event.description}
                          </div>
                          {/* AI Decision block */}
                          {event.aiDecision && (
                            <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(139,92,246,0.08)",
                              border: "1px solid rgba(139,92,246,0.2)", borderRadius: 6 }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color:
                                  event.aiDecision.decision === "APPROVED" ? "#22c55e" :
                                  event.aiDecision.decision === "DENIED" ? "#ef4444" :
                                  "#a78bfa" }}>{event.aiDecision.decision}</span>
                                {event.aiDecision.confidence && (
                                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8,
                                    background: event.aiDecision.confidence === "high" ? "rgba(34,197,94,0.15)" :
                                      event.aiDecision.confidence === "medium" ? "rgba(251,191,36,0.15)" : "rgba(239,68,68,0.15)",
                                    color: event.aiDecision.confidence === "high" ? "#4ade80" :
                                      event.aiDecision.confidence === "medium" ? "#fbbf24" : "#f87171",
                                  }}>Confidence: {event.aiDecision.confidence}</span>
                                )}
                                {event.aiDecision.model && (
                                  <span style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", fontFamily: "monospace" }}>
                                    {event.aiDecision.model}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: "rgba(203,213,225,0.8)" }}>{event.aiDecision.reasoning}</div>
                              {event.aiDecision.ambiguities?.length > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  {event.aiDecision.ambiguities.map((a: string, j: number) => (
                                    <div key={j} style={{ fontSize: 11, color: "rgba(251,191,36,0.8)", marginTop: 2 }}>⚠ {a}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Resources */}
                          {event.resourcesCreated?.length > 0 && (
                            <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {event.resourcesCreated.map((r: any, j: number) => (
                                <span key={j} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4,
                                  background: "rgba(20,184,166,0.1)", color: "rgba(94,234,212,0.8)",
                                  border: "1px solid rgba(20,184,166,0.2)", fontFamily: "monospace" }}>
                                  +{r.resourceType}/{r.id?.slice(0,8)}…
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Data sources */}
                          {event.dataSources?.length > 0 && (
                            <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {event.dataSources.map((ds: string, j: number) => (
                                <span key={j} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4,
                                  background: "rgba(255,255,255,0.05)", color: "rgba(148,163,184,0.7)",
                                  border: "1px solid rgba(255,255,255,0.08)" }}>{ds}</span>
                              ))}
                            </div>
                          )}
                          {/* Agent handoff */}
                          {event.handoff && (
                            <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(245,158,11,0.08)",
                              border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, fontSize: 12 }}>
                              <span style={{ color: "#f59e0b", fontWeight: 600 }}>↗ Handoff</span>
                              <span style={{ color: "rgba(203,213,225,0.8)", marginLeft: 8 }}>
                                {event.handoff.from} → {event.handoff.to}: {event.handoff.reason}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* GRAPH VIEW */
              <div style={{ overflowX: "auto" }}>
                <svg width="100%" viewBox="0 0 800 320" style={{ minWidth: 600 }}>
                  <defs>
                    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="rgba(139,92,246,0.6)" />
                    </marker>
                  </defs>
                  {/* Nodes */}
                  {(auditTrail.events ?? []).filter((_: any, i: number) => i < 8).map((event: any, i: number) => {
                    const x = 60 + (i % 4) * 185;
                    const y = i < 4 ? 80 : 220;
                    const agentColor = event.agent === "ALICE" ? "#3b82f6" : event.agent === "ARIA" ? "#f59e0b" : "#6b7280";
                    const nextI = i + 1;
                    const nextX = 60 + (nextI % 4) * 185;
                    const nextY = nextI < 4 ? 80 : 220;
                    return (
                      <g key={event.id ?? i}>
                        {/* Edge to next */}
                        {i < Math.min((auditTrail.events?.length ?? 0) - 1, 7) && (
                          <line x1={x + 50} y1={y} x2={nextX - 50} y2={nextY}
                            stroke="rgba(139,92,246,0.4)" strokeWidth="1.5"
                            markerEnd="url(#arrow)" strokeDasharray={i === 3 ? "4,3" : "none"} />
                        )}
                        {/* Node circle */}
                        <circle cx={x} cy={y} r={32} fill={`${agentColor}18`} stroke={agentColor} strokeWidth="1.5" />
                        <text x={x} y={y - 8} textAnchor="middle" fontSize="10" fill={agentColor} fontWeight="600">{event.agent}</text>
                        <text x={x} y={y + 5} textAnchor="middle" fontSize="8" fill="rgba(148,163,184,0.7)">{event.action?.slice(0, 12)}</text>
                        <text x={x} y={y + 16} textAnchor="middle" fontSize="8" fill="rgba(148,163,184,0.5)">{event.type?.replace("_"," ")}</text>
                        {/* AI badge */}
                        {event.aiDecision && (
                          <circle cx={x + 28} cy={y - 28} r={8} fill="rgba(139,92,246,0.8)" />
                        )}
                        {event.aiDecision && (
                          <text x={x + 28} y={y - 24} textAnchor="middle" fontSize="8" fill="white">AI</text>
                        )}
                      </g>
                    );
                  })}
                  {/* Legend */}
                  <g transform="translate(620, 20)">
                    <circle cx={8} cy={8} r={6} fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth="1.5" />
                    <text x={18} y={12} fontSize="9" fill="rgba(148,163,184,0.8)">ALICE</text>
                    <circle cx={8} cy={26} r={6} fill="rgba(245,158,11,0.2)" stroke="#f59e0b" strokeWidth="1.5" />
                    <text x={18} y={30} fontSize="9" fill="rgba(148,163,184,0.8)">ARIA</text>
                    <circle cx={8} cy={44} r={6} fill="rgba(139,92,246,0.8)" />
                    <text x={18} y={48} fontSize="9" fill="rgba(148,163,184,0.8)">AI Decision</text>
                  </g>
                </svg>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`pill ${active ? "active" : ""}`}>
      <div className="n">{done ? "✓" : n}</div>
      <div>{label}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{String(value ?? 0)}</div>
    </div>
  );
}

function DemoStep({ n, text, done }: { n: number; text: string; done: boolean }) {
  return (
    <div className="item" style={{ padding: "10px 12px" }}>
      <strong style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span className={`badge ${done ? "good" : ""}`} style={{ minWidth: 44, justifyContent: "center" }}>
          {done ? `✓ ${n}` : n}
        </span>
        <span>{text}</span>
      </strong>
    </div>
  );
}

function SourceCol({ title, items }: { title: string; items: Array<{ primary: string; secondary: string }> }) {
  return (
    <div className="card" style={{ padding: 12, boxShadow: "none" }}>
      <h2 style={{ marginBottom: 8 }}>{title}</h2>
      <div className="list">
        {items.length === 0 ? (
          <div className="muted">No data yet.</div>
        ) : (
          items.slice(0, 4).map((it, i) => (
            <div key={i} className="item">
              <strong>{it.primary}</strong>
              <span>{it.secondary}</span>
            </div>
          ))
        )}
      </div>

      {/* ── Audit Trail Visualization ─────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 24, borderColor: "rgba(139,92,246,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>🔍 Audit Trail & Provenance</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`small ${auditView === "timeline" ? "primary" : ""}`}
              onClick={() => setAuditView("timeline")}
            >Timeline</button>
            <button
              className={`small ${auditView === "graph" ? "primary" : ""}`}
              onClick={() => setAuditView("graph")}
            >Graph</button>
            <button className="small" onClick={onLoadAudit} disabled={auditBusy}>
              {auditBusy ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {!auditTrail ? (
          <div className="muted" style={{ textAlign: "center", padding: "32px 0" }}>
            Run a prior authorization to generate an audit trail.
            <br />
            <button className="small" style={{ marginTop: 12 }} onClick={onLoadAudit}>Load Audit Trail</button>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {[
                { label: "Decision", value: auditTrail.finalDecision?.toUpperCase() ?? "PENDING",
                  color: auditTrail.finalDecision === "approved" ? "rgba(34,197,94,0.8)"
                    : auditTrail.finalDecision === "denied" ? "rgba(239,68,68,0.8)"
                    : auditTrail.finalDecision === "appealed" ? "rgba(251,191,36,0.8)"
                    : "rgba(148,163,184,0.8)" },
                { label: "Events", value: auditTrail.summary.totalEvents, color: "rgba(139,92,246,0.8)" },
                { label: "Agents", value: auditTrail.summary.agentsInvolved.join(", "), color: "rgba(59,130,246,0.8)" },
                { label: "AI Decisions", value: auditTrail.summary.aiDecisionsMade, color: "rgba(236,72,153,0.8)" },
                { label: "FHIR Created", value: auditTrail.summary.fhirResourcesCreated, color: "rgba(20,184,166,0.8)" },
                { label: "Appeal", value: auditTrail.summary.appealDrafted ? "Yes" : "No",
                  color: auditTrail.summary.appealDrafted ? "rgba(251,191,36,0.8)" : "rgba(148,163,184,0.5)" },
                { label: "Duration", value: auditTrail.summary.durationMs ? `${(auditTrail.summary.durationMs/1000).toFixed(1)}s` : "—", color: "rgba(148,163,184,0.8)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${color}`, borderRadius: 8, padding: "8px 14px", minWidth: 80 }}>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color }}>{String(value)}</div>
                </div>
              ))}
            </div>

            {/* Data sources */}
            {auditTrail.summary.dataSourcesUsed?.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                <span className="muted" style={{ fontSize: 11 }}>Data sources:</span>
                {auditTrail.summary.dataSourcesUsed.map((ds: string) => (
                  <span key={ds} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background:
                    ds === "fhir-local" ? "rgba(59,130,246,0.15)" :
                    ds === "fhir-smart-health-it" ? "rgba(20,184,166,0.15)" :
                    ds === "ai-note-extraction" ? "rgba(236,72,153,0.15)" :
                    ds === "ai-policy-check" ? "rgba(139,92,246,0.15)" :
                    ds === "ai-appeal" ? "rgba(251,191,36,0.15)" :
                    "rgba(148,163,184,0.15)",
                    color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.08)"
                  }}>
                    {ds === "fhir-local" ? "📋 Local FHIR" :
                     ds === "fhir-smart-health-it" ? "🌐 SMART Health IT" :
                     ds === "ai-note-extraction" ? "🤖 AI Note Extraction" :
                     ds === "ai-policy-check" ? "⚖️ AI Policy Check" :
                     ds === "ai-appeal" ? "📝 AI Appeal" :
                     ds === "synthetic-seed" ? "🧪 Synthetic" : ds}
                  </span>
                ))}
              </div>
            )}

            {auditView === "timeline" ? (
              /* TIMELINE VIEW */
              <div style={{ position: "relative" }}>
                {/* Vertical line */}
                <div style={{ position: "absolute", left: 18, top: 0, bottom: 0, width: 2, background: "rgba(139,92,246,0.2)", borderRadius: 2 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {(auditTrail.events ?? []).map((event: any, i: number) => {
                    const agentColor = event.agent === "ALICE" ? "#3b82f6"
                      : event.agent === "ARIA" ? "#f59e0b"
                      : "#6b7280";
                    const typeIcon = event.type === "pipeline_start" ? "▶" :
                      event.type === "pipeline_complete" ? "✓" :
                      event.type === "ai_decision" ? "🤖" :
                      event.type === "agent_handoff" ? "↗" :
                      event.type === "resource_created" ? "+" :
                      event.type === "appeal_drafted" ? "📝" :
                      event.type === "tool_called" ? "⚙" : "●";
                    const isAI = event.type === "ai_decision" || event.type === "appeal_drafted";
                    return (
                      <div key={event.id ?? i} style={{ display: "flex", gap: 12, paddingBottom: 16, position: "relative" }}>
                        {/* Node */}
                        <div style={{ width: 38, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: `${agentColor}22`, border: `2px solid ${agentColor}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, zIndex: 1, position: "relative",
                          }}>{typeIcon}</div>
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 8,
                          border: `1px solid ${isAI ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.06)"}`,
                          padding: "10px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: agentColor }}>{event.agent}</span>
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(148,163,184,0.7)",
                                background: "rgba(0,0,0,0.2)", padding: "1px 6px", borderRadius: 4 }}>{event.action}</span>
                            </div>
                            <span style={{ fontSize: 10, color: "rgba(100,116,139,0.8)", whiteSpace: "nowrap" }}>
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: "rgba(226,232,240,0.85)", marginBottom: event.aiDecision ? 8 : 0 }}>
                            {event.description}
                          </div>
                          {/* AI Decision block */}
                          {event.aiDecision && (
                            <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(139,92,246,0.08)",
                              border: "1px solid rgba(139,92,246,0.2)", borderRadius: 6 }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color:
                                  event.aiDecision.decision === "APPROVED" ? "#22c55e" :
                                  event.aiDecision.decision === "DENIED" ? "#ef4444" :
                                  "#a78bfa" }}>{event.aiDecision.decision}</span>
                                {event.aiDecision.confidence && (
                                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8,
                                    background: event.aiDecision.confidence === "high" ? "rgba(34,197,94,0.15)" :
                                      event.aiDecision.confidence === "medium" ? "rgba(251,191,36,0.15)" : "rgba(239,68,68,0.15)",
                                    color: event.aiDecision.confidence === "high" ? "#4ade80" :
                                      event.aiDecision.confidence === "medium" ? "#fbbf24" : "#f87171",
                                  }}>Confidence: {event.aiDecision.confidence}</span>
                                )}
                                {event.aiDecision.model && (
                                  <span style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", fontFamily: "monospace" }}>
                                    {event.aiDecision.model}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: "rgba(203,213,225,0.8)" }}>{event.aiDecision.reasoning}</div>
                              {event.aiDecision.ambiguities?.length > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  {event.aiDecision.ambiguities.map((a: string, j: number) => (
                                    <div key={j} style={{ fontSize: 11, color: "rgba(251,191,36,0.8)", marginTop: 2 }}>⚠ {a}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Resources */}
                          {event.resourcesCreated?.length > 0 && (
                            <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {event.resourcesCreated.map((r: any, j: number) => (
                                <span key={j} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4,
                                  background: "rgba(20,184,166,0.1)", color: "rgba(94,234,212,0.8)",
                                  border: "1px solid rgba(20,184,166,0.2)", fontFamily: "monospace" }}>
                                  +{r.resourceType}/{r.id?.slice(0,8)}…
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Data sources */}
                          {event.dataSources?.length > 0 && (
                            <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {event.dataSources.map((ds: string, j: number) => (
                                <span key={j} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4,
                                  background: "rgba(255,255,255,0.05)", color: "rgba(148,163,184,0.7)",
                                  border: "1px solid rgba(255,255,255,0.08)" }}>{ds}</span>
                              ))}
                            </div>
                          )}
                          {/* Agent handoff */}
                          {event.handoff && (
                            <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(245,158,11,0.08)",
                              border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, fontSize: 12 }}>
                              <span style={{ color: "#f59e0b", fontWeight: 600 }}>↗ Handoff</span>
                              <span style={{ color: "rgba(203,213,225,0.8)", marginLeft: 8 }}>
                                {event.handoff.from} → {event.handoff.to}: {event.handoff.reason}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* GRAPH VIEW */
              <div style={{ overflowX: "auto" }}>
                <svg width="100%" viewBox="0 0 800 320" style={{ minWidth: 600 }}>
                  <defs>
                    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="rgba(139,92,246,0.6)" />
                    </marker>
                  </defs>
                  {/* Nodes */}
                  {(auditTrail.events ?? []).filter((_: any, i: number) => i < 8).map((event: any, i: number) => {
                    const x = 60 + (i % 4) * 185;
                    const y = i < 4 ? 80 : 220;
                    const agentColor = event.agent === "ALICE" ? "#3b82f6" : event.agent === "ARIA" ? "#f59e0b" : "#6b7280";
                    const nextI = i + 1;
                    const nextX = 60 + (nextI % 4) * 185;
                    const nextY = nextI < 4 ? 80 : 220;
                    return (
                      <g key={event.id ?? i}>
                        {/* Edge to next */}
                        {i < Math.min((auditTrail.events?.length ?? 0) - 1, 7) && (
                          <line x1={x + 50} y1={y} x2={nextX - 50} y2={nextY}
                            stroke="rgba(139,92,246,0.4)" strokeWidth="1.5"
                            markerEnd="url(#arrow)" strokeDasharray={i === 3 ? "4,3" : "none"} />
                        )}
                        {/* Node circle */}
                        <circle cx={x} cy={y} r={32} fill={`${agentColor}18`} stroke={agentColor} strokeWidth="1.5" />
                        <text x={x} y={y - 8} textAnchor="middle" fontSize="10" fill={agentColor} fontWeight="600">{event.agent}</text>
                        <text x={x} y={y + 5} textAnchor="middle" fontSize="8" fill="rgba(148,163,184,0.7)">{event.action?.slice(0, 12)}</text>
                        <text x={x} y={y + 16} textAnchor="middle" fontSize="8" fill="rgba(148,163,184,0.5)">{event.type?.replace("_"," ")}</text>
                        {/* AI badge */}
                        {event.aiDecision && (
                          <circle cx={x + 28} cy={y - 28} r={8} fill="rgba(139,92,246,0.8)" />
                        )}
                        {event.aiDecision && (
                          <text x={x + 28} y={y - 24} textAnchor="middle" fontSize="8" fill="white">AI</text>
                        )}
                      </g>
                    );
                  })}
                  {/* Legend */}
                  <g transform="translate(620, 20)">
                    <circle cx={8} cy={8} r={6} fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth="1.5" />
                    <text x={18} y={12} fontSize="9" fill="rgba(148,163,184,0.8)">ALICE</text>
                    <circle cx={8} cy={26} r={6} fill="rgba(245,158,11,0.2)" stroke="#f59e0b" strokeWidth="1.5" />
                    <text x={18} y={30} fontSize="9" fill="rgba(148,163,184,0.8)">ARIA</text>
                    <circle cx={8} cy={44} r={6} fill="rgba(139,92,246,0.8)" />
                    <text x={18} y={48} fontSize="9" fill="rgba(148,163,184,0.8)">AI Decision</text>
                  </g>
                </svg>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
