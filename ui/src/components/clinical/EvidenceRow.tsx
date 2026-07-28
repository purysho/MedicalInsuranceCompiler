import React from "react";
import { Confidence, VerificationStatus, ReviewerState } from "../../types";
import "./clinical.css";

export interface EvidenceRowProps {
  source: string;
  date: string;
  confidence: Confidence;
  verificationStatus: VerificationStatus;
  reviewerState: ReviewerState;
  sourceUrl?: string;
  onFlag?: () => void;
}

const CONF_ICON: Record<Confidence, string> = { high: "▲", medium: "◆", low: "▽" };
const VERIFY_ICON: Record<VerificationStatus, string> = { verified: "✓", unverified: "•", disputed: "✕" };
const REVIEW_LABEL: Record<ReviewerState, string> = { unreviewed: "Unreviewed", accepted: "Accepted", flagged: "Flagged" };

/** Dense evidence-ledger row. Confidence and verification shown as text+icon
 * (never color alone). Direct link to the source document. */
export function EvidenceRow({
  source, date, confidence, verificationStatus, reviewerState, sourceUrl, onFlag,
}: EvidenceRowProps) {
  return (
    <div className="alc-evrow">
      <div className="alc-evrow__src">
        <span className="alc-evrow__src-name">{source}</span>
        <span className="alc-evrow__meta">{date} · Reviewer: {REVIEW_LABEL[reviewerState]}</span>
      </div>

      <span className="alc-evrow__chip" title={`Confidence: ${confidence}`}>
        <span aria-hidden="true">{CONF_ICON[confidence]}</span>
        <span>{confidence[0].toUpperCase() + confidence.slice(1)}</span>
      </span>

      <span className="alc-evrow__chip" title={`Verification: ${verificationStatus}`}>
        <span aria-hidden="true">{VERIFY_ICON[verificationStatus]}</span>
        <span>{verificationStatus[0].toUpperCase() + verificationStatus.slice(1)}</span>
      </span>

      <span>
        {sourceUrl ? (
          <a className="alc-evrow__link" href={sourceUrl} target="_blank" rel="noreferrer">
            View source
          </a>
        ) : (
          <span className="alc-evrow__meta">No source link</span>
        )}
        {onFlag && (
          <button type="button" className="alc-btn alc-btn--ghost alc-btn--sm" onClick={onFlag}>
            Flag for review
          </button>
        )}
      </span>
    </div>
  );
}
