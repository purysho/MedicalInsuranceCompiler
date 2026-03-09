/**
 * auditTrail.ts
 *
 * Immutable, append-only audit trail for every ALICE/ARIA action.
 * Records: tool calls, FHIR resources created/used, AI decisions,
 * data source attribution, and agent handoffs.
 *
 * Designed for regulatory compliance and clinical trust.
 * Every prior authorization decision is fully traceable.
 */

export type DataSource = "fhir-local" | "fhir-smart-health-it" | "ai-note-extraction" | "ai-policy-check" | "ai-appeal" | "synthetic-seed";

export type AuditEventType =
  | "tool_called"
  | "resource_created"
  | "resource_read"
  | "ai_decision"
  | "agent_handoff"
  | "pipeline_start"
  | "pipeline_complete"
  | "denial_issued"
  | "appeal_drafted"
  | "patient_imported";

export type AuditEvent = {
  id: string;
  timestamp: string;
  sequenceNumber: number;
  type: AuditEventType;
  agent: "ALICE" | "ARIA" | "SYSTEM";
  sessionId: string;

  // What happened
  action: string;
  description: string;

  // Data sources involved
  dataSources: DataSource[];

  // FHIR resources
  resourcesCreated: { resourceType: string; id: string }[];
  resourcesRead: { resourceType: string; id: string }[];

  // AI decision details (if applicable)
  aiDecision?: {
    model?: string;
    decision: string;
    confidence?: "high" | "medium" | "low";
    reasoning: string;
    ambiguities?: string[];
    durationMs?: number;
  };

  // Agent handoff details (if applicable)
  handoff?: {
    from: string;
    to: string;
    reason: string;
    context: Record<string, any>;
  };

  // Patient context
  patientId?: string;
  medicationClass?: string;
  policyVariant?: string;
};

export type AuditTrail = {
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  patientId?: string;
  medicationClass?: string;
  finalDecision?: "approved" | "denied" | "pending" | "appealed";
  events: AuditEvent[];
  summary: {
    totalEvents: number;
    agentsInvolved: string[];
    dataSourcesUsed: DataSource[];
    fhirResourcesCreated: number;
    fhirResourcesRead: number;
    aiDecisionsMade: number;
    appealDrafted: boolean;
    durationMs?: number;
  };
};

// In-memory store — keyed by sessionId, then patientId
const trails = new Map<string, AuditTrail>();
let globalSequence = 0;

function newId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Current active session per patient
const activeSession = new Map<string, string>();

export function startSession(patientId: string, medicationClass?: string): string {
  const sessionId = newSessionId();
  activeSession.set(patientId, sessionId);

  const trail: AuditTrail = {
    sessionId,
    startedAt: new Date().toISOString(),
    patientId,
    medicationClass,
    events: [],
    summary: {
      totalEvents: 0,
      agentsInvolved: [],
      dataSourcesUsed: [],
      fhirResourcesCreated: 0,
      fhirResourcesRead: 0,
      aiDecisionsMade: 0,
      appealDrafted: false,
    },
  };

  trails.set(sessionId, trail);

  appendEvent(sessionId, {
    type: "pipeline_start",
    agent: "SYSTEM",
    action: "pipeline_start",
    description: `Prior authorization pipeline started for ${medicationClass ?? "unknown medication"}`,
    dataSources: [],
    resourcesCreated: [],
    resourcesRead: [],
    patientId,
    medicationClass,
  });

  return sessionId;
}

export function getActiveSession(patientId: string): string | null {
  return activeSession.get(patientId) ?? null;
}

export function appendEvent(
  sessionId: string,
  event: Omit<AuditEvent, "id" | "timestamp" | "sequenceNumber" | "sessionId">
): AuditEvent {
  const trail = trails.get(sessionId);
  if (!trail) {
    // Create a new trail on the fly if session not found
    trails.set(sessionId, {
      sessionId,
      startedAt: new Date().toISOString(),
      events: [],
      summary: {
        totalEvents: 0, agentsInvolved: [], dataSourcesUsed: [],
        fhirResourcesCreated: 0, fhirResourcesRead: 0, aiDecisionsMade: 0, appealDrafted: false,
      },
    });
    return appendEvent(sessionId, event);
  }

  const full: AuditEvent = {
    ...event,
    id: newId(),
    timestamp: new Date().toISOString(),
    sequenceNumber: ++globalSequence,
    sessionId,
  };

  trail.events.push(full);

  // Update summary
  trail.summary.totalEvents++;
  if (!trail.summary.agentsInvolved.includes(event.agent)) {
    trail.summary.agentsInvolved.push(event.agent);
  }
  for (const ds of event.dataSources) {
    if (!trail.summary.dataSourcesUsed.includes(ds)) {
      trail.summary.dataSourcesUsed.push(ds);
    }
  }
  trail.summary.fhirResourcesCreated += event.resourcesCreated.length;
  trail.summary.fhirResourcesRead += event.resourcesRead.length;
  if (event.aiDecision) trail.summary.aiDecisionsMade++;
  if (event.type === "appeal_drafted") trail.summary.appealDrafted = true;

  return full;
}

export function completeSession(
  sessionId: string,
  decision: "approved" | "denied" | "appealed"
): void {
  const trail = trails.get(sessionId);
  if (!trail) return;

  trail.completedAt = new Date().toISOString();
  trail.finalDecision = decision;

  const startMs = new Date(trail.startedAt).getTime();
  trail.summary.durationMs = Date.now() - startMs;

  appendEvent(sessionId, {
    type: "pipeline_complete",
    agent: "SYSTEM",
    action: "pipeline_complete",
    description: `Pipeline completed — decision: ${decision.toUpperCase()}`,
    dataSources: [],
    resourcesCreated: [],
    resourcesRead: [],
    patientId: trail.patientId,
    medicationClass: trail.medicationClass,
  });
}

export function getTrail(sessionId: string): AuditTrail | null {
  return trails.get(sessionId) ?? null;
}

export function getLatestTrailForPatient(patientId: string): AuditTrail | null {
  const sessionId = activeSession.get(patientId);
  if (!sessionId) return null;
  return trails.get(sessionId) ?? null;
}

export function getAllTrails(): AuditTrail[] {
  return Array.from(trails.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}
