import React from "react";
import { Story } from "./story";
import { EvidenceRow } from "../components/clinical";

const story: Story = {
  title: "EvidenceRow",
  scenes: [
    {
      name: "Normal — verified, linked",
      node: (
        <EvidenceRow
          source="HbA1c lab result"
          date="05/02/24"
          confidence="high"
          verificationStatus="verified"
          reviewerState="accepted"
          sourceUrl="https://example.org/labs/a1c"
          onFlag={() => {}}
        />
      ),
    },
    {
      name: "Edge — low confidence, unverified",
      node: (
        <EvidenceRow
          source="Clinical note (scanned)"
          date="04/18/24"
          confidence="low"
          verificationStatus="unverified"
          reviewerState="unreviewed"
        />
      ),
    },
    {
      name: "Error — disputed, no source link",
      node: (
        <EvidenceRow
          source="Prior-treatment history"
          date="03/30/24"
          confidence="medium"
          verificationStatus="disputed"
          reviewerState="flagged"
        />
      ),
    },
  ],
};
export default story;
