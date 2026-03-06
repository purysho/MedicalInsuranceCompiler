import { FhirStore } from "../fhirStore.js";
import { checkPolicy } from "../policy.js";

export async function runDecision(store: FhirStore, args: { requestContext: any; claimId: string }) {
  const { requestContext, claimId } = args;
  const policyResult = checkPolicy(requestContext);
  const approved = (policyResult.missing ?? []).length === 0;

  const claimResponse = store.create({
    resourceType: "ClaimResponse",
    status: "active",
    outcome: approved ? "complete" : "error",
    disposition: approved ? "APPROVED" : "DENIED",
    request: { reference: `Claim/${claimId}` },
    created: new Date().toISOString(),
    error: approved ? undefined : policyResult.missing.map((m, i) => ({ code: { text: m }, detail: { text: `Missing ${i + 1}` } }))
  });

  return { policyResult, claimResponse };
}
