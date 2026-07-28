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

export interface Breadcrumb {
  tile?: string;
  primary: string;
  secondary?: string;
}

export interface AppShellProps {
  activeNav: string;
  onNavigate: (id: string) => void;
  workspace?: string;
  /** Optional breadcrumb shown in the top bar (case id + context). */
  breadcrumb?: Breadcrumb;
  userName?: string;
  userRole?: string;
  children: React.ReactNode;
}

export function AppShell({
  activeNav,
  onNavigate,
  workspace = "Prior-auth workspace",
  breadcrumb,
  userName = "Dr. Reviewer",
  userRole = "Clinician reviewer",
  children,
}: AppShellProps) {
  return (
    <div className="alc-shell">
      <nav className="alc-sidebar" aria-label="Primary">
        <a
          className="alc-brand"
          href="#/cases"
          onClick={(e) => { e.preventDefault(); onNavigate("cases"); }}
          aria-label="ALICE — home"
        >
          <span className="alc-brand__mark" aria-hidden="true">A</span>
          <span className="alc-wordmark">ALICE</span>
        </a>
        <div className="alc-nav__section" aria-hidden="true">Workspace</div>
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
        <div className="alc-sidebar__foot">ALICE prepares the work.<br />Your team makes the decision.</div>
      </nav>

      <div className="alc-main">
        <header className="alc-topbar">
          {breadcrumb ? (
            <div className="alc-crumb">
              {breadcrumb.tile && <span className="alc-crumb__tile" aria-hidden="true">{breadcrumb.tile}</span>}
              <span className="alc-crumb__text">
                <span className="alc-crumb__primary">{breadcrumb.primary}</span>
                {breadcrumb.secondary && <span className="alc-crumb__secondary">{breadcrumb.secondary}</span>}
              </span>
            </div>
          ) : (
            <span className="alc-topbar__workspace">{workspace}</span>
          )}
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
