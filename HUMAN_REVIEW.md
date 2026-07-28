# Human review in ALICE — what requires it, and who

**ALICE prepares the work. Your team makes the decision.** ALICE is decision-support
and administrative-workflow software. It never makes an autonomous coverage or
clinical decision, and it never submits to a payer. The points below define exactly
where a human must be in the loop, what each reviewer must do, and how the software
enforces it.

## Who may review

| Role | May do |
| --- | --- |
| Intake staff | Create cases, upload/attach source documents. |
| PA / appeals specialist | Assemble evidence, prepare packets, request approval, record outcomes. |
| **Clinician reviewer** | The only role that may **approve** a packet or an appeal draft. |
| Administrator | Manage roles and workspace settings. |

Only a designated **clinician reviewer** can satisfy an approval gate. Approval is
recorded with the reviewer's identity, a timestamp, and a comment (sign-off).

## What requires human review (gates — all load-bearing)

A human review is **required before** each of the following. None can be bypassed in
code, and doing so is a forbidden change:

1. **Packet export.** No packet may be exported until the required clinician reviewer
   has approved it. Until then the "Export packet" action is disabled and labelled
   *"Requires clinician approval."*
2. **Submission handoff.** No submission task may be created / assigned until the same
   approval is recorded. "Assign for submission" is disabled until approved.
3. **ARIA appeal-draft delivery.** Every ARIA draft carries a **non-dismissable**
   "⚠ Human review required before submission" banner. A draft cannot be treated as
   final until a clinician has reviewed and approved it.
4. **Any coverage/clinical output.** Payer-criteria results are only *labelled*
   (supported / missing / conflicting / needs clinician confirmation). ALICE never
   issues an authorization or denial — a human decides.

## What blocks approval until a human resolves it

The reviewer gate stays **blocked** (Approve disabled) in these states, which a human
must resolve first:

- **Incomplete evidence** — required evidence is missing (e.g. a needed HbA1c). ARIA
  drafting is also disabled: *"Evidence incomplete — resolve missing items before
  drafting."*
- **Conflicting evidence** — e.g. two conflicting diagnoses. The ReviewBlock shows
  *"Conflicting evidence requires clinician resolution before packet can be
  approved."*
- **Needs clinician confirmation** — a criterion the model cannot confirm on its own.
- **Uncited ARIA assertion** — if an ARIA draft paragraph has no matching
  `EvidenceItem`, it is flagged as an uncertainty and **"Approve draft" is disabled**
  until the uncited paragraph is removed or a citation is added.
- **Comment required** — when a review requires a comment, Approve stays disabled until
  the reviewer enters one.

## What stays external / read-only

- **Submission is external in V1.** ALICE produces an exportable package and an
  assigned human handoff; it does not transmit to payers.
- **Audit trail and provenance are read-only.** Once an outcome is recorded the case is
  closed: every action is disabled except viewing the audit trail. No UI exposes an
  edit/delete/hide control over audit events or provenance.

## How this is enforced (traceability)

- `ui/.../ReviewBlock.tsx` — approval gate; Approve disabled until comment/gate met;
  `readOnly` for closed cases.
- `ui/.../AriaPanel.tsx` — non-dismissable human-review banner; approve blocked on an
  uncited assertion.
- `ui/.../CaseWorkspace.tsx` — Export/Assign disabled until `approvalState === approved`;
  ARIA drafting appeals-only and evidence-ready-only; terminal read-only mode.
- `api/src/llm.ts` — LLM egress only through the configured OpenAI-compatible endpoint;
  no autonomous submission path exists.

These behaviors are covered by tests in `ui/src/pages/scenarios.test.tsx`,
`ui/src/components/clinical/clinical.test.tsx`, and `ui/src/pages/CaseWorkspace.test.tsx`.
