import React, { useId, useRef, useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTabId?: string;
  "aria-label": string;
}

/**
 * Keyboard-navigable tabs (WAI-ARIA tabs pattern): ArrowLeft/Right move focus
 * between tabs, Home/End jump to ends, Enter/Space (native button) activate.
 */
export function Tabs({ tabs, defaultTabId, "aria-label": ariaLabel }: TabsProps) {
  const firstEnabled = tabs.find((t) => !t.disabled)?.id;
  const [active, setActive] = useState(defaultTabId ?? firstEnabled ?? tabs[0]?.id);
  const baseId = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const enabledIds = tabs.filter((t) => !t.disabled).map((t) => t.id);

  function focusTab(id: string) {
    setActive(id);
    refs.current[id]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, id: string) {
    const idx = enabledIds.indexOf(id);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusTab(enabledIds[(idx + 1) % enabledIds.length]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusTab(enabledIds[(idx - 1 + enabledIds.length) % enabledIds.length]);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(enabledIds[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(enabledIds[enabledIds.length - 1]);
    }
  }

  return (
    <div className="alc-tabs">
      <div className="alc-tabs__list" role="tablist" aria-label={ariaLabel}>
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[t.id] = el; }}
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className="alc-tab"
              disabled={t.disabled}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKeyDown(e, t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${baseId}-panel-${t.id}`}
          aria-labelledby={`${baseId}-tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          className="alc-tabs__panel"
        >
          {t.id === active && t.content}
        </div>
      ))}
    </div>
  );
}
