import React, { useState } from "react";
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
  onEdit,
  onApprove,
}: AriaPanelProps) {
  const [text, setText] = useState(draft);
  const approveDisabled = loading || !!approveBlockedReason;

  return (
    <section className="alc-aria" aria-label="ARIA appeal draft">
      <header className="alc-aria__head">
        <span className="alc-aria__badge">
          <span aria-hidden="true">◆</span> ARIA
        </span>
        <span className="alc-aria__subtitle">ALICE&rsquo;s source-cited appeal drafting capability</span>
      </header>

      {/* Non-dismissable, non-hideable human-review banner. */}
      <div className="alc-aria__review-banner" role="alert">
        <span aria-hidden="true">⚠</span>
        <span>Human review required before submission</span>
      </div>

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
