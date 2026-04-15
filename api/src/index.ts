import express from "express";
import cors from "cors";
import { FhirStore } from "./fhirStore.js";
import { seedSynthetic, seedRA, seedComorbid, seedIncomplete, seedExpired, seedPaediatric, seedUrgent,
         PO_PATIENT_ID, LEGACY_PATIENT_ID, RA_PATIENT_ID, COMORBID_PATIENT_ID,
         INCOMPLETE_PATIENT_ID, EXPIRED_PATIENT_ID, PAEDIATRIC_PATIENT_ID, URGENT_PATIENT_ID } from "./seed.js";
import { checkPolicy } from "./policy.js";
import { A2ABus } from "./a2a.js";
import { runMedRec } from "./agents/medrecAgent.js";
import { runEvidence } from "./agents/evidenceAgent.js";
import { runComposePacket } from "./agents/packetComposerAgent.js";
import { runDecision } from "./agents/decisionAgent.js";
import { writeProvenance } from "./agents/auditAgent.js";
import { clearMcpLog, getMcpLog, runTool } from "./mcp.js";
import { createMcpHandler, executeTool } from "./mcpServer.js";
import { diffPolicies, getPolicyDefinition } from "./policies.js";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { searchSmartPatients, searchDiabetesPatients, importPatientFromSmart } from "./fhirClient.js";
import { getLatestTrailForPatient, getAllTrailsForPatient, getAllTrails, registerIdAliases } from "./auditTrail.js";

// ESM-safe __dirname (not available natively with "type":"module")
const __filename = fileURLToPath(import.meta.url);
const __dirname_esm = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "alice", "x-api-key", "mcp-session-id"]
}));
app.options("*", cors());
app.use(express.json({ limit: "2mb" }));

// Serve dashboard HTML directly — no build step, no path guessing
// dashboard.html sits in api/src/, compiled to api/dist/../src/dashboard.html
// but we read it relative to the running file location
const dashboardPath = path.resolve(__dirname_esm, "../src/dashboard.html");
const hasDashboard = fs.existsSync(dashboardPath);
console.log(`[UI] Dashboard: ${dashboardPath} — exists: ${hasDashboard}`);

const store = new FhirStore();
const bus = new A2ABus();

bus.register("MedicationReconciliationAgent", async (msg) => msg.payload);
bus.register("EvidenceAgent", async (msg) => msg.payload);
bus.register("PacketComposerAgent", async (msg) => msg.payload);
bus.register("PolicyAgent", async (msg) => msg.payload);
bus.register("DecisionAgent", async (msg) => msg.payload);
bus.register("AuditAgent", async (msg) => msg.payload);

async function a2aSend(from: string, to: string, type: string, payload: any) {
  return bus.send({ id: randomUUID(), ts: new Date().toISOString(), from, to, type, payload });
}



function refOf(resource: any) {
  return resource?.id ? `${resource.resourceType}/${resource.id}` : resource?.resourceType ?? "unknown";
}

