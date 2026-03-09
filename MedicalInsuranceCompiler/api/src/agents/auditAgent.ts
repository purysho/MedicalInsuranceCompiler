import { FhirStore } from "../fhirStore.js";

export function writeProvenance(store: FhirStore, args: {
  activityText: string;
  targetRefs: string[];
  usedRefs: string[];
  agent: string;
}) {
  const { activityText, targetRefs, usedRefs, agent } = args;

  store.create({
    resourceType: "Provenance",
    recorded: new Date().toISOString(),
    activity: { text: activityText },
    agent: [{ type: { text: "software" }, who: { display: agent } }],
    target: targetRefs.map(r => ({ reference: r })),
    entity: usedRefs.map(r => ({ role: "source", what: { reference: r } }))
  });
}
