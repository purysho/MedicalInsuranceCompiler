/**
 * MCP Streamable HTTP Transport
 * Spec: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http
 *
 * Single endpoint POST /mcp handles all JSON-RPC 2.0 messages.
 * Supports: initialize, tools/list, tools/call
 */

import { Request, Response } from "express";
import { FhirStore } from "./fhirStore.js";
import { seedSynthetic, seedRA, seedComorbid, seedIncomplete, seedExpired, seedPaediatric, seedUrgent,
         PO_PATIENT_ID, LEGACY_PATIENT_ID, RA_PATIENT_ID, PO_RA_PATIENT_ID, COMORBID_PATIENT_ID, PO_COMORBID_PATIENT_ID,
         INCOMPLETE_PATIENT_ID, EXPIRED_PATIENT_ID, PAEDIATRIC_PATIENT_ID, URGENT_PATIENT_ID } from "./seed.js";
import { extractClinicalNote, mergeWithFhirContext } from "./agents/noteExtractorAgent.js";
import { draftAppealLetter, buildAppealContext } from "./agents/appealAgent.js";
import { searchSmartPatients, searchDiabetesPatients, importPatientFromSmart, LOCAL_SYNTHETIC_IDS } from "./fhirClient.js";
import { checkPolicy } from "./policy.js";

// ── Seed correct patient data based on any patient ID, name, or DOB ──────────
// PO UUIDs for patients registered in Prompt Opinion workspace
const PO_ELEANOR_ID    = "d6417ffa-1ed8-4bb9-ae4c-d3820c9615f9";
const PO_MARCUS_ID     = "c03971b6-de14-485c-b8c5-e6a12a6c7978";
const PO_SANDRA_ID     = "b3966c57-148b-4027-bac9-1bffe6a95a2d";
const PO_JAMIE_ID      = "2ff631a2-7c7a-43db-8f34-75fbd7938450";
const PO_ROSA_ID       = "776a2088-fe38-4a36-9478-101fbeb0b8b3";

// Name + DOB fingerprints for matching PO patients by demographics
const PATIENT_FINGERPRINTS: Array<{ names: string[]; dobs: string[]; seed: (s: FhirStore) => void; id: string }> = [
  { names: ["bernard", "rieux"],         dobs: ["1947-01-03","01/03/1947","1947-03-01"], seed: s => seedSynthetic(s, { scenario: "complete" }), id: LEGACY_PATIENT_ID },
  { names: ["dorothea", "brooke"],       dobs: ["1968-04-22","04/22/1968","1968-22-04"], seed: seedRA,          id: RA_PATIENT_ID },
  { names: ["eleanor", "vance"],         dobs: ["1971-09-14","09/14/1971","1971-14-09"], seed: seedComorbid,    id: COMORBID_PATIENT_ID },
  { names: ["marcus", "webb"],           dobs: ["1965-08-14","08/14/1965","1965-14-08"], seed: seedIncomplete,  id: INCOMPLETE_PATIENT_ID },
  { names: ["sandra", "okonkwo"],        dobs: ["1958-11-02","11/02/1958","1958-02-11"], seed: seedExpired,     id: EXPIRED_PATIENT_ID },
  { names: ["jamie", "chen"],            dobs: ["2012-03-19","03/19/2012","2012-19-03"], seed: seedPaediatric,  id: PAEDIATRIC_PATIENT_ID },
  { names: ["rosa", "martinez"],         dobs: ["1971-07-30","07/30/1971","1971-30-07"], seed: seedUrgent,      id: URGENT_PATIENT_ID },
];


function resourceText(resource: any): string {
  return JSON.stringify(resource ?? {}).toLowerCase();
}

function findCoverageId(store: FhirStore, patientId: string): string {
  const coverage =
    store.search("Coverage", { patient: patientId })[0] ??
    store.search("Coverage", { subject: patientId })[0];

  return coverage?.id ?? `coverage-${patientId}`;
}

function getClinicalProfile(store: FhirStore, patientId: string) {
  const conditions = store.search("Condition", { subject: patientId });
  const observations = store.search("Observation", { subject: patientId });
  const statements = store.search("MedicationStatement", { subject: patientId });

  const condText = resourceText(conditions);

  const hasRA =
    condText.includes("rheumatoid") ||
    condText.includes("69896004");

  const hasT1D =
    condText.includes("type 1") ||
    condText.includes('"e10"') ||
    condText.includes("type 1 diabetes mellitus");

  const hasT2D =
    condText.includes("type 2") ||
    condText.includes('"e11"') ||
    condText.includes("type 2 diabetes mellitus") ||
    (!!condText.includes("diabetes") && !hasT1D);

  const hasDKA =
    condText.includes("ketoacidosis") ||
    condText.includes("dka");

  const a1cObs = observations.find((o: any) =>
    resourceText(o).includes("a1c") ||
    resourceText(o).includes("glycat")
  );
  const das28Obs = observations.find((o: any) =>
    resourceText(o).includes("das28")
  );

  const hasMetforminTrial = statements.some((s: any) =>
    resourceText(s).includes("metformin")
  );

  const hasMetforminIntolerance = statements.some((s: any) =>
    resourceText(s).includes("metformin") &&
    (resourceText(s).includes("intoler") ||
      resourceText(s).includes("contraind") ||
      resourceText(s).includes("gi side") ||
      resourceText(s).includes("nausea") ||
      resourceText(s).includes("vomit"))
  );

  return {
    conditions,
    observations,
    statements,
    hasRA,
    hasT1D,
    hasT2D,
    hasDKA,
    a1cValue: a1cObs?.valueQuantity?.value ?? null,
    das28Value: das28Obs?.valueQuantity?.value ?? null,
    hasMetforminTrial,
    hasMetforminIntolerance,
  };
}

