/**
 * appealAgent.ts
 *
 * ARIA — Appeal & Rebuttal Intelligence Agent
 *
 * When ALICE's prior authorization is denied, ARIA takes over.
 * She reads the denial reason, retrieves the clinical evidence from FHIR,
 * and uses Claude to draft a formal clinical appeal letter that:
 *   - Directly addresses each denial reason
 *   - Cites specific FHIR resources as evidence
 *   - References clinical guidelines (ADA Standards of Care)
 *   - Is formatted for immediate submission to the payer
 */

import { FhirStore } from "../fhirStore.js";

export type AppealContext = {
  patientId: string;
  claimId?: string;
  claimResponseId?: string;
  denialReasons: string[];
  policyVariant: string;
  // FHIR evidence to cite
  t2dDiagnosis?: any;
  a1cObservation?: any;
  metforminHistory?: any;
  bpmhSummary?: string;
  // Optional: note extraction context
  noteExtractionSummary?: string;
};

export type AppealDraft = {
  letterText: string;
  subject: string;
  addressedReasons: string[];
  citedEvidence: string[];
  recommendedNextSteps: string[];
  urgencyLevel: "routine" | "expedited" | "urgent";
  model: string;
  durationMs: number;
};

const APPEAL_SYSTEM_PROMPT = `You are ARIA, a clinical prior authorization appeal specialist with deep expertise in payer policy, clinical guidelines, and medical necessity documentation.

Your job is to draft formal, persuasive clinical appeal letters that get prior authorizations approved on reconsideration.

Your letters must:
1. Be professionally formatted for immediate submission to a payer
2. Directly address EACH denial reason with specific clinical counter-arguments
3. Cite the specific FHIR clinical evidence provided (by resource type and key values)
4. Reference relevant clinical guidelines — specifically the ADA Standards of Medical Care in Diabetes (current year) for GLP-1/semaglutide requests
5. Be factually accurate — never fabricate clinical data
6. Recommend urgency level based on clinical context

You must respond with a single valid JSON object and nothing else:
{
  "subject": "Re: Appeal of Prior Authorization Denial - [medication] for [condition]",
  "letterText": "Full formal letter text with proper salutation, body paragraphs, and closing. Use \\n for line breaks.",
  "addressedReasons": ["list of each denial reason and how it was addressed"],
  "citedEvidence": ["list of FHIR resources and clinical values cited in the letter"],
  "recommendedNextSteps": ["ordered list of next steps if appeal is rejected"],
  "urgencyLevel": "routine" | "expedited" | "urgent",
  "clinicalRationale": "brief summary of the core clinical argument"
}`;

export async function draftAppealLetter(
  context: AppealContext,
  apiKey?: string
): Promise<AppealDraft> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const start = Date.now();

  // Build the clinical context summary for Claude
  const clinicalContext = buildClinicalContext(context);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: APPEAL_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: clinicalContext,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as any;
  const rawResponse = data.content?.[0]?.text ?? "";
  const durationMs = Date.now() - start;

  let parsed: any;
  try {
    const clean = rawResponse
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Claude returned invalid JSON for appeal letter. Raw: ${rawResponse.slice(0, 500)}`);
  }

  return {
    letterText: parsed.letterText,
    subject: parsed.subject,
    addressedReasons: parsed.addressedReasons ?? [],
    citedEvidence: parsed.citedEvidence ?? [],
    recommendedNextSteps: parsed.recommendedNextSteps ?? [],
    urgencyLevel: parsed.urgencyLevel ?? "routine",
    model: data.model ?? "claude-sonnet-4-20250514",
    durationMs,
  };
}

function buildClinicalContext(context: AppealContext): string {
  const lines: string[] = [
    `PRIOR AUTHORIZATION APPEAL REQUEST`,
    `=====================================`,
    ``,
    `PATIENT ID: ${context.patientId}`,
    `CLAIM ID: ${context.claimId ?? "N/A"}`,
    `CLAIM RESPONSE ID: ${context.claimResponseId ?? "N/A"}`,
    `POLICY VARIANT: ${context.policyVariant}`,
    ``,
    `DENIAL REASONS (must address each one):`,
    ...context.denialReasons.map((r, i) => `  ${i + 1}. ${r}`),
    ``,
    `CLINICAL EVIDENCE AVAILABLE:`,
  ];

  if (context.t2dDiagnosis) {
    lines.push(`  - Type 2 Diabetes Diagnosis: ${JSON.stringify(context.t2dDiagnosis.code?.text ?? context.t2dDiagnosis)}`);
    lines.push(`    FHIR Resource: Condition/${context.t2dDiagnosis.id}`);
  }

  if (context.a1cObservation) {
    const val = context.a1cObservation.valueQuantity?.value;
    const date = context.a1cObservation.effectiveDateTime;
    lines.push(`  - HbA1c: ${val}% (${date})`);
    lines.push(`    FHIR Resource: Observation/${context.a1cObservation.id}`);
  }

  if (context.metforminHistory) {
    lines.push(`  - Metformin History: ${JSON.stringify(context.metforminHistory)}`);
  }

  if (context.bpmhSummary) {
    lines.push(`  - BPMH Summary: ${context.bpmhSummary}`);
  }

  if (context.noteExtractionSummary) {
    lines.push(`  - AI-Extracted Clinical Note Summary: ${context.noteExtractionSummary}`);
  }

  lines.push(``);
  lines.push(`MEDICATION REQUESTED: Semaglutide (GLP-1 receptor agonist)`);
  lines.push(`INDICATION: Type 2 Diabetes Mellitus with inadequate glycemic control`);
  lines.push(``);
  lines.push(`Please draft a formal appeal letter addressing all denial reasons using the clinical evidence above.`);
  lines.push(`Cite ADA Standards of Medical Care in Diabetes guidelines where relevant.`);

  return lines.join("\n");
}

/**
 * Build appeal context from FHIR store after a denial
 */
export function buildAppealContext(
  store: FhirStore,
  patientId: string,
  denialReasons: string[],
  policyVariant: string,
  claimId?: string,
  claimResponseId?: string
): AppealContext {
  const conditions = store.search("Condition", { subject: patientId });
  const observations = store.search("Observation", { subject: patientId });
  const statements = store.search("MedicationStatement", { subject: patientId });
  const lists = store.search("List", { subject: patientId });

  const t2dDiagnosis = conditions.find((c: any) =>
    JSON.stringify(c).toLowerCase().includes("type 2")
  );

  const a1cObservation = observations.find((o: any) =>
    JSON.stringify(o).toLowerCase().includes("a1c")
  );

  const metforminStatements = statements.filter((s: any) =>
    (s.medicationCodeableConcept?.text ?? "").toLowerCase().includes("metformin")
  );

  const bpmhList = lists.find((l: any) =>
    (l.title ?? "").toLowerCase().includes("bpmh") ||
    (l.title ?? "").toLowerCase().includes("reconcil")
  );

  return {
    patientId,
    claimId,
    claimResponseId,
    denialReasons,
    policyVariant,
    t2dDiagnosis,
    a1cObservation,
    metforminHistory: metforminStatements,
    bpmhSummary: bpmhList
      ? `${bpmhList.title} — ${bpmhList.entry?.length ?? 0} medications reconciled`
      : undefined,
  };
}
