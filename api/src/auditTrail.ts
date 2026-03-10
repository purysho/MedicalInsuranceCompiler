/**
 * auditTrail.ts
 *
 * Immutable, append-only audit trail for every ALICE/ARIA action.
 * Records: tool calls, FHIR resources created/used, AI decisions,
 * data source attribution, and agent handoffs.
 *
 * Key design principles:
 * - Works for ANY patient ID — local, Prompt Opinion UUID, SMART Health IT ID
 * - Auto-creates sessions on first contact — no pipeline can be untracked
 * - ID alias map links all known IDs for the same patient
 * - getOrStartSession() is always safe to call — idempotent
 */

export type DataSource =
  | "fhir-local"
  | "fhir-smart-health-it"
  | "ai-note-extraction"
  | "ai-policy-check"
  | "ai-appeal"
  | "synthetic-seed"
  | "payer-system";

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
  action: string;
  description: string;
  dataSources: DataSource[];
  resourcesCreated: { resourceType: string; id: string }[];
  resourcesRead: { resourceType: string; id: string }[];
  aiDecision?: {
    model?: string;
    decision: string;
    confidence?: "high" | "medium" | "low";
    reasoning: string;
    ambiguities?: string[];
    durationMs?: number;
  };
  handoff?: {
    from: string;
    to: string;
    reason: string;
    context: Record<string, any>;
  };
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

// ── Storage ───────────────────────────────────────────────────────────────────
const trails = new Map<string, AuditTrail>();
let globalSequence = 0;

// aliasId -> sessionId  (all known IDs for a patient map to the same session)
const sessionByPatientId = new Map<string, string>();

// All known aliases for a patient, keyed by any alias
const aliasGroups = new Map<string, Set<string>>();

// ── ID alias management ───────────────────────────────────────────────────────

/**
 * Register that multiple IDs all refer to the same patient.
 * Call this whenever a new ID is discovered (import, PO context, etc.)
 * Safe to call repeatedly — merges existing groups.
 */
export function registerIdAliases(...ids: string[]): void {
  const filtered = ids.filter(Boolean);
  if (filtered.length < 2) return;

  // Merge all existing groups these IDs belong to
  const merged = new Set<string>(filtered);
  for (const id of filtered) {
    const existing = aliasGroups.get(id);
    if (existing) {
      for (const alias of existing) merged.add(alias);
    }
  }

  // Write merged group for all members
  for (const id of merged) {
    aliasGroups.set(id, merged);
  }

  // If any of these already had a session, propagate to all aliases
  let existingSession: string | undefined;
  for (const id of merged) {
    existingSession = sessionByPatientId.get(id);
    if (existingSession) break;
  }
  if (existingSession) {
    for (const id of merged) {
      sessionByPatientId.set(id, existingSession);
    }
  }
}

function allAliases(patientId: string): Set<string> {
  return aliasGroups.get(patientId) ?? new Set([patientId]);
}

// ── Session management ────────────────────────────────────────────────────────

function newId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFreshSession(patientId: string, medicationClass?: string): string {
  const sessionId = newSessionId();

  // Register under all known aliases
  for (const alias of allAliases(patientId)) {
    sessionByPatientId.set(alias, sessionId);
  }

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
  return sessionId;
}

/**
 * Always returns a valid session ID.
 * - If patient has an active (incomplete) session → returns it
 * - If patient's last session is complete → starts a new one
 * - If patient is unknown → creates a new session
 * Safe to call from any tool, in any order.
 */
export function getOrStartSession(patientId: string, medicationClass?: string): string {
  // Check all aliases for an existing session
  for (const alias of allAliases(patientId)) {
    const sessionId = sessionByPatientId.get(alias);
    if (sessionId) {
      const trail = trails.get(sessionId);
      if (trail && !trail.completedAt) return sessionId; // active session
    }
  }
  // No active session — create one
  return createFreshSession(patientId, medicationClass);
}

/** Explicit session start — always creates a fresh session */
export function startSession(patientId: string, medicationClass?: string): string {
  return createFreshSession(patientId, medicationClass);
}

export function getActiveSession(patientId: string): string | null {
  for (const alias of allAliases(patientId)) {
    const sessionId = sessionByPatientId.get(alias);
    if (sessionId) return sessionId;
  }
  return null;
}

// ── Event appending ───────────────────────────────────────────────────────────

export function appendEvent(
  sessionId: string,
  event: Omit<AuditEvent, "id" | "timestamp" | "sequenceNumber" | "sessionId">
): AuditEvent {
  // Auto-create trail if missing (defensive)
  if (!trails.has(sessionId)) {
    trails.set(sessionId, {
      sessionId,
      startedAt: new Date().toISOString(),
      patientId: event.patientId,
      medicationClass: event.medicationClass,
      events: [],
      summary: {
        totalEvents: 0, agentsInvolved: [], dataSourcesUsed: [],
        fhirResourcesCreated: 0, fhirResourcesRead: 0,
        aiDecisionsMade: 0, appealDrafted: false,
      },
    });
    // Register patient ID mapping
    if (event.patientId) {
      sessionByPatientId.set(event.patientId, sessionId);
    }
  }

  const trail = trails.get(sessionId)!;

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
  trail.summary.durationMs = Date.now() - new Date(trail.startedAt).getTime();

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

// ── Retrieval ─────────────────────────────────────────────────────────────────

export function getTrail(sessionId: string): AuditTrail | null {
  return trails.get(sessionId) ?? null;
}

export function getLatestTrailForPatient(patientId: string): AuditTrail | null {
  const aliases = allAliases(patientId);

  // Gather all trails that belong to this patient (any alias)
  const candidates = Array.from(trails.values()).filter(t =>
    t.patientId && aliases.has(t.patientId)
  );

  if (candidates.length === 0) return null;

  // Return most recent
  return candidates.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )[0];
}

export function getAllTrailsForPatient(patientId: string): AuditTrail[] {
  const aliases = allAliases(patientId);
  return Array.from(trails.values())
    .filter(t => t.patientId && aliases.has(t.patientId))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function getAllTrails(): AuditTrail[] {
  return Array.from(trails.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}