function seedForPatient(store: FhirStore, patientId: string, patientName?: string, dob?: string): string {
  const id = patientId ?? LEGACY_PATIENT_ID;

  // Match by known internal or PO IDs first
  if (id === LEGACY_PATIENT_ID    || id === PO_PATIENT_ID)      { store.clear(); seedSynthetic(store, { scenario: "complete" }); return LEGACY_PATIENT_ID; }
  if (id === RA_PATIENT_ID        || id === PO_RA_PATIENT_ID)   { store.clear(); seedRA(store);         return RA_PATIENT_ID; }
  if (id === COMORBID_PATIENT_ID  || id === PO_ELEANOR_ID)      { store.clear(); seedComorbid(store);   return COMORBID_PATIENT_ID; }
  if (id === INCOMPLETE_PATIENT_ID  || id === PO_MARCUS_ID)  { store.clear(); seedIncomplete(store);  return INCOMPLETE_PATIENT_ID; }
  if (id === EXPIRED_PATIENT_ID     || id === PO_SANDRA_ID)  { store.clear(); seedExpired(store);     return EXPIRED_PATIENT_ID; }
  if (id === PAEDIATRIC_PATIENT_ID  || id === PO_JAMIE_ID)   { store.clear(); seedPaediatric(store);  return PAEDIATRIC_PATIENT_ID; }
  if (id === URGENT_PATIENT_ID      || id === PO_ROSA_ID)    { store.clear(); seedUrgent(store);      return URGENT_PATIENT_ID; }

  // Unknown ID — try to match by name or DOB (handles Prompt Opinion UUIDs for new patients)
  const nameLower = (patientName ?? "").toLowerCase();
  const dobStr    = dob ?? "";
  for (const fp of PATIENT_FINGERPRINTS) {
    const nameMatch = fp.names.some(n => nameLower.includes(n));
    const dobMatch  = fp.dobs.some(d => dobStr.includes(d) || d.includes(dobStr.slice(0, 7)));
    if (nameMatch || dobMatch) {
      store.clear();
      fp.seed(store);
      // Register this PO UUID as an alias so audit trail resolves correctly
      registerIdAliases(fp.id, id);
      return fp.id;
    }
  }

  // Fallback — if we can read the patient from the store to get name/DOB
  const existing = store.read("Patient", id);
  if (existing) {
    const existName = (existing.name?.[0]?.text ?? existing.name?.[0]?.family ?? "").toLowerCase();
    const existDob  = existing.birthDate ?? "";
    for (const fp of PATIENT_FINGERPRINTS) {
      if (fp.names.some(n => existName.includes(n)) || fp.dobs.some(d => existDob.includes(d.slice(0,7)))) {
        fp.seed(store);
        registerIdAliases(fp.id, id);
        return fp.id;
      }
    }
  }

  // Last resort — seed Bernard (GLP-1 standard)
  store.clear();
  seedSynthetic(store, { scenario: "complete" });
  return LEGACY_PATIENT_ID;
}
import {
  getOrStartSession, startSession, getActiveSession, appendEvent, completeSession,
  getTrail, getLatestTrailForPatient, getAllTrailsForPatient, getAllTrails,
  registerIdAliases,
} from "./auditTrail.js";

// ── Known patient ID aliases — register on startup ───────────────────────────
registerIdAliases(
  "patient-001",
  "79f8fd18-5044-452d-b9bd-428b1e35e579"  // Bernard Rieux PO UUID
);
registerIdAliases(
  "patient-ra-001",
  "147e21d9-ab4e-449c-aeb4-8f3d6f7b1b4c"  // Dorothea Brooke PO UUID
);

// ── Tool → agent mapping for catch-all audit ─────────────────────────────────
function toolToAgent(toolName: string): "ALICE" | "ARIA" {
  return toolName.startsWith("aria_") ? "ARIA" : "ALICE";
}

// Extract patient ID from args — tries all common field names
function extractPatientId(args: Record<string, any>): string | undefined {
  return args.patientId ?? args.patient_id ?? args.id ?? undefined;
}

