/**
 * noteExtractorAgent.ts
 *
 * Uses Claude (claude-sonnet-4-20250514) to extract structured prior
 * authorization criteria from unstructured clinical notes.
 *
 * This is the "AI Factor" — something rule-based software genuinely cannot do.
 * A clinician can paste any free-text note and ALICE will extract:
 *   - T2D diagnosis (present / absent / ambiguous)
 *   - HbA1c value and date
 *   - Metformin trial history
 *   - Metformin intolerance documentation
 *   - Any additional relevant findings
 *   - Confidence scores and ambiguity flags
 */

export type ExtractedCriteria = {
  // Core prior auth fields
  hasT2D: boolean | null;
  t2dEvidence: string;
  t2dConfidence: "high" | "medium" | "low" | "absent";

  a1cValue: number | null;
  a1cDate: string | null;
  a1cEvidence: string;
  a1cConfidence: "high" | "medium" | "low" | "absent";

  hasMetforminTrial: boolean | null;
  metforminDuration: string | null;
  metforminEvidence: string;

  hasMetforminIntolerance: boolean | null;
  intoleranceType: string | null;
  intoleranceEvidence: string;

  // Ambiguity flags — where a human should double-check
  ambiguities: string[];

  // Additional clinical context that may support the request
  additionalFindings: string[];

  // Overall extraction quality
  noteQuality: "complete" | "partial" | "poor";
  extractionNotes: string;

  // Raw source for audit trail
  sourceNotePreview: string;
};

export type NoteExtractionResult = {
  extracted: ExtractedCriteria;
  rawResponse: string;
  model: string;
  durationMs: number;
};

const SYSTEM_PROMPT = `You are a clinical prior authorization specialist. Your job is to read clinical notes and extract specific criteria needed to evaluate a prior authorization request for a GLP-1 receptor agonist (such as semaglutide/Ozempic) for Type 2 Diabetes Mellitus.

Extract ONLY what is explicitly stated or strongly implied in the note. Never invent or assume clinical facts. If something is ambiguous, flag it clearly.

You must respond with a single valid JSON object and nothing else — no preamble, no markdown, no explanation outside the JSON.

The JSON must match this exact structure:
{
  "hasT2D": true | false | null,
  "t2dEvidence": "exact quote or description from note, or 'not found'",
  "t2dConfidence": "high" | "medium" | "low" | "absent",

  "a1cValue": number | null,
  "a1cDate": "YYYY-MM-DD or partial date string or null",
  "a1cEvidence": "exact quote or description from note, or 'not found'",
  "a1cConfidence": "high" | "medium" | "low" | "absent",

  "hasMetforminTrial": true | false | null,
  "metforminDuration": "duration string e.g. '3 months' or null",
  "metforminEvidence": "exact quote or description from note, or 'not found'",

  "hasMetforminIntolerance": true | false | null,
  "intoleranceType": "description e.g. 'GI side effects, nausea' or null",
  "intoleranceEvidence": "exact quote or description from note, or 'not found'",

  "ambiguities": ["list of things that were unclear or could be interpreted multiple ways"],
  "additionalFindings": ["list of other clinically relevant findings that support the prior auth request"],

  "noteQuality": "complete" | "partial" | "poor",
  "extractionNotes": "brief summary of what was found and any concerns about the note quality"
}

Confidence levels:
- "high": explicitly stated with clear clinical language
- "medium": implied or mentioned without full clinical context
- "low": suggested but very uncertain
- "absent": not mentioned or explicitly ruled out

null values mean "not mentioned in note" — different from false which means "explicitly not present".`;

export async function extractClinicalNote(
  noteText: string,
  apiKey?: string
): Promise<NoteExtractionResult> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it as a Render environment variable."
    );
  }

  const start = Date.now();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Please extract prior authorization criteria from the following clinical note:\n\n---\n${noteText}\n---`,
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

  // Parse JSON from response — strip any accidental markdown fences
  let extracted: ExtractedCriteria;
  try {
    const clean = rawResponse
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    extracted = JSON.parse(clean);
  } catch (parseErr) {
    throw new Error(
      `Claude returned invalid JSON. Raw response: ${rawResponse.slice(0, 500)}`
    );
  }

  // Add source preview for audit trail
  extracted.sourceNotePreview = noteText.slice(0, 200) + (noteText.length > 200 ? "..." : "");

  return {
    extracted,
    rawResponse,
    model: data.model ?? "claude-sonnet-4-20250514",
    durationMs,
  };
}

/**
 * Merge extracted note criteria with existing FHIR-derived context.
 * Note extraction takes precedence for fields where FHIR data is missing,
 * but FHIR structured data takes precedence where both are present
 * (structured data is more reliable).
 */
export function mergeWithFhirContext(
  fhirContext: {
    hasT2D: boolean;
    a1cValue: number | null;
    hasMetforminTrial: boolean;
    hasMetforminIntolerance: boolean;
  },
  extracted: ExtractedCriteria
): {
  hasT2D: boolean;
  a1cValue: number | null;
  hasMetforminTrial: boolean;
  hasMetforminIntolerance: boolean;
  sources: Record<string, "fhir" | "note" | "both">;
  ambiguities: string[];
} {
  const sources: Record<string, "fhir" | "note" | "both"> = {};

  // T2D: FHIR wins if present, note fills gap
  const hasT2D = fhirContext.hasT2D
    ? (sources.hasT2D = "fhir", true)
    : extracted.hasT2D === true
      ? (sources.hasT2D = "note", true)
      : (sources.hasT2D = "fhir", false);

  // A1c: FHIR wins if present
  const a1cValue = fhirContext.a1cValue !== null
    ? (sources.a1cValue = "fhir", fhirContext.a1cValue)
    : extracted.a1cValue !== null
      ? (sources.a1cValue = "note", extracted.a1cValue)
      : (sources.a1cValue = "fhir", null);

  // Metformin trial
  const hasMetforminTrial = fhirContext.hasMetforminTrial
    ? (sources.hasMetforminTrial = "fhir", true)
    : extracted.hasMetforminTrial === true
      ? (sources.hasMetforminTrial = "note", true)
      : (sources.hasMetforminTrial = "fhir", false);

  // Intolerance
  const hasMetforminIntolerance = fhirContext.hasMetforminIntolerance
    ? (sources.hasMetforminIntolerance = "fhir", true)
    : extracted.hasMetforminIntolerance === true
      ? (sources.hasMetforminIntolerance = "note", true)
      : (sources.hasMetforminIntolerance = "fhir", false);

  return {
    hasT2D,
    a1cValue,
    hasMetforminTrial,
    hasMetforminIntolerance,
    sources,
    ambiguities: extracted.ambiguities ?? [],
  };
}
