
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
  }
};

export function getPolicyDefinition(variant?: string): PolicyDefinition {
  return POLICY_LIBRARY[variant === "strict" ? "strict" : "standard"];
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
