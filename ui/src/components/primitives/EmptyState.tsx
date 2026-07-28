import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  description?: string;
  action?: React.ReactNode;
}

/** Icon + heading + optional description + action slot. */
export function EmptyState({ icon, heading, description, action }: EmptyStateProps) {
  return (
    <div className="alc-empty">
      {icon && <div className="alc-empty__icon" aria-hidden="true">{icon}</div>}
      <div className="alc-empty__heading">{heading}</div>
      {description && <p style={{ margin: 0 }}>{description}</p>}
      {action && <div className="alc-empty__action">{action}</div>}
    </div>
  );
}
