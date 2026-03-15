/**
 * appealAgent.ts
 *
 * Uses Claude to generate a real clinical appeal letter from structured
 * FHIR evidence. Letter is stored in the DocumentReference so the dashboard
 * can display it without relying on Prompt Opinion chat history.
 */

export interface AppealLetterInput {
  patientName: string;
  patientId: string;
  medication: string;
  denialReasons: string[];
  a1cValue: number | null;
  a1cDate: string | null;
  t2dDiagnosis: string | null;
  metforminHistory: Array<{ status: string; note: string | null }>;
  policyVariant: string;
  appealRound: number;
  counterObjections?: string[];
  noteExtractionSummary?: string | null;
}

export interface AppealLetterResult {
  letterText: string;
  subject: string;
  citations: string[];
  model: string;
  durationMs: number;
}

const APPEAL_SYSTEM = `You are ARIA — Appeal & Rebuttal Intelligence Agent. You write formal, persuasive clinical appeal letters on behalf of treating clinicians when prior authorization requests are denied by insurance payers.

Your letters are:
- Addressed to the Payer Medical Director
- 4-5 paragraphs, formal clinical tone
- Evidence-based: cite specific FHIR resource IDs, lab values, and clinical guidelines
- Always cite ADA Standards of Medical Care (current year), relevant clinical trials (SUSTAIN-6, LEADER, EMPA-REG for GLP-1/SGLT-2), and ADA/EASD consensus statements
- Close with: "Respectfully submitted,\nARIA — Appeal & Rebuttal Intelligence Agent\non behalf of the treating clinician"

For Round 2+ rebuttals, escalate urgency and directly address each payer counter-objection with literature.`;

export async function generateAppealLetter(
  input: AppealLetterInput,
  apiKey?: string
): Promise<AppealLetterResult> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const start = Date.now();

  const isRebuttal = input.appealRound > 1;
  const prompt = isRebuttal
    ? `Generate a Round ${input.appealRound} rebuttal appeal letter for the following case.

Patient: ${input.patientName} (FHIR ID: ${input.patientId})
Medication Requested: ${input.medication}
HbA1c: ${input.a1cValue ?? "not recorded"}% (${input.a1cDate ?? "date unknown"})
Diagnosis: ${input.t2dDiagnosis ?? "Type 2 Diabetes Mellitus"}
Prior Medication History: ${input.metforminHistory.map(m => `${m.status}${m.note ? ` — ${m.note}` : ""}`).join("; ") || "not documented"}
${input.noteExtractionSummary ? `Additional Clinical Context: ${input.noteExtractionSummary}` : ""}

Original Denial Reasons:
${input.denialReasons.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Payer Counter-Objections to Address in this Rebuttal:
${(input.counterObjections ?? []).map((r, i) => `${i + 1}. ${r}`).join("\n")}

Write a formal Round ${input.appealRound} rebuttal letter with escalating urgency. Directly address each counter-objection with specific clinical literature citations.`
    : `Generate a Round 1 clinical appeal letter for the following prior authorization denial.

Patient: ${input.patientName} (FHIR ID: ${input.patientId})
Medication Requested: ${input.medication}
HbA1c: ${input.a1cValue ?? "not recorded"}% (${input.a1cDate ?? "date unknown"})
Diagnosis: ${input.t2dDiagnosis ?? "Type 2 Diabetes Mellitus"}
Prior Medication History: ${input.metforminHistory.map(m => `${m.status}${m.note ? ` — ${m.note}` : ""}`).join("; ") || "not documented"}
${input.noteExtractionSummary ? `Additional Clinical Context: ${input.noteExtractionSummary}` : ""}

Denial Reasons to Address:
${input.denialReasons.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Write a formal appeal letter addressing each denial reason with clinical evidence and ADA guideline citations.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: APPEAL_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const letterText = data.content?.[0]?.text ?? "";

  // Extract citations mentioned in the letter
  const citationPatterns = [
    /ADA Standards[^.]+/g,
    /SUSTAIN-\d[^.]+/g,
    /LEADER[^.]+trial[^.]*/gi,
    /EMPA-REG[^.]+/g,
    /ADA\/EASD[^.]+/g,
  ];
  const citations: string[] = [];
  for (const pat of citationPatterns) {
    const matches = letterText.match(pat);
    if (matches) citations.push(...matches.map(m => m.trim().slice(0, 80)));
  }

  return {
    letterText,
    subject: `Re: Appeal of Prior Authorization Denial — ${input.medication}${isRebuttal ? ` (Round ${input.appealRound} Rebuttal)` : ""}`,
    citations: [...new Set(citations)],
    model: data.model ?? "claude-haiku-4-5-20251001",
    durationMs: Date.now() - start,
  };
}

// ── buildAppealContext (used by mcpServer to assemble FHIR evidence) ────────
export function buildAppealContext(
  store: any,
  patientId: string,
  denialReasons: string[],
  policyVariant: string,
  claimId?: string,
  claimResponseId?: string
) {
  const conditions = store.search("Condition", { subject: patientId });
  const observations = store.search("Observation", { subject: patientId });
  const statements = store.search("MedicationStatement", { subject: patientId });
  const lists = store.search("List", { subject: patientId });

  const t2dDiagnosis = conditions.find((c: any) =>
    JSON.stringify(c).toLowerCase().includes("type 2")
  ) ?? null;

  const a1cObservation = observations.find((o: any) =>
    JSON.stringify(o).toLowerCase().includes("a1c")
  ) ?? null;

  const metforminHistory = statements.filter((s: any) =>
    (s.medicationCodeableConcept?.text ?? "").toLowerCase().includes("metformin")
  );

  const bpmhList = lists.find((l: any) => l.title?.toLowerCase().includes("bpmh")) ?? null;
  const bpmhSummary = bpmhList
    ? `BPMH List ID: ${bpmhList.id}, ${(bpmhList.entry ?? []).length} medications`
    : null;

  return {
    patientId, denialReasons, policyVariant, claimId, claimResponseId,
    t2dDiagnosis, a1cObservation, metforminHistory, bpmhSummary,
    noteExtractionSummary: null,
  };
}

// legacy stub — not used but keeps import happy
export async function draftAppealLetter() { return null; }
