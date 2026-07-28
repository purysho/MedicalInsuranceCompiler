import React from "react";
import { Story } from "./story";
import { AriaPanel } from "../components/clinical";
import { MOCK_CITATIONS, MOCK_DRAFT } from "./mockData";

const story: Story = {
  title: "AriaPanel",
  scenes: [
    {
      name: "Normal — cited draft",
      node: <AriaPanel draft={MOCK_DRAFT} citations={MOCK_CITATIONS} uncertaintyFlags={[]} />,
    },
    {
      name: "Edge — uncertainty flags + blocked approve (uncited paragraph)",
      node: (
        <AriaPanel
          draft={MOCK_DRAFT + "\n\nThe patient also reports improved mobility."}
          citations={MOCK_CITATIONS}
          uncertaintyFlags={[
            "Paragraph 4 has no matching EvidenceItem.",
            "Weak citation support for mobility claim.",
          ]}
          approveBlockedReason="Remove the uncited paragraph or add a citation before approving."
        />
      ),
    },
    {
      name: "Loading — ARIA is drafting",
      node: <AriaPanel draft="" citations={[]} uncertaintyFlags={[]} loading />,
    },
  ],
};
export default story;
