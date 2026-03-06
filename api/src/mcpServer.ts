/**
 * MCP Streamable HTTP Transport
 * Spec: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http
 *
 * Single endpoint POST /mcp handles all JSON-RPC 2.0 messages.
 * Supports: initialize, tools/list, tools/call
 */

import { Request, Response } from "express";
import { FhirStore } from "./fhirStore.js";
import { seedSynthetic, PO_PATIENT_ID, LEGACY_PATIENT_ID } from "./seed.js";
import { checkPolicy } from "./policy.js";
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
          enum: ["standard", "strict"],
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
          enum: ["standard", "strict"],
          description: "Payer policy ruleset to use (default: standard)",
        },
      },
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
    case "alice_fhir_search":
      return store.search(args.resourceType, args.parameters ?? {});

    case "alice_fhir_read": {
      const resource = store.read(args.resourceType, args.id);
      if (!resource)
        throw new Error(`Resource ${args.resourceType}/${args.id} not found`);
      return resource;
    }

    case "alice_policy_check": {
      const patientId = args.patientId ?? "patient-001";
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
        coverageId: args.coverageId ?? "coverage-001",
        medicationRequestId: args.medicationRequestId,
        evidenceDocId: args.evidenceDocId,
        bpmhListId: args.bpmhListId,
      });
    }

    case "alice_run_full_prior_auth": {
      // Accept any patient ID format - map PO UUID to our seeded data
      const rawId = args.patientId ?? args.patient_id ?? LEGACY_PATIENT_ID;
      // Always seed on full_prior_auth to ensure data exists
      seedSynthetic(store, { scenario: "complete" });
      // Use the PO patient ID if provided, otherwise use legacy
      const patientId = rawId === PO_PATIENT_ID ? PO_PATIENT_ID : LEGACY_PATIENT_ID;
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
      const policyResult = checkPolicy({
        hasT2D,
        a1cValue,
        hasMetforminTrial,
        hasMetforminIntolerance,
        policyVariant,
      });

      // Step 5: Compose packet
      const packetResult = await runComposePacket(store, {
        patientId,
        coverageId: "coverage-001",
        medicationRequestId: medReq.id!,
        evidenceDocId,
        bpmhListId,
      });

      return {
        summary: {
          patientId,
          policyVariant,
          policyResult,
          approved: policyResult.missing.length === 0,
          bundleId: packetResult.bundle.id,
        },
        medrec: medrecResult,
        evidence: evidenceResult,
        policy: policyResult,
        packet: packetResult,
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

export function createMcpHandler(store: FhirStore) {
  return async function mcpHandler(req: Request, res: Response) {
    // Log all incoming MCP requests for debugging
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
