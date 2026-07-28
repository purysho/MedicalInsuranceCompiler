import React, { useId, useState } from "react";

export interface TooltipProps {
  label: string;
  children: React.ReactElement;
}

/** Tooltip shown on hover and keyboard focus, linked via aria-describedby. */
export function Tooltip({ label, children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="alc-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {React.cloneElement(children, { "aria-describedby": id })}
      <span role="tooltip" id={id} className="alc-tooltip__bubble" hidden={!open}>
        {label}
      </span>
    </span>
  );
}
