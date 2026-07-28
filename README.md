# ALICE — medication-access workspace

**ALICE prepares the work. Your team makes the decision.**

ALICE is a human-reviewed medication-access workspace for clinic prior-authorization
and appeal teams. It assembles patient/payer evidence into a source-linked ledger,
maps it to payer criteria, highlights documentation gaps, composes reviewer-ready
packets, and preserves a complete, immutable audit trail. **ARIA** — *ALICE's
source-cited appeal drafting capability* — turns an approved evidence packet into an
editable appeal letter where every factual assertion links back to its source. ALICE
is decision support and administrative workflow software: it never makes an autonomous
coverage or clinical decision, and every ARIA draft carries a mandatory
"human review required before submission" label. Approval gates are load-bearing —
no packet export or submission handoff happens until the required reviewer signs off,
and submission stays external in V1.

## Stack

- **API:** Node ≥20, TypeScript, Express, in-memory FHIR R4 store, MCP (streamable
  HTTP), A2A bus, agent pipeline.
- **UI:** React + Vite + TypeScript, styled from a design-token set (no component
  library). WCAG AA throughout.
- **AI calls:** provider-agnostic through an OpenAI-compatible endpoint
  (`api/src/llm.ts`). No provider URL or model name is hardcoded.
- **Tests:** Vitest (both workspaces); axe-core accessibility checks in the UI.

## Install & run

```bash
npm install
npm run build     # ui build → copied to api/public → api build
npm start         # serves the full app on PORT (default 8787)
```

Then open <http://localhost:8787>. The legacy operations dashboard remains at
`/dashboard`; the marketing site is at `/marketing/`.

## Environment

Copy `.env.example` to `.env` and configure the OpenAI-compatible LLM endpoint:

| Variable          | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `OPENAI_BASE_URL` | Base URL of your OpenAI-compatible endpoint. Unset → ARIA demo mode.    |
| `OPENAI_API_KEY`  | API key forwarded to that endpoint (any placeholder for local dev).     |
| `ALICE_MODEL`     | Optional model id. Unset → `auto` (never a hardcoded provider model).   |
| `ALICE_DEMO_MODE` | Set to `1` to force ARIA demo mode even when a provider is configured.  |
| `PORT`            | Server port (default `8787`).                                           |

The adapter is provider-agnostic — any OpenAI-compatible endpoint works
(OpenAI, Google Gemini's OpenAI-compat URL, Groq, OpenRouter, a self-hosted
gateway). No provider URL or model name is hardcoded.

### ARIA demo mode (no API key required)

If `OPENAI_BASE_URL` is not set, ARIA serves a **labelled sample draft** built
from the case's own facts instead of failing. This exists so the review
workflow can be evaluated end-to-end — draft, citations, uncertainty flags,
and the clinician approval gate — with **no API key and no model cost**.

A sample draft is never presented as model output:

- the letter body opens with a `[SAMPLE DRAFT — generated without a language
  model…]` header,
- the API response carries `demo: true`,
- the UI renders an explicit "Sample draft" notice in the ARIA panel, and
- two uncertainty flags are always attached.

The human-review gate is **unchanged** in demo mode — a sample draft is just as
un-approvable without clinician sign-off as a real one.

Set `OPENAI_BASE_URL` + `OPENAI_API_KEY` to switch to real drafting. Nothing
else changes.

## Tests

```bash
npm test --workspace api    # adapter, provenance, cases
npm test --workspace ui     # primitives, clinical, pages, scenarios, axe a11y
```

## De-identified pilot

Run first on **synthetic / de-identified** cases only. The seed data is synthetic
(`seedSynthetic` and friends). No patient data leaves the local environment, and no
external call carries raw PHI — the only outbound LLM egress is the operator-configured
`OPENAI_BASE_URL`. A controlled path to a live-PHI pilot (tenant isolation, access
controls, encryption at rest, audit logs, BAA-ready vendor posture) requires
infrastructure review beyond this repository — see the go-live checklist before
enabling any real-patient path.

## Safety model (do not remove)

- No code path autonomously approves, denies, or submits a PA to a payer.
- ARIA drafts only from approved evidence; uncited assertions are flagged, not shipped.
- The AriaPanel human-review banner is non-dismissable.
- Audit trail and provenance views are strictly read-only.

**What requires human review — who reviews, which gates block, and how it is
enforced — is defined in [HUMAN_REVIEW.md](./HUMAN_REVIEW.md).**
