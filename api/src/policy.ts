
import { getPolicyDefinition } from "./policies.js";

export type PolicyResult = {
  policyName: string;
  requires: { key: string; label: string }[];
  missing: string[];
  variant?: string;
  version?: string;
};

export function checkPolicy(ctx: any): PolicyResult {
  const variant = (ctx?.policyVariant ?? "standard") as string;
  const policy = getPolicyDefinition(variant);
  const a1cRule = policy.rules.find((r) => r.key === "a1c");
  const threshold = a1cRule?.threshold ?? 7.0;

  const requires = policy.rules.map((r) => ({ key: r.key, label: r.label }));

  const missing: string[] = [];
  if (!ctx?.hasT2D) missing.push("Missing T2D diagnosis (Condition)");
  if (typeof ctx?.a1cValue !== "number") missing.push("Missing HbA1c (Observation)");
  else if (ctx.a1cValue < threshold) missing.push(`HbA1c below threshold (${ctx.a1cValue} < ${threshold})`);

  // "denied" variant requires documented trial duration — intolerance alone is insufficient
  const isDeniedVariant = variant === "denied";
  const hasStep = isDeniedVariant
    ? !!ctx?.hasMetforminTrial  // intolerance does NOT satisfy this variant
    : !!ctx?.hasMetforminTrial || !!ctx?.hasMetforminIntolerance;

  if (!hasStep) {
    if (isDeniedVariant) {
      missing.push("Step therapy not met: policy requires documented metformin trial ≥ 3 months — intolerance alone is insufficient under this payer contract");
    } else {
      missing.push("Step therapy not met: no metformin trial/intolerance found");
    }
  }

  return { policyName: policy.name, requires, missing, variant, version: policy.version };
}
