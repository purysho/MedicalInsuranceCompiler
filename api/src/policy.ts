import { getPolicyDefinition } from "./policies.js";

export type PolicyResult = {
  policyName: string;
  medicationClass: string;
  requires: { key: string; label: string }[];
  missing: string[];
  variant?: string;
  version?: string;
};

export function checkPolicy(ctx: any): PolicyResult {
  const variant = (ctx?.policyVariant ?? "standard") as string;
  const policy = getPolicyDefinition(variant);

  // Detect medication class from policy id
  const isInsulin = policy.id.startsWith("insulin");
  const isAdalimumab = policy.id.startsWith("adalimumab");
  const isGlp1 = !isInsulin && !isAdalimumab;

  const medicationClass = isInsulin ? "Basal Insulin"
    : isAdalimumab ? "Adalimumab (Humira)"
    : "Semaglutide (GLP-1)";

  const a1cRule = policy.rules.find((r) => r.key === "a1c");
  const das28Rule = policy.rules.find((r) => r.key === "das28");
  const threshold = a1cRule?.threshold ?? das28Rule?.threshold ?? 7.0;

  const requires = policy.rules.map((r) => ({ key: r.key, label: r.label }));
  const missing: string[] = [];

  // ── Condition check ──────────────────────────────────────────────────────
  if (isAdalimumab) {
    if (!ctx?.hasRA) missing.push("Missing Rheumatoid Arthritis diagnosis (Condition)");
  } else {
    if (!ctx?.hasT2D) missing.push("Missing T2D diagnosis (Condition)");
  }

  // ── Observation check (A1c or DAS28) ────────────────────────────────────
  const obsValue = isAdalimumab ? ctx?.das28Value : ctx?.a1cValue;
  const obsLabel = isAdalimumab ? "DAS28" : "HbA1c";

  if (typeof obsValue !== "number") {
    missing.push(`Missing ${obsLabel} value (Observation)`);
  } else if (obsValue < threshold) {
    missing.push(`${obsLabel} below threshold (${obsValue} < ${threshold})`);
  }

  // ── Step therapy check ───────────────────────────────────────────────────
  const isDeniedVariant = variant === "denied" || variant === "insulin-strict" || variant === "adalimumab-strict";

  let hasStep: boolean;
  if (isAdalimumab) {
    hasStep = isDeniedVariant
      ? !!ctx?.hasMtxTrial  // strict: trial required, intolerance not enough
      : !!ctx?.hasMtxTrial || !!ctx?.hasMtxIntolerance;
    if (!hasStep) {
      missing.push(isDeniedVariant
        ? "Step therapy not met: policy requires documented MTX trial — intolerance alone insufficient"
        : "Step therapy not met: no MTX trial or intolerance documented");
    }
  } else {
    hasStep = isDeniedVariant
      ? !!ctx?.hasMetforminTrial
      : !!ctx?.hasMetforminTrial || !!ctx?.hasMetforminIntolerance;
    if (!hasStep) {
      missing.push(isDeniedVariant
        ? "Step therapy not met: policy requires documented metformin trial — intolerance alone insufficient"
        : "Step therapy not met: no metformin trial or intolerance documented");
    }
  }

  return { policyName: policy.name, medicationClass, requires, missing, variant, version: policy.version };
}
