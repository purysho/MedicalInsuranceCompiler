
export type PolicyCriterion = {
  key: string;
  label: string;
  type: "condition" | "observation" | "medication";
  operator?: "exists" | ">=";
  threshold?: number;
  codeHint?: string;
};

export type PolicyDefinition = {
  id: string;
  version: string;
  name: string;
  summary: string;
  rules: PolicyCriterion[];
};

export const POLICY_LIBRARY: Record<string, PolicyDefinition> = {
  standard: {
    id: "glp1-t2d-standard",
    version: "2026.03.01",
    name: "Demo GLP-1 Policy (T2D) — Standard",
    summary: "Requires T2D diagnosis, HbA1c >= 7.0, and metformin trial or documented intolerance.",
    rules: [
      { key: "t2d", label: "Type 2 Diabetes diagnosis", type: "condition", operator: "exists", codeHint: "Type 2 diabetes mellitus" },
      { key: "a1c", label: "HbA1c ≥ 7.0", type: "observation", operator: ">=", threshold: 7.0, codeHint: "HbA1c" },
      { key: "step", label: "Metformin trial OR intolerance documented", type: "medication", operator: "exists", codeHint: "Metformin" }
    ]
  },
  strict: {
    id: "glp1-t2d-strict",
    version: "2026.03.15",
    name: "Demo GLP-1 Policy (T2D) — Strict",
    summary: "Same as standard, but with a tighter HbA1c threshold for approval.",
    rules: [
      { key: "t2d", label: "Type 2 Diabetes diagnosis", type: "condition", operator: "exists", codeHint: "Type 2 diabetes mellitus" },
      { key: "a1c", label: "HbA1c ≥ 8.0", type: "observation", operator: ">=", threshold: 8.0, codeHint: "HbA1c" },
      { key: "step", label: "Metformin trial OR intolerance documented", type: "medication", operator: "exists", codeHint: "Metformin" }
    ]
  },
  denied: {
    id: "glp1-t2d-strict-trial",
    version: "2026.03.15",
    name: "Demo GLP-1 Policy (T2D) — Strict Trial Required",
    summary: "Strictest variant: requires HbA1c ≥ 8.0 AND a documented 3-month metformin trial. Intolerance alone is insufficient — a trial duration must be on record. Designed to demonstrate denial + ARIA appeal workflow.",
    rules: [
      { key: "t2d", label: "Type 2 Diabetes diagnosis", type: "condition", operator: "exists", codeHint: "Type 2 diabetes mellitus" },
      { key: "a1c", label: "HbA1c ≥ 8.0", type: "observation", operator: ">=", threshold: 8.0, codeHint: "HbA1c" },
      { key: "step", label: "Metformin trial ≥ 3 months documented (intolerance alone insufficient)", type: "medication", operator: "exists", codeHint: "Metformin" }
    ]
  }
};

  // ── Insulin (Basal) ──────────────────────────────────────────────────────
  "insulin-standard": {
    id: "insulin-t2d-standard",
    version: "2026.03.01",
    name: "Basal Insulin Policy (T2D) — Standard",
    summary: "Requires T2D diagnosis, HbA1c >= 9.0 (poor control on orals), and documented failure on at least one oral hypoglycemic agent.",
    rules: [
      { key: "t2d", label: "Type 2 Diabetes diagnosis", type: "condition", operator: "exists", codeHint: "Type 2 diabetes mellitus" },
      { key: "a1c", label: "HbA1c >= 9.0 (poor control threshold for insulin)", type: "observation", operator: ">=", threshold: 9.0, codeHint: "HbA1c" },
      { key: "step", label: "Documented failure on at least one oral hypoglycemic agent (e.g. metformin)", type: "medication", operator: "exists", codeHint: "Metformin" }
    ]
  },
  "insulin-strict": {
    id: "insulin-t2d-strict",
    version: "2026.03.15",
    name: "Basal Insulin Policy (T2D) — Strict",
    summary: "HbA1c >= 10.0 (severe uncontrolled) plus failure on 2 or more oral agents.",
    rules: [
      { key: "t2d", label: "Type 2 Diabetes diagnosis", type: "condition", operator: "exists", codeHint: "Type 2 diabetes mellitus" },
      { key: "a1c", label: "HbA1c >= 10.0 (severe uncontrolled threshold)", type: "observation", operator: ">=", threshold: 10.0, codeHint: "HbA1c" },
      { key: "step", label: "Failure on 2 or more oral hypoglycemic agents documented", type: "medication", operator: "exists", codeHint: "Metformin" }
    ]
  },

  // ── Adalimumab / Humira (Rheumatoid Arthritis) ───────────────────────────
  "adalimumab-standard": {
    id: "adalimumab-ra-standard",
    version: "2026.03.01",
    name: "Adalimumab Policy (RA) — Standard",
    summary: "Requires RA diagnosis, DAS28 score > 3.2 (moderate-to-severe disease activity), and MTX trial >= 3 months or intolerance.",
    rules: [
      { key: "ra", label: "Rheumatoid Arthritis diagnosis", type: "condition", operator: "exists", codeHint: "Rheumatoid arthritis" },
      { key: "das28", label: "DAS28 score > 3.2 (moderate-to-severe disease activity)", type: "observation", operator: ">=", threshold: 3.2, codeHint: "DAS28" },
      { key: "step", label: "Methotrexate (MTX) trial >= 3 months OR documented intolerance", type: "medication", operator: "exists", codeHint: "Methotrexate" }
    ]
  },
  "adalimumab-strict": {
    id: "adalimumab-ra-strict",
    version: "2026.03.15",
    name: "Adalimumab Policy (RA) — Strict",
    summary: "DAS28 > 5.1 (high disease activity) AND failure on 2 or more DMARDs including MTX.",
    rules: [
      { key: "ra", label: "Rheumatoid Arthritis diagnosis", type: "condition", operator: "exists", codeHint: "Rheumatoid arthritis" },
      { key: "das28", label: "DAS28 > 5.1 (high disease activity)", type: "observation", operator: ">=", threshold: 5.1, codeHint: "DAS28" },
      { key: "step", label: "Failure on 2 or more DMARDs including MTX documented", type: "medication", operator: "exists", codeHint: "Methotrexate" }
    ]
  },
};

export function getPolicyDefinition(variant?: string): PolicyDefinition {
  return POLICY_LIBRARY[variant ?? "standard"] ?? POLICY_LIBRARY["standard"];
}

export function diffPolicies(fromVariant: string = "standard", toVariant: string = "strict") {
  const from = getPolicyDefinition(fromVariant);
  const to = getPolicyDefinition(toVariant);

  const rows = to.rules.map((rule, idx) => {
    const prior = from.rules[idx];
    const changed =
      !prior ||
      prior.label !== rule.label ||
      prior.threshold !== rule.threshold ||
      prior.operator !== rule.operator;

    return {
      key: rule.key,
      changed,
      from: prior ? { label: prior.label, threshold: prior.threshold ?? null, operator: prior.operator ?? null } : null,
      to: { label: rule.label, threshold: rule.threshold ?? null, operator: rule.operator ?? null }
    };
  });

  return { from, to, rows };
}