function buildShowMeWhy(requestContext: any) {
  const variant = requestContext?.policyVariant ?? "standard";
  const policy = getPolicyDefinition(variant);

  const conditions = store.search("Condition", { subject: "patient-001" });
  const observations = store.search("Observation", { subject: "patient-001" });
  const statements = store.search("MedicationStatement", { subject: "patient-001" });
  const bpmhLists = store.search("List", { subject: "patient-001" });

  const t2dMatches = conditions.filter((c: any) => JSON.stringify(c).toLowerCase().includes("type 2"));
  const a1cMatches = observations.filter((o: any) => JSON.stringify(o).toLowerCase().includes("a1c"));
  const latestA1c = a1cMatches[0];
  const a1cValue = latestA1c?.valueQuantity?.value ?? null;
  const hasIntolerance = statements.some((s: any) => (s.note?.[0]?.text ?? "").toLowerCase().includes("intolerance"));
  const metforminRefs = statements
    .filter((s: any) => (s.medicationCodeableConcept?.text ?? "").toLowerCase().includes("metformin"))
    .map((s: any) => refOf(s));

  const byKey: Record<string, any> = {
    t2d: {
      key: "t2d",
      label: policy.rules.find((r) => r.key === "t2d")?.label ?? "Type 2 Diabetes diagnosis",
      satisfied: t2dMatches.length > 0,
      reason: t2dMatches.length > 0 ? "Diagnosis found in Condition resources." : "No qualifying diagnosis found.",
      refs: t2dMatches.map(refOf),
      values: t2dMatches.map((c: any) => c.code?.text).filter(Boolean)
    },
    a1c: {
      key: "a1c",
      label: policy.rules.find((r) => r.key === "a1c")?.label ?? "HbA1c threshold",
      satisfied: typeof a1cValue === "number" && a1cValue >= (policy.rules.find((r) => r.key === "a1c")?.threshold ?? 7),
      reason: typeof a1cValue === "number"
        ? `Latest HbA1c is ${a1cValue}%.`
        : "No HbA1c observation available.",
      refs: latestA1c ? [refOf(latestA1c)] : [],
      values: typeof a1cValue === "number" ? [`${a1cValue}%`] : []
    },
    step: {
      key: "step",
      label: policy.rules.find((r) => r.key === "step")?.label ?? "Metformin trial or intolerance",
      satisfied: metforminRefs.length > 0 || hasIntolerance,
      reason: hasIntolerance
        ? "Metformin intolerance documented."
        : metforminRefs.length > 0
          ? "Metformin trial found in medication history."
          : "No metformin history or intolerance found.",
      refs: [...metforminRefs, ...bpmhLists.map(refOf)],
      values: hasIntolerance ? ["GI intolerance documented"] : []
    }
  };

  return {
    policy,
    generatedAt: new Date().toISOString(),
    criteria: policy.rules.map((r) => byKey[r.key]).filter(Boolean)
  };
}

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", hasDashboard, dashboardPath, cwd: process.cwd() });
});

app.get("/", (_req, res) => {
  res.sendFile(dashboardPath);
});

