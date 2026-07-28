import React, { useState, useEffect } from "react";
import { Citation } from "../../types";
import { Button } from "../primitives";
import "./clinical.css";

export interface AriaPanelProps {
  draft: string;
  citations: Citation[];
  uncertaintyFlags: string[];
  /** When set, the draft is still generating; body shows a loading state. */
  loading?: boolean;
  /** When set, "Approve draft" is disabled and this reason is shown. Used e.g.
   * when a paragraph has no matching EvidenceItem (uncited assertion). */
  approveBlockedReason?: string;
  /** True when the draft is fixture text served because no model provider is
   * configured. Renders an explicit notice so a sample can never be mistaken
   * for model output. */
  isDemo?: boolean;
  onEdit?: (text: string) => void;
  onApprove?: () => void;
}

/**
 * ARIA draft panel — ALICE's source-cited appeal drafting capability.
 *
 * Invariants:
 *  - A non-dismissable "Human review required before submission" banner
 *    (--danger) is ALWAYS rendered. It cannot be hidden.
 *  - Every factual assertion is backed by a citation chip linking to its
 *    EvidenceItem.
 *  - The --aria token is used only on ARIA-specific chrome (badge, chips,
 *    panel border) — never as a general accent.
 */
export function AriaPanel({
  draft,
  citations,
  uncertaintyFlags,
  loading = false,
  approveBlockedReason,
  isDemo = false,
  onEdit,
  onApprove,
}: AriaPanelProps) {
  const [text, setText] = useState(draft);
  const approveDisabled = loading || !!approveBlockedReason;

  // The panel mounts while ARIA is still drafting (draft === ""), so the
  // initial useState value is empty. Sync when the draft actually arrives —
  // otherwise the editable textarea stays blank and the reviewer has nothing
  // to review. Reviewer edits are preserved because this only fires when the
  // incoming draft prop itself changes.
  useEffect(() => { setText(draft); }, [draft]);

  return (
    <section className="alc-aria" aria-label="ARIA appeal draft">
      <header className="alc-aria__head">
        <span className="alc-aria__badge">
          <span aria-hidden="true">◆</span> ARIA
        </span>
        <span className="alc-aria__titleblock">
          <span className="alc-aria__title">Appeal draft</span>
          <span className="alc-aria__subtitle">ALICE&rsquo;s source-cited appeal drafting capability</span>
        </span>
      </header>

      {/* Non-dismissable, non-hideable human-review banner. */}
      <div className="alc-aria__review-banner" role="alert">
        <span aria-hidden="true">⚠</span>
        <span>Human review required before submission</span>
      </div>

      {/* Sample-draft notice. Fixture text must never read as model output. */}
      {isDemo && (
        <div className="alc-aria__demo-banner" role="status">
          <span aria-hidden="true">◇</span>
          <span>
            <strong>Sample draft</strong> — no language model is configured, so this is
            fixture text for evaluating the review workflow. Set{" "}
            <code>OPENAI_BASE_URL</code> and <code>OPENAI_API_KEY</code> to enable real
            ARIA drafting.
          </span>
        </div>
      )}

      {loading ? (
        <div className="alc-aria__loading">
          <span className="alc-btn__spinner" aria-hidden="true" />
          <span>ARIA is drafting&hellip;</span>
        </div>
      ) : (
        <div className="alc-aria__body">
          <div>
            <label className="alc-field__label" htmlFor="aria-draft">Appeal draft (editable)</label>
            <textarea
              id="aria-draft"
              className="alc-textarea"
              style={{ minHeight: 200 }}
              value={text}
              onChange={(e) => { setText(e.target.value); onEdit?.(e.target.value); }}
            />
          </div>

          <div>
            <div className="alc-field__label">Source citations</div>
            {citations.length === 0 ? (
              <div className="alc-evrow__meta">No citations — every assertion must cite an EvidenceItem.</div>
            ) : (
              <div className="alc-aria__citations">
                {citations.map((c) => (
                  <a
                    key={c.id}
                    className="alc-aria__chip"
                    href={c.sourceUrl ?? `#evidence-${c.evidenceItemId}`}
                    title={`Evidence: ${c.evidenceItemId}`}
                  >
                    <span aria-hidden="true">¶</span> {c.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {uncertaintyFlags.length > 0 && (
            <div>
              <div className="alc-field__label">Uncertainty flags</div>
              <ul className="alc-aria__flags">
                {uncertaintyFlags.map((f, i) => (
                  <li key={i}><span aria-hidden="true">⚠ </span>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {approveBlockedReason && (
            <div className="alc-review__warn" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{approveBlockedReason}</span>
            </div>
          )}

          <div className="alc-aria__actions">
            <Button variant="primary" disabled={approveDisabled} onClick={() => onApprove?.()}>
              Approve draft
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
