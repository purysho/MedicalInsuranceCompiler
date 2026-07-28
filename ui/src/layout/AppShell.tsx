import React from "react";
import { Avatar } from "../components/primitives";
import "./shell.css";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

// ARIA is deliberately NOT a nav item — it appears only inside the case
// workspace. ALICE is the visible platform brand.
export const NAV_ITEMS: NavItem[] = [
  { id: "cases", label: "Cases", icon: "🗂" },
  { id: "tasks", label: "Tasks", icon: "☑" },
  { id: "evidence", label: "Evidence", icon: "🔍" },
  { id: "insights", label: "Insights", icon: "📊" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export interface AppShellProps {
  activeNav: string;
  onNavigate: (id: string) => void;
  workspace?: string;
  userName?: string;
  userRole?: string;
  children: React.ReactNode;
}

export function AppShell({
  activeNav,
  onNavigate,
  workspace = "Prior-auth workspace",
  userName = "Dr. Reviewer",
  userRole = "Clinician reviewer",
  children,
}: AppShellProps) {
  return (
    <div className="alc-shell">
      <nav className="alc-sidebar" aria-label="Primary">
        <a
          className="alc-wordmark"
          href="#/cases"
          onClick={(e) => { e.preventDefault(); onNavigate("cases"); }}
        >
          <span className="alc-wordmark__full">ALICE</span>
        </a>
        <ul className="alc-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="alc-nav__item"
                aria-current={activeNav === item.id ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
              >
                <span className="alc-nav__icon" aria-hidden="true">{item.icon}</span>
                <span className="alc-nav__label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="alc-main">
        <header className="alc-topbar">
          <span className="alc-topbar__workspace">{workspace}</span>
          <input
            className="alc-topbar__search"
            type="search"
            placeholder="Search cases, patients, evidence…"
            aria-label="Global search"
          />
          <span className="alc-topbar__spacer" />
          <button type="button" className="alc-iconbtn" aria-label="Notifications">
            <span aria-hidden="true">🔔</span>
          </button>
          <span className="alc-topbar__role" title={`${userName} — ${userRole}`}>
            <Avatar name={userName} size={24} />
            {userRole}
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}