// ── SMART Health IT proxy routes ─────────────────────────────────────────────
app.post("/api/smart/search", async (req, res) => {
  try {
    const { query, diabetesOnly, maxResults } = req.body;
    const patients = diabetesOnly
      ? await searchDiabetesPatients(maxResults ?? 5)
      : await searchSmartPatients(query ?? "", maxResults ?? 5);
    res.json({ patients });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/smart/import", async (req, res) => {
  try {
    const { smartPatientId, forceRefresh } = req.body;
    if (!smartPatientId) return res.status(400).json({ error: "smartPatientId required" });
    const result = await importPatientFromSmart(smartPatientId, store, { forceRefresh });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Audit Trail API ──────────────────────────────────────────────────────────
// Register known aliases on startup so the API can resolve any ID
registerIdAliases("patient-001", "79f8fd18-5044-452d-b9bd-428b1e35e579");
registerIdAliases("patient-ra-001", "147e21d9-ab4e-449c-aeb4-8f3d6f7b1b4c");
registerIdAliases("patient-comorbid-001", "d6417ffa-1ed8-4bb9-ae4c-d3820c9615f9");
registerIdAliases("patient-incomplete-001", "c03971b6-de14-485c-b8c5-e6a12a6c7978");
registerIdAliases("patient-expired-001", "b3966c57-148b-4027-bac9-1bffe6a95a2d");
registerIdAliases("patient-paediatric-001", "2ff631a2-7c7a-43db-8f34-75fbd7938450");
registerIdAliases("patient-urgent-001", "776a2088-fe38-4a36-9478-101fbeb0b8b3");

app.get("/api/audit/:patientId", (req, res) => {
  const trail = getLatestTrailForPatient(req.params.patientId);
  if (!trail) return res.status(404).json({ error: "No audit trail found. Run a prior authorization first." });
  res.json(trail);
});

app.get("/api/audit/:patientId/all", (req, res) => {
  const trails = getAllTrailsForPatient(req.params.patientId);
  res.json({ patientId: req.params.patientId, count: trails.length, trails });
});

app.get("/api/audit", (_req, res) => {
  res.json(getAllTrails());
});

// ── Appeal letter content endpoint ───────────────────────────────────────────
app.get("/api/appeal-letter/:docId", (req, res) => {
  const doc = store.read("DocumentReference", req.params.docId);
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const attachment = doc.content?.[0]?.attachment;
  const letterText = attachment?.data
    ? Buffer.from(attachment.data, "base64").toString("utf-8")
    : null;

  let meta: any = {};
  try { meta = JSON.parse(doc.extension?.[0]?.valueString ?? "{}"); } catch {}

  res.json({
    id: doc.id,
    date: doc.date,
    subject: meta.subject ?? doc.description ?? "Appeal Letter",
    letterText,
    appealRound: meta.appealRound ?? 1,
    denialReasons: meta.denialReasons ?? [],
    citations: meta.citations ?? [],
    model: meta.model ?? null,
    durationMs: meta.durationMs ?? null,
    hasContent: !!letterText,
  });
});


// ── ARIA Chat endpoint ────────────────────────────────────────────────────────
app.post("/api/aria-chat", async (req, res) => {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
    const { messages, system } = req.body;
    if (!messages?.length) return res.status(400).json({ error: "messages required" });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: system ?? "You are ARIA, the Appeal & Rebuttal Intelligence Agent.",
        messages,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }
    const data = await response.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Appeals route ─────────────────────────────────────────────────────────────
app.get("/api/appeals/:patientId", (req, res) => {
  const pid = req.params.patientId;
  const aliases = [pid,
    "patient-001", "79f8fd18-5044-452d-b9bd-428b1e35e579",
    "patient-ra-001", "147e21d9-ab4e-449c-aeb4-8f3d6f7b1b4c",
    "patient-comorbid-001", "d6417ffa-1ed8-4bb9-ae4c-d3820c9615f9",
  ];
  const seen = new Set<string>();
  const allDocs: any[] = [];
  for (const alias of aliases) {
    const docs = store.search("DocumentReference", { subject: alias });
    for (const d of docs) {
      if (!seen.has(d.id)) { seen.add(d.id); allDocs.push(d); }
    }
  }
  const appealLetters = allDocs.filter((d: any) => d.type?.text === "Prior Authorization Appeal Letter");
  const counterDenials = allDocs.filter((d: any) => d.type?.text === "Payer Counter-Denial");
  const rounds = appealLetters.map((d: any, i: number) => {
    const counter = counterDenials.find((c: any) =>
      c.relatesTo?.some((r: any) => r.target?.reference?.includes(d.id))
    );
    return {
      round: i + 1,
      appealId: d.id,
      date: d.date,
      description: d.description,
      urgencyLevel: i >= 2 ? "urgent" : i === 1 ? "expedited" : "standard",
      counterDenial: counter ? { id: counter.id, date: counter.date, description: counter.description } : null,
    };
  });
  const status = rounds.length === 0 ? "no_appeal"
    : counterDenials.length >= rounds.length ? "counter_denied"
    : `round_${rounds.length}_pending`;
  res.json({
    patientId: pid, status, totalRounds: rounds.length,
    totalCounterDenials: counterDenials.length, rounds,
    escalationPath: rounds.length >= 3
      ? ["File complaint with state insurance commissioner", "Request peer-to-peer review", "Initiate external IRO process"]
      : rounds.length >= 2 ? ["Request peer-to-peer review", "Submit additional documentation"]
      : ["Await payer decision"],
  });
});

// ── MCP Streamable HTTP endpoint (spec 2025-03-26) ───────────────────────────
const mcpHandler = createMcpHandler(store);
app.post("/mcp", (req, res, next) => {
  // MCP spec requires Mcp-Session-Id header in responses
  res.setHeader("Mcp-Session-Id", req.headers["mcp-session-id"] as string ?? "alice-session-1");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  return mcpHandler(req, res);
});

// Discovery endpoint
app.get("/mcp", (_req, res) => {
  res.json({
    name: "alice-prior-auth-mcp",
    version: "1.0.0",
    description: "ALICE — AI-powered prior authorization MCP server",
    transport: "streamable-http",
    endpoint: "/mcp",
    tools: ["alice_fhir_search","alice_fhir_read","alice_policy_check","alice_run_medrec","alice_run_evidence","alice_run_compose","alice_run_full_prior_auth","alice_extract_clinical_note","aria_draft_appeal","aria_get_appeal_status","alice_smart_search","alice_smart_import","alice_list_patients","alice_detect_medication","alice_run_prior_auth_insulin","alice_run_prior_auth_adalimumab","alice_get_audit_trail"],
  });
});

// Legacy simple endpoint for internal UI
app.post("/mcp/legacy", async (req, res) => {
  try {
    const { tool, args } = req.body ?? {};
    const result = await runTool(store, tool, args);
    res.json({ result });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? String(e) });
  }
});

app.post("/seed", async (req, res) => {
  store.clear();
  clearMcpLog();
  const scenario = (req.body?.scenario ?? "complete") as ("complete"|"missing");
  seedSynthetic(store, { scenario });
  writeProvenance(store, { activityText: "Seed synthetic FHIR data", targetRefs: [], usedRefs: [], agent: "Seeder" });
  res.json({ ok: true });
});

// Simulate a new lab arriving to support the denial→approval loop.
// Creates (or replaces) an HbA1c Observation.
app.post("/simulate/lab", (req, res) => {
  const patientId = req.body?.patientId ?? "patient-001";
  const value = typeof req.body?.value === "number" ? req.body.value : 8.4;
  const effectiveDateTime = req.body?.effectiveDateTime ?? new Date().toISOString().slice(0, 10);

  // Remove any existing HbA1c observations (demo simplification)
  const existing = store.search("Observation", {}).filter((o: any) => (o?.code?.text ?? "").toLowerCase().includes("a1c"));
  for (const obs of existing) {
    if (obs?.id) store.delete("Observation", obs.id);
  }

  const obs = store.create({
    resourceType: "Observation",
    status: "final",
    code: { text: "HbA1c" },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime,
    valueQuantity: { value, unit: "%" }
  });

  writeProvenance(store, {
    activityText: "Simulate new HbA1c lab result",
    targetRefs: [`Observation/${obs.id}`],
    usedRefs: [`Patient/${patientId}`],
    agent: "LabSystem"
  });

  res.json({ observation: obs });
});

app.get("/fhir-dump", (_req, res) => res.json(store.dump()));

app.post("/clinician/prescribe", async (req, res) => {
  const patientId = req.body?.patientId ?? "patient-001";
  const medicationRequest = store.create({
    resourceType: "MedicationRequest",
    status: "active",
    intent: "order",
    subject: { reference: `Patient/${patientId}` },
    medicationCodeableConcept: { text: "Semaglutide (GLP-1) - demo" },
    authoredOn: new Date().toISOString()
  });

  writeProvenance(store, {
    activityText: "Clinician created MedicationRequest",
    targetRefs: [`MedicationRequest/${medicationRequest.id}`],
    usedRefs: [`Patient/${patientId}`],
    agent: "Clinician"
  });

  await a2aSend("UI", "PolicyAgent", "medication.proposed", { medicationRequestId: medicationRequest.id });
  res.json({ medicationRequest });
});

app.post("/run/medrec", async (req, res) => {
  const patientId = req.body?.patientId ?? "patient-001";
  await a2aSend("UI", "MedicationReconciliationAgent", "medrec.start", { patientId });
  const out = await runMedRec(store, patientId);
  writeProvenance(store, {
    activityText: "Medication Reconciliation (BPMH)",
    targetRefs: [`List/${out.bpmh.id}`, ...(out.detectedIssues ?? []).map((d: any) => `DetectedIssue/${d.id}`)],
    usedRefs: out.used ?? [],
    agent: "MedicationReconciliationAgent"
  });
  res.json(out);
});

app.post("/run/policy-check", async (req, res) => {
  const requestContext = req.body?.requestContext ?? {};
  await a2aSend("UI", "PolicyAgent", "policy.check", { requestContext });
  const policyResult = await runTool(store, "policy.check", { requestContext, _meta: { agent: "PolicyAgent" } });
  res.json(policyResult);
});

app.post("/run/evidence", async (req, res) => {
  const patientId = req.body?.patientId ?? "patient-001";
  const bpmhListId = req.body?.bpmhListId;
  if (!bpmhListId) return res.status(400).json({ error: "bpmhListId required" });

  await a2aSend("UI", "EvidenceAgent", "evidence.gather", { patientId, bpmhListId });
  const out = await runEvidence(store, patientId, bpmhListId);
  writeProvenance(store, {
    activityText: "Evidence assembly for prior authorization",
    targetRefs: [`DocumentReference/${out.evidenceDoc.id}`],
    usedRefs: out.used ?? [],
    agent: "EvidenceAgent"
  });
  res.json(out);
});

app.post("/run/compose", async (req, res) => {
  const patientId = req.body?.patientId ?? "patient-001";
  const coverageId = req.body?.coverageId ?? "coverage-001";
  const medicationRequestId = req.body?.medicationRequestId;
  const evidenceDocId = req.body?.evidenceDocId;
  const bpmhListId = req.body?.bpmhListId;
  if (!medicationRequestId || !evidenceDocId || !bpmhListId) {
    return res.status(400).json({ error: "medicationRequestId, evidenceDocId, bpmhListId required" });
  }

  await a2aSend("UI", "PacketComposerAgent", "packet.compose", { patientId, coverageId, medicationRequestId, evidenceDocId, bpmhListId });
  const out = await runComposePacket(store, { patientId, coverageId, medicationRequestId, evidenceDocId, bpmhListId });
  writeProvenance(store, {
    activityText: "Compose prior authorization packet (FHIR Bundle)",
    targetRefs: [`Claim/${out.claim.id}`, `Task/${out.task.id}`, `Bundle/${out.bundle.id}`],
    usedRefs: [`Patient/${patientId}`, `Coverage/${coverageId}`, `MedicationRequest/${medicationRequestId}`, `DocumentReference/${evidenceDocId}`, `List/${bpmhListId}`],
    agent: "PacketComposerAgent"
  });
  res.json(out);
});

app.post("/run/submit", async (req, res) => {
  const requestContext = req.body?.requestContext ?? {};
  const claimId = req.body?.claimId;
  if (!claimId) return res.status(400).json({ error: "claimId required" });

  await a2aSend("UI", "DecisionAgent", "payer.submit", { claimId });
  const out = await runDecision(store, { requestContext, claimId });
  writeProvenance(store, {
    activityText: "Payer decision (ClaimResponse)",
    targetRefs: [`ClaimResponse/${out.claimResponse.id}`],
    usedRefs: (requestContext.usedRefs ?? []).concat([`Claim/${claimId}`]),
    agent: "DecisionAgent"
  });
  res.json(out);
});


// ── Full prior auth (single endpoint — calls the same logic as MCP tool) ────
// Route to correct MCP tool based on patient ID
function getAuthTool(patientId: string, policyVariant: string): { tool: string; args: Record<string,any> } {
  const isRA = patientId === "patient-ra-001" || patientId === "147e21d9-ab4e-449c-aeb4-8f3d6f7b1b4c";
  const isComorbid = patientId === "patient-comorbid-001" || patientId === "d6417ffa-1ed8-4bb9-ae4c-d3820c9615f9";
  const isInsulin = policyVariant === "insulin-standard" || policyVariant === "insulin-strict";
  if (isComorbid) return { tool: "alice_run_prior_auth_comorbid", args: { patientId, glp1PolicyVariant: policyVariant.startsWith("adalimumab") ? "standard" : policyVariant, adalimumabPolicyVariant: policyVariant.startsWith("adalimumab") ? policyVariant : "adalimumab-strict" } };
  if (isRA)       return { tool: "alice_run_prior_auth_adalimumab", args: { patientId, policyVariant: policyVariant.startsWith("adalimumab") ? policyVariant : "adalimumab-standard" } };
  if (isInsulin)  return { tool: "alice_run_prior_auth_insulin", args: { patientId, policyVariant } };
  return           { tool: "alice_run_full_prior_auth", args: { patientId, policyVariant } };
}

app.post("/run/full-prior-auth", async (req, res) => {
  try {
    const { patientId = "patient-001", policyVariant = "standard" } = req.body ?? {};

    const isRA       = patientId === "patient-ra-001"       || patientId === "147e21d9-ab4e-449c-aeb4-8f3d6f7b1b4c";
    const isComorbid = patientId === "patient-comorbid-001" || patientId === "d6417ffa-1ed8-4bb9-ae4c-d3820c9615f9";

    const isIncomplete  = patientId === "patient-incomplete-001";
    const isExpired     = patientId === "patient-expired-001";
    const isPaediatric  = patientId === "patient-paediatric-001";
    const isUrgent      = patientId === "patient-urgent-001";

    // Clear and seed correct patient
    store.clear();
    if      (isComorbid)   seedComorbid(store);
    else if (isRA)         seedRA(store);
    else if (isIncomplete) seedIncomplete(store);
    else if (isExpired)    seedExpired(store);
    else if (isPaediatric) seedPaediatric(store);
    else if (isUrgent)     seedUrgent(store);
    else                   seedSynthetic(store, { scenario: "complete" });

    const resolvedId = isComorbid   ? COMORBID_PATIENT_ID
                     : isRA         ? RA_PATIENT_ID
                     : isIncomplete ? INCOMPLETE_PATIENT_ID
                     : isExpired    ? EXPIRED_PATIENT_ID
                     : isPaediatric ? PAEDIATRIC_PATIENT_ID
                     : isUrgent     ? URGENT_PATIENT_ID
                     : LEGACY_PATIENT_ID;

    // ── Eleanor (comorbid) — dual pipeline ───────────────────────────────────
    if (isComorbid) {
      const glp1Variant = policyVariant.startsWith("adalimumab") ? "standard" : policyVariant;
      const adaVariant  = policyVariant.startsWith("adalimumab") ? policyVariant : "adalimumab-strict";

      const conditions  = store.search("Condition",          { subject: resolvedId });
      const observations= store.search("Observation",        { subject: resolvedId });
      const statements  = store.search("MedicationStatement",{ subject: resolvedId });

      const a1cObs    = observations.find((o: any) => JSON.stringify(o).toLowerCase().includes("a1c"));
      const das28Obs  = observations.find((o: any) => JSON.stringify(o).toLowerCase().includes("das28"));
      const a1cValue  = (a1cObs  as any)?.valueQuantity?.value ?? 9.1;
      const das28Value= (das28Obs as any)?.valueQuantity?.value ?? 5.6;
      const hasT2D    = conditions.some((c: any) => JSON.stringify(c).toLowerCase().includes("type 2"));
      const hasRA     = conditions.some((c: any) => JSON.stringify(c).toLowerCase().includes("rheumatoid"));
      const hasMetforminTrial = statements.some((s: any) => (s.medicationCodeableConcept?.text ?? "").toLowerCase().includes("metformin"));
      const hasMetforminIntolerance = statements.some((s: any) => (s.note?.[0]?.text ?? "").toLowerCase().includes("intoler"));
      const hasMtxTrial = statements.some((s: any) => JSON.stringify(s).toLowerCase().includes("methotrexate"));
      const dmardFailures = statements.filter((s: any) => {
        const t = (s.medicationCodeableConcept?.text ?? "").toLowerCase();
        return (t.includes("methotrexate") || t.includes("leflunomide") || t.includes("hydroxychloroquine")) && s.status === "stopped";
      }).length;

      const glp1Policy= checkPolicy({ hasT2D, a1cValue, hasMetforminTrial, hasMetforminIntolerance, policyVariant: glp1Variant } as any);
      const adaPolicy = checkPolicy({ hasRA, das28Value, hasMtxTrial, dmardFailures, policyVariant: adaVariant } as any);

      const medrecResult = await runMedRec(store, resolvedId);
      let medReq = store.search("MedicationRequest", { subject: resolvedId })[0];
      if (!medReq) medReq = store.create({ resourceType: "MedicationRequest", status: "active", intent: "order", subject: { reference: `Patient/${resolvedId}` }, medicationCodeableConcept: { text: "Semaglutide (GLP-1) + Adalimumab" }, authoredOn: new Date().toISOString() });
      const evidenceResult = await runEvidence(store, resolvedId, medrecResult.bpmh.id);
      (evidenceResult as any).derived = { hasT2D, hasRA, a1cValue, das28Value, hasMetforminTrial, hasMetforminIntolerance, hasMtxTrial };

      const overallApproved = glp1Policy.missing.length === 0 && adaPolicy.missing.length === 0;
      const overallDecision = glp1Policy.missing.length === 0 && adaPolicy.missing.length === 0 ? "APPROVED"
        : glp1Policy.missing.length > 0  && adaPolicy.missing.length > 0  ? "DENIED" : "PARTIAL";

      return res.json({
        patientType: "comorbid",
        summary: { patientId: resolvedId, approved: overallApproved, overallDecision, bundleId: null },
        medrec: medrecResult,
        evidence: evidenceResult,
        dualPriorAuth: {
          glp1:      { approved: glp1Policy.missing.length === 0, missing: glp1Policy.missing, medication: "Semaglutide (GLP-1)", policyVariant: glp1Variant, a1cValue },
          adalimumab:{ approved: adaPolicy.missing.length  === 0, missing: adaPolicy.missing,  medication: "Adalimumab (Humira)",  policyVariant: adaVariant,  das28Value },
        },
        overallDecision,
        policy: { missing: [...glp1Policy.missing, ...adaPolicy.missing] },
        clinicalEvidence: { hasT2D, hasRA, a1cValue, das28Value, hasMtxTrial },
      });
    }

    // ── Dorothea (RA) or Bernard (GLP-1) / SMART patient ────────────────────
    let resolvedPolicy = policyVariant;
    if (isRA && !policyVariant.startsWith("adalimumab")) resolvedPolicy = "adalimumab-standard";
    if (!isRA && policyVariant.startsWith("adalimumab")) resolvedPolicy = "standard";

    const medrecResult = await runMedRec(store, resolvedId);
    let medReq = store.search("MedicationRequest", { subject: resolvedId })[0];
    if (!medReq) {
      medReq = store.create({ resourceType: "MedicationRequest", status: "active", intent: "order", subject: { reference: `Patient/${resolvedId}` }, medicationCodeableConcept: { text: isRA ? "Adalimumab 40mg (Humira)" : "Semaglutide (GLP-1)" }, authoredOn: new Date().toISOString() });
    }

    const evidenceResult = await runEvidence(store, resolvedId, medrecResult.bpmh.id);
    const conditions  = store.search("Condition",          { subject: resolvedId });
    const observations= store.search("Observation",        { subject: resolvedId });
    const statements  = store.search("MedicationStatement",{ subject: resolvedId });

    const hasT2D = conditions.some((c: any) => JSON.stringify(c).toLowerCase().includes("type 2"));
    const hasRA  = conditions.some((c: any) => JSON.stringify(c).toLowerCase().includes("rheumatoid") || JSON.stringify(c).toLowerCase().includes("arthritis"));
    const a1cObs   = observations.find((o: any) => JSON.stringify(o).toLowerCase().includes("a1c"));
    const das28Obs = observations.find((o: any) => JSON.stringify(o).toLowerCase().includes("das28"));
    const a1cValue   = (a1cObs   as any)?.valueQuantity?.value ?? null;
    const das28Value = (das28Obs as any)?.valueQuantity?.value ?? null;
    const hasMetforminTrial       = statements.some((s: any) => (s.medicationCodeableConcept?.text ?? "").toLowerCase().includes("metformin"));
    const hasMetforminIntolerance = statements.some((s: any) => (s.note?.[0]?.text ?? "").toLowerCase().includes("intoler"));
    const hasMtxTrial = statements.some((s: any) => JSON.stringify(s).toLowerCase().includes("methotrexate"));

    (evidenceResult as any).derived = { hasT2D, hasRA, a1cValue, das28Value, hasMetforminTrial, hasMetforminIntolerance, hasMtxTrial };

    const policyResult = checkPolicy({ hasT2D, hasRA, a1cValue, das28Value, hasMetforminTrial, hasMetforminIntolerance, hasMtxTrial, policyVariant: resolvedPolicy } as any);
    const packetResult = await runComposePacket(store, { patientId: resolvedId, coverageId: isRA ? "coverage-ra-001" : "coverage-001", medicationRequestId: medReq.id!, evidenceDocId: evidenceResult.evidenceDoc.id, bpmhListId: medrecResult.bpmh.id });
    const approved = policyResult.missing.length === 0;

    res.json({
      patientType: isRA ? "ra" : "glp1",
      summary: { patientId: resolvedId, policyVariant: resolvedPolicy, approved, policyResult, bundleId: packetResult.bundle.id },
      medrec: medrecResult,
      evidence: evidenceResult,
      policy: policyResult,
      packet: packetResult,
      clinicalEvidence: { hasT2D, hasRA, a1cValue, das28Value, hasMtxTrial },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/run/demo-denied-appeal", async (req, res) => {
  try {
    const { patientId = "patient-001" } = req.body ?? {};
    // Use the same clean pipeline as full-prior-auth but with denied variant
    store.clear();
    seedSynthetic(store, { scenario: "complete" });
    const resolvedId = LEGACY_PATIENT_ID;
    const medrecResult = await runMedRec(store, resolvedId);
    let medReq = store.search("MedicationRequest", { subject: resolvedId })[0];
    if (!medReq) medReq = store.create({ resourceType: "MedicationRequest", status: "active", intent: "order", subject: { reference: `Patient/${resolvedId}` }, medicationCodeableConcept: { text: "Semaglutide (GLP-1)" }, authoredOn: new Date().toISOString() });
    const evidenceResult = await runEvidence(store, resolvedId, medrecResult.bpmh.id);
    const conditions = store.search("Condition", { subject: resolvedId });
    const observations = store.search("Observation", { subject: resolvedId });
    const statements = store.search("MedicationStatement", { subject: resolvedId });
    const hasT2D = conditions.some((c: any) => JSON.stringify(c).toLowerCase().includes("type 2"));
    const a1cObs = observations.find((o: any) => JSON.stringify(o).toLowerCase().includes("a1c"));
    const a1cValue = (a1cObs as any)?.valueQuantity?.value ?? null;
    const hasMetforminTrial = statements.some((s: any) => (s.medicationCodeableConcept?.text ?? "").toLowerCase().includes("metformin"));
    const hasMetforminIntolerance = statements.some((s: any) => (s.note?.[0]?.text ?? "").toLowerCase().includes("intoler"));
    const policyResult = checkPolicy({ hasT2D, a1cValue, hasMetforminTrial, hasMetforminIntolerance, policyVariant: "denied" } as any);
    const packetResult = await runComposePacket(store, { patientId: resolvedId, coverageId: "coverage-001", medicationRequestId: medReq.id!, evidenceDocId: evidenceResult.evidenceDoc.id, bpmhListId: medrecResult.bpmh.id });
    const denialReasons = policyResult.missing.length ? policyResult.missing : ["Step therapy criteria not met under strict policy"];
    const appeal = await executeTool(store, "aria_draft_appeal", { patientId: resolvedId, denialReasons, claimId: packetResult.claim?.id, policyVariant: "denied" });
    res.json({ denied: { summary: { approved: false, policyResult }, policy: policyResult, packet: packetResult, evidence: { derived: { hasT2D, a1cValue } }, medrec: medrecResult }, appeal, denialReasons });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
app.get("/packet/:bundleId", (req, res) => {
  const bundleId = req.params.bundleId;
  const bundle = store.read("Bundle", bundleId);
  if (!bundle) return res.status(404).json({ error: "Bundle not found" });
  res.setHeader("Content-Type", "application/fhir+json");
  res.setHeader("Content-Disposition", `attachment; filename="prior-auth-packet-${bundleId}.json"`);
  res.send(JSON.stringify(bundle, null, 2));
});


app.get("/policy-data", (req, res) => {
  const variants = ["standard","strict","denied","insulin-standard","insulin-strict","adalimumab-standard","adalimumab-strict"];
  const library: Record<string, any> = {};
  for (const v of variants) library[v] = getPolicyDefinition(v);
  const variant = String(req.query?.variant ?? "standard");
  const policy = getPolicyDefinition(variant);
  const diff = diffPolicies("standard", "strict");
  res.json({ policy, library, diff });
});

app.post("/show-me-why", (req, res) => {
  const requestContext = req.body?.requestContext ?? {};
  res.json(buildShowMeWhy(requestContext));
});

app.get("/trace", (_req, res) => {
  const provenance = store.search("Provenance", {});
  res.json({ provenance });
});

app.get("/messages", (_req, res) => res.json({ messages: bus.messages }));

app.get("/mcp-log", (_req, res) => res.json({ tools: getMcpLog() }));

// SPA fallback: serve index.html for non-API GET routes.
app.get(/^\/(?!mcp|seed|fhir-dump|clinician|run|packet|trace|messages|mcp-log|policy-data|show-me-why|simulate|api|health).*/, (_req, res) => {
  res.sendFile(dashboardPath);
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log("API listening on http://localhost:" + port);
  console.log("POST /seed first to load synthetic data");
});
