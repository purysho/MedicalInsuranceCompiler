import { FhirStore } from "./fhirStore.js";
import { checkPolicy } from "./policy.js";

export type McpLogEntry = {
  ts: string;
  tool: string;
  agent?: string;
  // Keep args small for UI display
  argsPreview: any;
};

const MCP_LOG: McpLogEntry[] = [];

function previewArgs(args: any) {
  if (!args || typeof args !== "object") return args;
  // Strip large payloads while keeping useful bits
  const clone: any = Array.isArray(args) ? args.slice(0, 3) : { ...args };
  if (clone.resource) {
    clone.resource = {
      resourceType: clone.resource.resourceType,
      id: clone.resource.id,
    };
  }
  if (clone.resourceReferences && Array.isArray(clone.resourceReferences)) {
    clone.resourceReferences = clone.resourceReferences.slice(0, 6);
  }
  if (clone.requestContext && typeof clone.requestContext === "object") {
    const rc = clone.requestContext;
    clone.requestContext = {
      hasT2D: rc.hasT2D,
      a1cValue: rc.a1cValue,
      hasMetforminTrial: rc.hasMetforminTrial,
      hasMetforminIntolerance: rc.hasMetforminIntolerance,
      policyVariant: rc.policyVariant,
    };
  }
  // remove internal meta
  delete clone._meta;
  return clone;
}

export function getMcpLog() {
  return MCP_LOG;
}

export function clearMcpLog() {
  MCP_LOG.length = 0;
}

export async function runTool(store: FhirStore, tool: string, args: any) {
  const agent = args?._meta?.agent;
  MCP_LOG.push({
    ts: new Date().toISOString(),
    tool,
    agent,
    argsPreview: previewArgs(args),
  });

  switch (tool) {
    case "fhir.search":
      return store.search(args.resourceType, args.parameters ?? {});
    case "fhir.read":
      return store.read(args.resourceType, args.id);
    case "fhir.create":
      return store.create(args.resource);
    case "fhir.update":
      return store.update(args.resourceType, args.id, args.resource);
    case "policy.check":
      return checkPolicy(args.requestContext);
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
