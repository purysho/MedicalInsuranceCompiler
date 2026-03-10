import express from "express";
import cors from "cors";
import { FhirStore } from "./fhirStore.js";
import { seedSynthetic, PO_PATIENT_ID } from "./seed.js";
import { A2ABus } from "./a2a.js";
import { runMedRec } from "./agents/medrecAgent.js";
import { runEvidence } from "./agents/evidenceAgent.js";
import { runComposePacket } from "./agents/packetComposerAgent.js";
import { runDecision } from "./agents/decisionAgent.js";
import { writeProvenance } from "./agents/auditAgent.js";
import { clearMcpLog, getMcpLog, runTool } from "./mcp.js";
import { createMcpHandler } from "./mcpServer.js";
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
  res.json({ status: "ok", hasDashboard, dashboardPath, cwd: process.cwd(), dirname: __dirname_esm });
});

app.get("/", (_req, res) => {
  if (hasUi) {
    res.sendFile(dashboardPath);
  } else {
    res.type("text/plain").send("OK - MedicalInsuranceCompiler API is running");
  }
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

app.get("/packet/:bundleId", (req, res) => {
  const bundleId = req.params.bundleId;
  const bundle = store.read("Bundle", bundleId);
  if (!bundle) return res.status(404).json({ error: "Bundle not found" });
  res.setHeader("Content-Type", "application/fhir+json");
  res.setHeader("Content-Disposition", `attachment; filename="prior-auth-packet-${bundleId}.json"`);
  res.send(JSON.stringify(bundle, null, 2));
});


app.get("/policy-data", (req, res) => {
  const variant = String(req.query?.variant ?? "standard");
  const policy = getPolicyDefinition(variant);
  const diff = diffPolicies("standard", "strict");
  res.json({ policy, library: Object.values({ standard: getPolicyDefinition("standard"), strict: getPolicyDefinition("strict") }), diff });
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
if (hasUi) {
  app.get(/^\/(?!mcp|seed|fhir-dump|clinician|run|packet|trace|messages|mcp-log|policy-data|show-me-why|simulate).*/, (_req, res) => {
    res.sendFile(dashboardPath);
  });
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log("API listening on http://localhost:" + port);
  console.log("POST /seed first to load synthetic data");
});
