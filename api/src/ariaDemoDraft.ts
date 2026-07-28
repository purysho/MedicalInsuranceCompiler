// ── ARIA demo draft (no-model fallback) ──────────────────────────────────────
//
// Purpose: let anyone evaluate the full ARIA review flow — draft, citations,
// uncertainty flags, and the human-review gate — without an API key and
// without incurring model cost. This matters for handoff/evaluation: the
// operator who owns the deployment should never have to attach their own key
// just so a prospect can click "Draft appeal with ARIA".
//
// Safety rule: a demo draft is NOT model output and must never be mistaken for
// one. Every draft produced here is labelled in-band (a header line inside the
// letter text) AND out-of-band (`demo: true` on the API response, which the UI
// renders as a banner). The human-review gate is unchanged — a demo draft is
// still un-approvable without a clinician sign-off, exactly like a real one.

export interface AriaDemoContext {
  patientName?: string;
  requestedMedication?: string;
  payer?: string;
  evidence?: { source?: string; date?: string }[];
}

export interface AriaDemoResult {
  text: string;
  uncertaintyFlags: string[];
}

const DEMO_BANNER =
  "[SAMPLE DRAFT — generated without a language model. " +
  "This is fixture text for evaluating the review workflow, not clinical content. " +
  "Configure OPENAI_BASE_URL and OPENAI_API_KEY to enable real ARIA drafting.]";

/** True when ARIA should serve fixture drafts instead of calling a provider. */
export function isDemoMode(): boolean {
  if (process.env.ALICE_DEMO_MODE === "1") return true;
  return !process.env.OPENAI_BASE_URL;
}

/**
 * Build a deterministic, source-cited sample appeal letter from the case facts
 * the UI already has. Deterministic output keeps demos and tests stable.
 */
export function buildAriaDemoDraft(ctx: AriaDemoContext = {}): AriaDemoResult {
  const patient = ctx.patientName?.trim() || "the patient";
  const drug = ctx.requestedMedication?.trim() || "the requested medication";
  const payer = ctx.payer?.trim() || "the plan";
  const evidence = (ctx.evidence ?? []).filter(Boolean);

  // Cite by bracket index so the numbers line up with the citation chips the
  // UI builds from the same evidence array.
  const citedLines = evidence.map((e, i) => {
    const source = e.source?.trim() || `Evidence item ${i + 1}`;
    const date = e.date?.trim();
    return `  [${i + 1}] ${source}${date ? ` (${date})` : ""}`;
  });

  const firstCite = evidence.length > 0 ? "[1]" : "[see attached record]";
  const secondCite = evidence.length > 1 ? "[2]" : firstCite;

  const text = [
    DEMO_BANNER,
    "",
    `Re: Appeal of coverage denial — ${drug}`,
    `Patient: ${patient}`,
    `Plan: ${payer}`,
    "",
    "To the Medical Review Department:",
    "",
    `We are appealing the denial of coverage for ${drug} for ${patient}. The ` +
      "attached record documents that the plan's medical-necessity criteria are " +
      "met, and we ask that the denial be overturned.",
    "",
    `The clinical record establishes the diagnosis and the treatment history ` +
      `supporting this request ${firstCite}. Prior therapies documented in the ` +
      `chart were either not tolerated or did not produce an adequate response ` +
      `${secondCite}, which satisfies the step-therapy requirement cited in the ` +
      "denial notice.",
    "",
    `Continued denial would delay a therapy the treating clinician has ` +
      `determined to be medically necessary. We request review by a physician ` +
      "in the relevant specialty and a written determination within the " +
      "timeframe required by the plan's appeal policy.",
    "",
    "Evidence cited in this letter:",
    ...(citedLines.length > 0
      ? citedLines
      : ["  (No approved evidence was attached to this case.)"]),
    "",
    "Respectfully submitted,",
    "[Reviewing clinician — signature required before submission]",
  ].join("\n");

  const uncertaintyFlags = [
    "Sample draft: not produced by a language model. Configure a provider to enable real ARIA drafting.",
    "Every assertion above must be verified against the source record by the reviewing clinician.",
  ];

  if (evidence.length === 0) {
    uncertaintyFlags.push(
      "No approved evidence was supplied — the draft contains no verifiable citations."
    );
  }

  return { text, uncertaintyFlags };
}