import { runMedRec } from "./agents/medrecAgent.js";
import { runEvidence } from "./agents/evidenceAgent.js";
import { runComposePacket } from "./agents/packetComposerAgent.js";
import { runDecision } from "./agents/decisionAgent.js";

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "alice_fhir_search",
    description:
      "Search FHIR resources in the ALICE patient store. Returns matching resources for a given resourceType and optional filter parameters.",
    inputSchema: {
      type: "object",
      properties: {
        resourceType: {
          type: "string",
          description:
            "FHIR resource type to search (e.g. Patient, Condition, Observation, MedicationStatement, MedicationRequest, Coverage, List)",
        },
        parameters: {
          type: "object",
          description:
            "Optional key/value filter parameters (e.g. { subject: 'patient-001' })",
          additionalProperties: { type: "string" },
        },
      },
      required: ["resourceType"],
    },
  },
  {
    name: "alice_fhir_read",
    description: "Read a single FHIR resource by resourceType and id.",
    inputSchema: {
      type: "object",
      properties: {
        resourceType: { type: "string", description: "FHIR resource type" },
        id: { type: "string", description: "Resource ID" },
      },
      required: ["resourceType", "id"],
    },
  },
  {
    name: "alice_policy_check",
    description:
      "Check whether a prior authorization request satisfies payer policy criteria. Returns which criteria are met and which are missing.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: {
          type: "string",
          description: "FHIR Patient ID (default: patient-001)",
        },
        policyVariant: {
          type: "string",
          enum: ["standard", "strict", "denied"],
          description: "Which payer policy ruleset to evaluate (default: standard)",
        },
      },
    },
  },
  {
    name: "alice_run_medrec",
    description:
      "Run medication reconciliation (BPMH) for a patient. Detects drug interactions, duplicates, and builds a Best Possible Medication History list. Returns FHIR List and any DetectedIssues.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: {
          type: "string",
          description: "FHIR Patient ID (default: patient-001)",
        },
      },
    },
  },
  {
    name: "alice_run_evidence",
    description:
      "Gather and assemble clinical evidence for a prior authorization request. Extracts T2D diagnosis, HbA1c observations, and step therapy history into a FHIR DocumentReference.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: {
          type: "string",
          description: "FHIR Patient ID (default: patient-001)",
        },
        bpmhListId: {
          type: "string",
          description: "ID of the BPMH List resource from alice.run.medrec",
        },
      },
      required: ["bpmhListId"],
    },
  },
  {
    name: "alice_run_compose",
    description:
      "Compose a complete prior authorization FHIR Bundle (Claim + supporting documents). This is the final step before payer submission.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: {
          type: "string",
          description: "FHIR Patient ID (default: patient-001)",
        },
        coverageId: {
          type: "string",
          description: "FHIR Coverage ID (default: coverage-001)",
        },
        medicationRequestId: {
          type: "string",
          description: "FHIR MedicationRequest ID for the requested drug",
        },
        evidenceDocId: {
          type: "string",
          description: "FHIR DocumentReference ID from alice.run.evidence",
        },
        bpmhListId: {
          type: "string",
          description: "FHIR List ID from alice.run.medrec",
        },
      },
      required: ["medicationRequestId", "evidenceDocId", "bpmhListId"],
    },
  },
  {
    name: "alice_run_full_prior_auth",
    description:
      "Run the complete ALICE prior authorization pipeline end-to-end for a patient: medication reconciliation → evidence gathering → policy check → packet composition. Returns a complete FHIR Bundle ready for payer submission.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: {
          type: "string",
          description: "FHIR Patient ID (default: patient-001)",
        },
        policyVariant: {
          type: "string",
          enum: ["standard", "strict", "denied"],
          description: "Payer policy ruleset to use (default: standard)",
        },
        clinicalNote: {
          type: "string",
          description: "Optional free-text clinical note to supplement FHIR data via AI extraction",
        },
      },
    },
  },
  {
    name: "alice_extract_clinical_note",
    description:
      "Use Claude AI to extract structured prior authorization criteria from an unstructured clinical note. Identifies T2D diagnosis, HbA1c values, metformin trial history, intolerance documentation, and flags ambiguities. This is the AI-powered extraction step — it handles free-text doctor notes, discharge summaries, and clinic letters that contain no structured FHIR data.",
    inputSchema: {
      type: "object",
      properties: {
        noteText: {
          type: "string",
          description: "The full text of the clinical note, discharge summary, or doctor letter to analyze",
        },
        patientId: {
          type: "string",
          description: "Optional FHIR Patient ID to associate the extraction with (for audit trail)",
        },
      },
      required: ["noteText"],
    },
  },
  {
    name: "alice_detect_medication",
    description:
      "Auto-detect which medication class a patient needs prior authorization for, based on their FHIR conditions. Returns the recommended medication, appropriate policy variant, and patient eligibility summary. Use this when the user has not specified a medication — ALICE will detect it from the patient record. Supports: GLP-1/semaglutide (T2D), Basal Insulin (T2D severe), Adalimumab/Humira (Rheumatoid Arthritis).",
    inputSchema: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "FHIR Patient ID" },
      },
      required: ["patientId"],
    },
  },
  {
    name: "alice_run_prior_auth_insulin",
    description:
      "Run a complete prior authorization pipeline for Basal Insulin for a T2D patient. Requires HbA1c >= 9.0 and documented failure on oral hypoglycemic agents. Bernard Rieux (HbA1c 8.4%) will be DENIED under this policy — triggering ARIA appeal.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "FHIR Patient ID" },
        policyVariant: { type: "string", enum: ["insulin-standard", "insulin-strict"], description: "Insulin policy variant (default: insulin-standard)" },
      },
    },
  },
  {
    name: "alice_run_prior_auth_adalimumab",
    description:
      "Run a complete prior authorization pipeline for Adalimumab (Humira) for a Rheumatoid Arthritis patient. Requires RA diagnosis, DAS28 score, and MTX step therapy. Dorothea Brooke (RA patient) has DAS28 4.8 — approves on standard, denied on strict.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "FHIR Patient ID (use patient-ra-001 for demo RA patient Dorothea Brooke)" },
        policyVariant: { type: "string", enum: ["adalimumab-standard", "adalimumab-strict"], description: "Adalimumab policy variant (default: adalimumab-standard)" },
      },
    },
  },
  {
    name: "aria_draft_appeal",
    description:
      "ARIA: Draft a formal clinical appeal letter after a prior authorization denial. Uses Claude AI to craft a persuasive, evidence-based appeal that directly addresses each denial reason, cites specific FHIR clinical evidence, and references ADA clinical guidelines. Call this immediately after a denial is returned by alice_run_full_prior_auth.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: {
          type: "string",
          description: "FHIR Patient ID",
        },
        denialReasons: {
          type: "array",
          items: { type: "string" },
          description: "List of denial reasons from the ClaimResponse or policy check missing fields",
        },
        claimId: {
          type: "string",
          description: "FHIR Claim ID from the prior auth packet",
        },
        claimResponseId: {
          type: "string",
          description: "FHIR ClaimResponse ID if available",
        },
        policyVariant: {
          type: "string",
          enum: ["standard", "strict", "denied"],
          description: "Payer policy variant used (default: standard)",
        },
        noteExtractionSummary: {
          type: "string",
          description: "Optional summary from alice_extract_clinical_note to include as supporting evidence",
        },
      },
      required: ["patientId", "denialReasons"],
    },
  },
  {
    name: "alice_smart_search",
    description:
      "Search the SMART Health IT public FHIR R4 server (r4.smarthealthit.org) for EXTERNAL real Synthea-generated patients by name. CRITICAL: This tool only returns patients from the external SMART Health IT server — it never returns local synthetic patients like 'Demo Patient' (patient-001) or Bernard Rieux. Results are exclusively live records from the public FHIR server. Use this before alice_smart_import to find the right external patient.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Patient name or partial name to search for",
        },
        diabetesOnly: {
          type: "boolean",
          description: "If true, only return patients with a Type 2 Diabetes diagnosis (useful for GLP-1 prior auth demos)",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default: 5)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "alice_smart_import",
    description:
      "Import a real external patient from the SMART Health IT public FHIR R4 server (r4.smarthealthit.org) into ALICE's local store. CRITICAL: Only accepts patient IDs returned by alice_smart_search — never accepts local synthetic IDs like 'patient-001' or the Bernard Rieux UUID. Fetches the full clinical record and returns a prior auth suitability assessment.",
    inputSchema: {
      type: "object",
      properties: {
        smartPatientId: {
          type: "string",
          description: "The FHIR Patient ID on the SMART Health IT server (from alice_smart_search results)",
        },
        forceRefresh: {
          type: "boolean",
          description: "If true, re-fetch from SMART Health IT even if already cached locally",
        },
      },
      required: ["smartPatientId"],
    },
  },
  {
    name: "alice_list_patients",
    description:
      "List all patients currently available in ALICE's local store — including Bernard Rieux (synthetic) and any patients imported from SMART Health IT.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "alice_get_audit_trail",
    description:
      "Retrieve the complete audit trail for a patient's prior authorization session. Returns a full timeline of every agent action, FHIR resource created/used, AI decision with confidence scores, data source attribution (FHIR vs AI extraction vs SMART Health IT), and agent handoffs (ALICE to ARIA). Essential for compliance, transparency, and regulatory review.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "FHIR Patient ID" },
        sessionId: { type: "string", description: "Specific audit session ID (optional — defaults to most recent)" },
        format: {
          type: "string",
          enum: ["full", "summary", "timeline"],
          description: "Output format: full (all events), summary (stats only), timeline (events ordered by time)",
        },
      },
      required: ["patientId"],
    },
  },
  {
    name: "aria_get_appeal_status",
    description:
      "ARIA: Check the status of a prior authorization appeal — returns the drafted appeal letter and any stored appeal documents for a patient.",
    inputSchema: {
      type: "object",
      properties: {
        patientId: {
          type: "string",
          description: "FHIR Patient ID",
        },
      },
      required: ["patientId"],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(
  store: FhirStore,
  name: string,
  args: Record<string, any>
): Promise<any> {
  switch (name) {
    case "alice_fhir_search": {
      // Auto-seed if a patient ID is in parameters and store has no data for them
      const searchParams = args.parameters ?? {};
      const searchPatientId = searchParams.subject
        ? String(searchParams.subject).replace("Patient/", "")
        : (args.patientId ?? null);
      if (searchPatientId) {
        const existing = store.search("Patient", {}).find((p: any) => p.id === searchPatientId);
        if (!existing) {
          // This patient isn't in the store — ensure all patients are seeded
          ensureAllPatients(store);
        }
      }
      return store.search(args.resourceType, searchParams);
    }

    case "alice_fhir_read": {
      // Auto-seed if resource not found
      let resource = store.read(args.resourceType, args.id);
      if (!resource && args.patientId) {
        seedForPatient(store, args.patientId, args.patientName, args.dob);
        resource = store.read(args.resourceType, args.id);
      }
      if (!resource)
        throw new Error(`Resource ${args.resourceType}/${args.id} not found`);
      return resource;
    }

    case "alice_policy_check": {
      const rawPolicyId = args.patientId ?? "patient-001";
      const patientId = (() => {
        const existing = store.search("Patient", {}).find((p: any) => p.id === rawPolicyId);
        if (!existing) return seedForPatient(store, rawPolicyId, args.patientName, args.dob);
        return rawPolicyId;
      })();
      const conditions = store.search("Condition", { subject: patientId });
      const observations = store.search("Observation", { subject: patientId });
      const statements = store.search("MedicationStatement", {
        subject: patientId,
      });

      const hasT2D = conditions.some((c: any) =>
        JSON.stringify(c).toLowerCase().includes("type 2")
      );
      const a1cObs = observations.find((o: any) =>
        JSON.stringify(o).toLowerCase().includes("a1c")
      );
      const a1cValue = (a1cObs as any)?.valueQuantity?.value ?? null;
      const hasMetforminTrial = statements.some((s: any) =>
        (s.medicationCodeableConcept?.text ?? "")
          .toLowerCase()
          .includes("metformin")
      );
      const hasMetforminIntolerance = statements.some((s: any) =>
        (s.note?.[0]?.text ?? "").toLowerCase().includes("intolerance")
      );

      return checkPolicy({
        hasT2D,
        a1cValue,
        hasMetforminTrial,
        hasMetforminIntolerance,
        policyVariant: args.policyVariant ?? "standard",
      });
    }

    case "alice_run_medrec": {
      const patientId = args.patientId ?? "patient-001";
      return runMedRec(store, patientId);
    }

    case "alice_run_evidence": {
      const patientId = args.patientId ?? "patient-001";
      if (!args.bpmhListId)
        throw new Error("bpmhListId is required for alice.run.evidence");
      return runEvidence(store, patientId, args.bpmhListId);
    }

    case "alice_run_compose": {
      if (!args.medicationRequestId || !args.evidenceDocId || !args.bpmhListId)
        throw new Error(
          "medicationRequestId, evidenceDocId, bpmhListId are required"
        );
      return runComposePacket(store, {
        patientId: args.patientId ?? "patient-001",
        coverageId: args.coverageId ?? findCoverageId(store, args.patientId ?? "patient-001"),
        medicationRequestId: args.medicationRequestId,
        evidenceDocId: args.evidenceDocId,
        bpmhListId: args.bpmhListId,
      });
    }

    case "alice_run_full_prior_auth": {
      const rawId = args.patientId ?? args.patient_id ?? LEGACY_PATIENT_ID;
      const patientId = seedForPatient(
        store,
        rawId,
        args.patientName ?? args.patient_name,
        args.dob ?? args.birthDate
      );

      const initialProfile = getClinicalProfile(store, patientId);

      if (initialProfile.hasRA && !initialProfile.hasT1D && !initialProfile.hasT2D) {
        return executeTool(store, "alice_run_prior_auth_adalimumab", {
          ...args,
          patientId,
          policyVariant:
            args.policyVariant?.startsWith("adalimumab")
              ? args.policyVariant
              : "adalimumab-standard",
        });
      }

      if (
        initialProfile.hasT1D ||
        initialProfile.hasDKA ||
        (initialProfile.hasT2D &&
          typeof initialProfile.a1cValue === "number" &&
          initialProfile.a1cValue >= 9.0)
      ) {
        return executeTool(store, "alice_run_prior_auth_insulin", {
          ...args,
          patientId,
          policyVariant:
            args.policyVariant?.startsWith("insulin")
              ? args.policyVariant
              : "insulin-standard",
        });
      }

      // Get or start audit session (catch-all may have already created one)
      const sessionId = getOrStartSession(patientId, "Semaglutide (GLP-1)");
      appendEvent(sessionId, {
        type: "tool_called", agent: "ALICE", action: "alice_run_full_prior_auth",
        description: "Full prior authorization pipeline initiated for GLP-1/Semaglutide",
        dataSources: ["fhir-local"], resourcesCreated: [], resourcesRead: [],
        patientId, policyVariant: args.policyVariant ?? "standard",
      });

      // If a clinical note was provided, extract criteria from it using Claude
      let noteExtractionResult = null;
      if (args.clinicalNote) {
        try {
          noteExtractionResult = await extractClinicalNote(args.clinicalNote);
          appendEvent(sessionId, {
            type: "ai_decision", agent: "ALICE", action: "note_extraction",
            description: "AI extracted clinical criteria from unstructured note",
            dataSources: ["ai-note-extraction"],
            resourcesCreated: [], resourcesRead: [],
            aiDecision: {
              model: noteExtractionResult.model,
              decision: `Extracted: T2D=${noteExtractionResult.extracted.hasT2D}, A1c=${noteExtractionResult.extracted.a1cValue}, MetforminTrial=${noteExtractionResult.extracted.hasMetforminTrial}`,
              confidence: noteExtractionResult.extracted.noteQuality === "complete" ? "high" : noteExtractionResult.extracted.noteQuality === "partial" ? "medium" : "low",
              reasoning: noteExtractionResult.extracted.extractionNotes,
              ambiguities: noteExtractionResult.extracted.ambiguities,
              durationMs: noteExtractionResult.durationMs,
            },
            patientId,
          });
        } catch (noteErr: any) {
          console.warn("Note extraction failed, continuing with FHIR only:", noteErr.message);
        }
      }
      const policyVariant = args.policyVariant ?? "standard";

      // Step 1: Med rec
      const medrecResult = await runMedRec(store, patientId);
      const bpmhListId = medrecResult.bpmh.id;

      // Step 2: Create a medication request for semaglutide if none exists
      let medReqs = store.search("MedicationRequest", { subject: patientId });
      let medReq = medReqs[0];
      if (!medReq) {
        medReq = store.create({
          resourceType: "MedicationRequest",
          status: "active",
          intent: "order",
          subject: { reference: `Patient/${patientId}` },
          medicationCodeableConcept: { text: "Semaglutide (GLP-1)" },
          authoredOn: new Date().toISOString(),
        });
      }

      // Step 3: Evidence
      const evidenceResult = await runEvidence(store, patientId, bpmhListId);
      const evidenceDocId = evidenceResult.evidenceDoc.id;

      // Step 4: Policy check
      const profile = getClinicalProfile(store, patientId);
      const {
        conditions,
        observations,
        statements,
        hasT2D,
        a1cValue,
        hasMetforminTrial,
        hasMetforminIntolerance,
      } = profile;
      // Merge FHIR data with note extraction if available
      let mergedContext = { hasT2D, a1cValue, hasMetforminTrial, hasMetforminIntolerance,
        sources: {} as Record<string, "fhir"|"note"|"both">, ambiguities: [] as string[] };
      if (noteExtractionResult) {
        mergedContext = mergeWithFhirContext(
          { hasT2D, a1cValue, hasMetforminTrial, hasMetforminIntolerance },
          noteExtractionResult.extracted
        );
      }

      const policyResult = checkPolicy({
        hasT2D: mergedContext.hasT2D,
        a1cValue: mergedContext.a1cValue,
        hasMetforminTrial: mergedContext.hasMetforminTrial,
        hasMetforminIntolerance: mergedContext.hasMetforminIntolerance,
        policyVariant,
      });

      // Step 5: Compose packet
      const packetResult = await runComposePacket(store, {
        patientId,
        coverageId: findCoverageId(store, patientId),
        medicationRequestId: medReq.id!,
        evidenceDocId,
        bpmhListId,
      });

      // Record policy decision in audit trail
      const approved = policyResult.missing.length === 0;
      appendEvent(sessionId, {
        type: "ai_decision", agent: "ALICE", action: "policy_check",
        description: `Policy evaluation: ${approved ? "APPROVED" : "DENIED"} — ${policyResult.policyName}`,
        dataSources: ["ai-policy-check", "fhir-local"],
        resourcesCreated: [{ resourceType: "Claim", id: packetResult.claim?.id ?? "" }],
        resourcesRead: [
          { resourceType: "Condition", id: `condition-t2d-${patientId}` },
          { resourceType: "Observation", id: `obs-a1c-${patientId}` },
        ],
        aiDecision: {
          decision: approved ? "APPROVED" : "DENIED",
          confidence: "high",
          reasoning: approved
            ? "All policy criteria met from FHIR record"
            : `Missing criteria: ${policyResult.missing.join("; ")}`,
          ambiguities: mergedContext.ambiguities,
        },
        patientId, policyVariant,
      });

      completeSession(sessionId, approved ? "approved" : "denied");

      return {
        summary: {
          patientId,
          policyVariant,
          policyResult,
          approved,
          bundleId: packetResult.bundle.id,
          auditSessionId: sessionId,
          dataSources: noteExtractionResult
            ? { fhir: true, aiNoteExtraction: true, mergedFields: mergedContext.sources }
            : { fhir: true, aiNoteExtraction: false },
          ambiguities: mergedContext.ambiguities,
        },
        noteExtraction: noteExtractionResult ? {
          extracted: noteExtractionResult.extracted,
          model: noteExtractionResult.model,
          durationMs: noteExtractionResult.durationMs,
        } : null,
        medrec: medrecResult,
        evidence: evidenceResult,
        policy: policyResult,
        packet: packetResult,
      };
    }

    case "alice_extract_clinical_note": {
      if (!args.noteText) throw new Error("noteText is required");
      const result = await extractClinicalNote(args.noteText);

      // Optionally store extraction as a FHIR DocumentReference for audit
      if (args.patientId) {
        store.create({
          resourceType: "DocumentReference",
          status: "current",
          type: { text: "Clinical Note AI Extraction" },
          subject: { reference: `Patient/${args.patientId}` },
          date: new Date().toISOString(),
          content: [{
            attachment: {
              contentType: "application/json",
              title: "AI-extracted prior auth criteria",
              data: btoa(unescape(encodeURIComponent(JSON.stringify(result.extracted)))),
            }
          }],
          context: {
            event: [{ text: "prior-authorization-extraction" }],
          },
          extension: [{
            url: "https://alice.promptopinion.ai/extraction-metadata",
            valueString: JSON.stringify({
              model: result.model,
              durationMs: result.durationMs,
              noteQuality: result.extracted.noteQuality,
            })
          }]
        });
      }

      return {
        extraction: result.extracted,
        metadata: {
          model: result.model,
          durationMs: result.durationMs,
          patientId: args.patientId ?? null,
        },
        summary: {
          hasT2D: result.extracted.hasT2D,
          a1cValue: result.extracted.a1cValue,
          hasMetforminTrial: result.extracted.hasMetforminTrial,
          hasMetforminIntolerance: result.extracted.hasMetforminIntolerance,
          ambiguityCount: result.extracted.ambiguities.length,
          ambiguities: result.extracted.ambiguities,
          noteQuality: result.extracted.noteQuality,
        }
      };
    }

    case "alice_smart_search": {
      const query = args.query ?? "";
      const max = args.maxResults ?? 5;

      let patients;
      if (args.diabetesOnly) {
        patients = await searchDiabetesPatients(max);
      } else {
        patients = await searchSmartPatients(query, max);
      }

      return {
        source: "SMART Health IT — r4.smarthealthit.org",
        query,
        resultsFound: patients.length,
        patients: patients.map(p => ({
          id: p.id,
          name: p.name,
          birthDate: p.birthDate,
          gender: p.gender,
          importHint: `Call alice_smart_import with smartPatientId: "${p.id}" to import this patient`,
        })),
      };
    }

    case "alice_smart_import": {
      // Register the SMART patient's external ID as an alias so audit trail works
      if (args.patientId) {
        // Will be linked to internal ID after import — pre-register now
        registerIdAliases(args.patientId);
      }
      if (!args.smartPatientId) throw new Error("smartPatientId is required");

      // Explicitly reject synthetic local patient IDs
      if (LOCAL_SYNTHETIC_IDS.has(args.smartPatientId)) {
        throw new Error(
          `Patient ID "${args.smartPatientId}" is a local synthetic patient, not a SMART Health IT record. ` +
          `Use alice_smart_search to find a real patient from r4.smarthealthit.org first.`
        );
      }

      const result = await importPatientFromSmart(
        args.smartPatientId,
        store,
        { forceRefresh: args.forceRefresh ?? false }
      );

      return {
        ...result,
        nextStep: result.priorAuthRelevance.suitableForGlp1PriorAuth
          ? `Patient imported. Call alice_run_full_prior_auth with patientId: "${result.patientId}" to run the prior auth pipeline.`
          : `Patient imported but may not be suitable for GLP-1 prior auth. Review priorAuthRelevance notes above.`,
      };
    }

    case "alice_list_patients": {
      // Ensure at least Bernard is seeded so the list isn't empty
      if (store.search("Patient", {}).length === 0) {
        seedSynthetic(store, { scenario: "complete" });
      }
      const patients = store.listPatients();
      return {
        totalPatients: patients.length,
        patients: patients.map((p: any) => {
          const nameObj = p.name?.[0];
          const name = nameObj
            ? [nameObj.prefix?.[0], nameObj.given?.[0], nameObj.family].filter(Boolean).join(" ")
            : "Unknown";
          return {
            id: p.id,
            name,
            birthDate: p.birthDate ?? "unknown",
            gender: p.gender ?? "unknown",
            source: p.id?.startsWith("patient-") || p.id?.includes("79f8fd18")
              ? "synthetic (ALICE)"
              : "SMART Health IT",
          };
        }),
      };
    }

    case "alice_detect_medication": {
      const rawDetectId = args.patientId ?? args.patient_id ?? LEGACY_PATIENT_ID;
      const patientId = seedForPatient(
        store,
        rawDetectId,
        args.patientName ?? args.patient_name,
        args.dob ?? args.birthDate
      );

      const profile = getClinicalProfile(store, patientId);
      const { hasT1D, hasT2D, hasRA, hasDKA, a1cValue, das28Value } = profile;

      let recommended: string;
      let policyVariant: string;
      let rationale: string;

      if (hasRA && !hasT1D && !hasT2D) {
        recommended = "adalimumab";
        policyVariant = "adalimumab-standard";
        rationale = `Rheumatoid arthritis detected. DAS28: ${das28Value ?? "not found"}. Recommended prior auth: Adalimumab.`;
      } else if (hasT1D) {
        recommended = "insulin";
        policyVariant = "insulin-standard";
        rationale = `Type 1 diabetes detected. Basal insulin prior auth is the best fit for this patient.`;
      } else if (hasDKA || (hasT2D && a1cValue !== null && a1cValue >= 9.0)) {
        recommended = "insulin";
        policyVariant = "insulin-standard";
        rationale = hasDKA
          ? `Recent DKA/urgent diabetic instability detected. Basal insulin prior auth recommended.`
          : `T2D detected with HbA1c ${a1cValue}% (>= 9.0). Poor control — basal insulin prior auth recommended.`;
      } else if (hasT2D) {
        recommended = "semaglutide";
        policyVariant = "standard";
        rationale = `T2D detected with HbA1c ${a1cValue ?? "unknown"}%. GLP-1/Semaglutide prior auth recommended.`;
      } else {
        recommended = "unknown";
        policyVariant = "standard";
        rationale = "No qualifying condition detected for automated medication selection.";
      }

      return {
        patientId,
        detected: { hasT1D, hasT2D, hasRA, hasDKA, a1cValue, das28Value },
        recommendation: { medication: recommended, policyVariant, rationale },
        availableTools: {
          glp1: "alice_run_full_prior_auth",
          insulin: "alice_run_prior_auth_insulin",
          adalimumab: "alice_run_prior_auth_adalimumab",
        },
      };
    }

    case "alice_run_prior_auth_insulin": {
      const rawInsulinId = args.patientId ?? LEGACY_PATIENT_ID;
      const patientId = seedForPatient(store, rawInsulinId);
      const policyVariant = args.policyVariant ?? "insulin-standard";
      const insulinSessionId = getOrStartSession(patientId, "Basal Insulin");
      appendEvent(insulinSessionId, {
        type: "tool_called", agent: "ALICE", action: "alice_run_prior_auth_insulin",
        description: "Basal Insulin prior authorization pipeline initiated",
        dataSources: ["fhir-local"], resourcesCreated: [], resourcesRead: [],
        patientId, policyVariant,
      });

      const profile = getClinicalProfile(store, patientId);
      const {
        hasT1D,
        hasT2D,
        hasDKA,
        a1cValue,
        hasMetforminTrial,
        hasMetforminIntolerance,
      } = profile;

      const policyResult = checkPolicy({
        hasT2D, a1cValue, hasMetforminTrial, hasMetforminIntolerance, policyVariant,
      });

      const insulinThreshold = policyVariant === "insulin-strict" ? 10.0 : 9.0;
      const urgentOrT1DApproved =
        (hasT1D || hasDKA) &&
        typeof a1cValue === "number" &&
        a1cValue >= insulinThreshold;

      const insulinApproved = urgentOrT1DApproved || policyResult.missing.length === 0;
      appendEvent(insulinSessionId, {
        type: "ai_decision", agent: "ALICE", action: "policy_check",
        description: `Insulin policy evaluation: ${insulinApproved ? "APPROVED" : "DENIED"} — ${policyResult.policyName}`,
        dataSources: ["ai-policy-check", "fhir-local"],
        resourcesCreated: [],
        resourcesRead: [
          { resourceType: "Condition", id: `condition-t2d-${patientId}` },
          { resourceType: "Observation", id: `obs-a1c-${patientId}` },
        ],
        aiDecision: {
          decision: insulinApproved ? "APPROVED" : "DENIED",
          confidence: "high",
          reasoning: insulinApproved
            ? (
                hasT1D
                  ? "Type 1 diabetes detected with elevated HbA1c; insulin prior auth approved."
                  : hasDKA
                    ? "Recent DKA/urgent diabetic instability detected with elevated HbA1c; insulin prior auth approved."
                    : "All insulin policy criteria met"
              )
            : `Missing: ${policyResult.missing.join("; ")}`,
        },
        patientId, policyVariant,
      });
      completeSession(insulinSessionId, insulinApproved ? "approved" : "denied");

      return {
        summary: {
          patientId,
          medication: "Basal Insulin",
          policyVariant,
          policyResult,
          approved: insulinApproved,
          a1cValue,
          threshold: policyVariant === "insulin-strict" ? 10.0 : 9.0,
          auditSessionId: insulinSessionId,
          note: !insulinApproved
            ? `DENIED — HbA1c (${a1cValue}%) does not meet insulin threshold or clinical criteria are incomplete. ARIA appeal recommended.`
            : hasT1D
              ? "APPROVED — Type 1 diabetes workflow"
              : hasDKA
                ? "APPROVED — expedited DKA workflow"
                : "APPROVED",
        },
        policy: policyResult,
      };
    }

    case "alice_run_prior_auth_adalimumab": {
      // Map Prompt Opinion UUID to local RA patient ID
      const rawId = args.patientId ?? RA_PATIENT_ID;
      const patientId = (rawId === PO_RA_PATIENT_ID) ? PO_RA_PATIENT_ID : RA_PATIENT_ID;
      const policyVariant = args.policyVariant ?? "adalimumab-standard";
      seedRA(store);
      const adaSessionId = getOrStartSession(patientId, "Adalimumab (Humira)");
      appendEvent(adaSessionId, {
        type: "tool_called", agent: "ALICE", action: "alice_run_prior_auth_adalimumab",
        description: "Adalimumab (Humira) prior authorization pipeline initiated for Rheumatoid Arthritis",
        dataSources: ["fhir-local"], resourcesCreated: [], resourcesRead: [],
        patientId, policyVariant,
      });

      const conditions = store.search("Condition", { subject: patientId });
      const observations = store.search("Observation", { subject: patientId });
      const statements = store.search("MedicationStatement", { subject: patientId });

      const hasRA = conditions.some((c: any) =>
        JSON.stringify(c).toLowerCase().includes("rheumatoid") ||
        JSON.stringify(c).toLowerCase().includes("69896004")
      );
      const das28Obs = observations.find((o: any) =>
        JSON.stringify(o).toLowerCase().includes("das28")
      );
      const das28Value = das28Obs?.valueQuantity?.value ?? null;

      const hasMtxTrial = statements.some((s: any) =>
        JSON.stringify(s).toLowerCase().includes("methotrexate") && s.status === "stopped" &&
        s.effectivePeriod?.start
      );
      const hasMtxIntolerance = statements.some((s: any) =>
        JSON.stringify(s).toLowerCase().includes("methotrexate") && (
          JSON.stringify(s).toLowerCase().includes("hepatotox") ||
          JSON.stringify(s).toLowerCase().includes("intoler") ||
          JSON.stringify(s).toLowerCase().includes("elevated lft")
        )
      );
      const hasTwoDmards = statements.filter((s: any) =>
        (JSON.stringify(s).toLowerCase().includes("methotrexate") ||
         JSON.stringify(s).toLowerCase().includes("hydroxychloroquine") ||
         JSON.stringify(s).toLowerCase().includes("sulfasalazine")) &&
        s.status === "stopped"
      ).length >= 2;

      const policyResult = checkPolicy({
        hasRA, das28Value, hasMtxTrial, hasMtxIntolerance,
        hasTwoDmards, policyVariant,
      });

      // Compose a FHIR bundle for the RA prior auth
      const claim = store.create({
        resourceType: "Claim",
        status: "active",
        type: { coding: [{ code: "pharmacy" }] },
        patient: { reference: `Patient/${patientId}` },
        insurance: [{ sequence: 1, focal: true, coverage: { reference: `Coverage/${findCoverageId(store, patientId)}` } }],
        item: [{ sequence: 1, productOrService: { text: "Adalimumab 40mg/0.4mL injection (Humira)" } }],
      });

      const bundle = store.create({
        resourceType: "Bundle",
        type: "collection",
        entry: [
          { resource: { resourceType: "Patient", id: patientId } },
          { resource: claim },
          ...(das28Obs ? [{ resource: das28Obs }] : []),
          ...conditions.map((c: any) => ({ resource: c })),
        ],
      });

      const adaApproved = policyResult.missing.length === 0;
      appendEvent(adaSessionId, {
        type: "ai_decision", agent: "ALICE", action: "policy_check",
        description: `Adalimumab policy evaluation: ${adaApproved ? "APPROVED" : "DENIED"} — ${policyResult.policyName}`,
        dataSources: ["ai-policy-check", "fhir-local"],
        resourcesCreated: [
          { resourceType: "Claim", id: claim.id },
          { resourceType: "Bundle", id: bundle.id },
        ],
        resourcesRead: [
          { resourceType: "Condition", id: `condition-ra-${patientId}` },
          { resourceType: "Observation", id: `obs-das28-${patientId}` },
          { resourceType: "MedicationStatement", id: `medstmt-mtx-ehr-${patientId}` },
        ],
        aiDecision: {
          decision: adaApproved ? "APPROVED" : "DENIED",
          confidence: "high",
          reasoning: adaApproved
            ? `RA confirmed, DAS28 ${das28Value} meets threshold, MTX step therapy documented`
            : `Missing: ${policyResult.missing.join("; ")}`,
        },
        patientId, policyVariant,
      });
      completeSession(adaSessionId, adaApproved ? "approved" : "denied");

      return {
        summary: {
          patientId,
          patientName: "Dorothea Brooke",
          medication: "Adalimumab (Humira) 40mg",
          indication: "Rheumatoid Arthritis",
          policyVariant,
          policyResult,
          approved: adaApproved,
          das28Value,
          mtxTrial: hasMtxTrial,
          mtxIntolerance: hasMtxIntolerance,
          bundleId: bundle.id,
          claimId: claim.id,
          auditSessionId: adaSessionId,
        },
        policy: policyResult,
        clinicalEvidence: {
          raCondition: conditions.find((c: any) => JSON.stringify(c).toLowerCase().includes("rheumatoid"))?.id,
          das28ObsId: das28Obs?.id,
          mtxStatements: statements
            .filter((s: any) => JSON.stringify(s).toLowerCase().includes("methotrexate"))
            .map((s: any) => ({ id: s.id, status: s.status, note: s.note?.[0]?.text })),
        },
      };
    }

    case "aria_draft_appeal": {
      if (!args.patientId) throw new Error("patientId is required");

      // Normalize denialReasons — accept string, array, or missing (extract from policyResult)
      let denialReasons: string[] = [];
      if (Array.isArray(args.denialReasons)) {
        denialReasons = args.denialReasons;
      } else if (typeof args.denialReasons === "string") {
        denialReasons = [args.denialReasons];
      } else if (args.missingCriteria) {
        // fallback: some models pass as missingCriteria
        denialReasons = Array.isArray(args.missingCriteria)
          ? args.missingCriteria
          : [String(args.missingCriteria)];
      } else if (args.missing) {
        denialReasons = Array.isArray(args.missing)
          ? args.missing
          : [String(args.missing)];
      }

      if (!denialReasons.length) {
        denialReasons = ["Prior authorization criteria not fully met — see clinical record for details"];
      }

      // Build appeal context from FHIR store
      const appealContext = buildAppealContext(
        store,
        args.patientId,
        denialReasons,
        args.policyVariant ?? args.policy_variant ?? "standard",
        args.claimId ?? args.claim_id,
        args.claimResponseId ?? args.claim_response_id
      );

      // Add note extraction summary if provided
      if (args.noteExtractionSummary) {
        appealContext.noteExtractionSummary = args.noteExtractionSummary;
      }

      // Record ARIA handoff in audit trail
      const existingSession = getOrStartSession(args.patientId, "Appeal");
      appendEvent(existingSession, {
        type: "agent_handoff", agent: "ARIA", action: "appeal_drafted",
        description: `ARIA drafted clinical appeal addressing ${denialReasons.length} denial reason(s)`,
        dataSources: ["fhir-local", "ai-appeal"],
        resourcesCreated: [], resourcesRead: [],
        handoff: { from: "ALICE", to: "ARIA", reason: "Prior authorization denied", context: { denialReasons } },
        aiDecision: {
          decision: "APPEAL_DRAFTED",
          confidence: "high",
          reasoning: `Appeal addresses: ${denialReasons.join("; ")}`,
        },
        patientId: args.patientId,
      });
      completeSession(existingSession, "appealed");

      // Register a placeholder DocumentReference so the appeal has a FHIR ID
      const appealDoc = store.create({
        resourceType: "DocumentReference",
        status: "current",
        type: { text: "Prior Authorization Appeal Letter" },
        subject: { reference: `Patient/${args.patientId}` },
        date: new Date().toISOString(),
        description: `Appeal — ${denialReasons.join("; ")}`,
      });

      // Return full structured context for ARIA to write the letter herself
      // No nested LLM call — ARIA IS the LLM and will draft the letter from this data
      return {
        instruction: "ARIA: Use the clinical context below to write the appeal letter yourself. Do NOT call another tool — draft the letter directly in your response.",
        appealDocumentId: appealDoc.id,
        patientId: args.patientId,
        policyVariant: appealContext.policyVariant,
        denialReasons,
        clinicalEvidence: {
          t2dDiagnosis: appealContext.t2dDiagnosis
            ? { id: appealContext.t2dDiagnosis.id, text: appealContext.t2dDiagnosis.code?.text ?? "Type 2 Diabetes Mellitus" }
            : null,
          a1cObservation: appealContext.a1cObservation
            ? { id: appealContext.a1cObservation.id, value: appealContext.a1cObservation.valueQuantity?.value, date: appealContext.a1cObservation.effectiveDateTime }
            : null,
          metforminHistory: (appealContext.metforminHistory ?? []).map((m: any) => ({
            id: m.id,
            status: m.status,
            note: m.note?.[0]?.text ?? null,
          })),
          bpmhSummary: appealContext.bpmhSummary ?? null,
          noteExtractionSummary: appealContext.noteExtractionSummary ?? null,
        },
        letterGuidance: {
          format: "Formal appeal letter, 3-4 paragraphs, addressed to Medical Director",
          mustAddress: denialReasons,
          mustCite: ["ADA Standards of Medical Care in Diabetes", "FHIR resource IDs above"],
          subject: `Re: Appeal of Prior Authorization Denial — Semaglutide (GLP-1) for Type 2 Diabetes`,
          opening: "Dear Medical Director,",
          closing: "Respectfully submitted,\nARIA — Appeal & Rebuttal Intelligence Agent\non behalf of the treating clinician",
        },
      };
    }

    case "alice_get_audit_trail": {
      if (!args.patientId) throw new Error("patientId is required");

      const trail = args.sessionId
        ? getTrail(args.sessionId)
        : getLatestTrailForPatient(args.patientId);

      if (!trail) {
        return {
          found: false,
          message: "No audit trail found for this patient. Run a prior authorization first.",
          patientId: args.patientId,
        };
      }

      const format = args.format ?? "full";

      const allForPatient = getAllTrailsForPatient(args.patientId);

      if (format === "summary") {
        return {
          found: true,
          sessionId: trail.sessionId,
          summary: trail.summary,
          startedAt: trail.startedAt,
          completedAt: trail.completedAt,
          finalDecision: trail.finalDecision,
          totalSessions: allForPatient.length,
        };
      }

      if (format === "timeline") {
        return {
          found: true,
          sessionId: trail.sessionId,
          finalDecision: trail.finalDecision,
          timeline: trail.events.map(e => ({
            seq: e.sequenceNumber,
            time: e.timestamp,
            agent: e.agent,
            action: e.action,
            description: e.description,
            dataSources: e.dataSources,
            resourcesCreated: e.resourcesCreated,
            aiDecision: e.aiDecision ?? null,
            handoff: e.handoff ?? null,
          })),
          summary: trail.summary,
        };
      }

      // full
      return { found: true, trail };
    }

    case "aria_get_appeal_status": {
      if (!args.patientId) throw new Error("patientId is required");

      const appealDocs = store.search("DocumentReference", { subject: args.patientId })
        .filter((d: any) => d.type?.text === "Prior Authorization Appeal Letter");

      return {
        patientId: args.patientId,
        appealsFound: appealDocs.length,
        appeals: appealDocs.map((d: any) => ({
          id: d.id,
          date: d.date,
          subject: d.description,
          urgencyLevel: (() => {
            try {
              return JSON.parse(d.extension?.[0]?.valueString ?? "{}").urgencyLevel;
            } catch { return "unknown"; }
          })(),
        })),
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC helpers ──────────────────────────────────────────────────────────

function rpcOk(id: any, result: any) {
  return { jsonrpc: "2.0", id, result };
}

function rpcErr(id: any, code: number, message: string, data?: any) {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } };
}

// ── Main handler ──────────────────────────────────────────────────────────────

// Seed all known patients into the store on first MCP request
let _allPatientsSeed = false;
function ensureAllPatients(store: FhirStore) {
  if (_allPatientsSeed) return;
  _allPatientsSeed = true;
  // Seed each patient under their own ID without clearing — additive seeding
  seedSynthetic(store, { scenario: "complete" });
  seedRA(store);
  seedComorbid(store);
  seedIncomplete(store);
  seedExpired(store);
  seedPaediatric(store);
  seedUrgent(store);
  console.log("[ALICE] All 7 patients seeded into FHIR store");
}

export function createMcpHandler(store: FhirStore) {
  return async function mcpHandler(req: Request, res: Response) {
    // Ensure all synthetic patients are in the store before any tool runs
    ensureAllPatients(store);
    console.log("MCP request:", req.method, "headers:", JSON.stringify(Object.keys(req.headers)));

    const body = req.body;

    // Handle batch (array) or single request
    const requests: any[] = Array.isArray(body) ? body : [body];
    const responses: any[] = [];

    for (const rpc of requests) {
      const { id, method, params } = rpc ?? {};

      try {
        switch (method) {
          case "initialize":
            responses.push(
              rpcOk(id, {
                protocolVersion: "2025-03-26",
                capabilities: { tools: { listChanged: false } },
                serverInfo: {
                  name: "alice-prior-auth-mcp",
                  version: "1.0.0",
                  description:
                    "ALICE — AI-powered prior authorization pipeline using FHIR, MCP, and A2A",
                },
              })
            );
            break;

          case "tools/list":
            responses.push(rpcOk(id, { tools: TOOLS }));
            break;

          case "tools/call": {
            const toolName: string = params?.name;
            const toolArgs: Record<string, any> = params?.arguments ?? {};

            if (!toolName) {
              responses.push(rpcErr(id, -32602, "params.name is required"));
              break;
            }

            const knownTool = TOOLS.find((t) => t.name === toolName);
            if (!knownTool) {
              responses.push(rpcErr(id, -32602, `Unknown tool: ${toolName}`));
              break;
            }

            try {
              const result = await executeTool(store, toolName, toolArgs);
              responses.push(
                rpcOk(id, {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify(result, null, 2),
                    },
                  ],
                })
              );
            } catch (toolErr: any) {
              responses.push(
                rpcOk(id, {
                  content: [
                    {
                      type: "text",
                      text: `Error: ${toolErr.message ?? String(toolErr)}`,
                    },
                  ],
                  isError: true,
                })
              );
            }
            break;
          }

          case "notifications/initialized":
          case "ping":
            // Notifications are fire-and-forget; ping just returns pong
            if (id !== undefined && id !== null) {
              responses.push(rpcOk(id, {}));
            }
            break;

          default:
            responses.push(rpcErr(id, -32601, `Method not found: ${method}`));
        }
      } catch (err: any) {
        responses.push(rpcErr(id, -32603, "Internal error", err.message));
      }
    }

    // Return single object or array to match request shape
    res.setHeader("Content-Type", "application/json");
    res.json(Array.isArray(body) ? responses : responses[0]);
  };
}
