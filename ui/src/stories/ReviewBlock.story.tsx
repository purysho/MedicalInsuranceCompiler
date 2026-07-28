import React from "react";
import { Story } from "./story";
import { ReviewBlock } from "../components/clinical";

const noop = () => {};

const story: Story = {
  title: "ReviewBlock",
  scenes: [
    {
      name: "Normal — pending, comment required",
      node: (
        <ReviewBlock
          requiredApprover="Clinician reviewer"
          approvalState="pending"
          requiresComment
          onApprove={noop}
        />
      ),
    },
    {
      name: "Approved — handoff enabled",
      node: (
        <ReviewBlock
          requiredApprover="Clinician reviewer"
          approvalState="approved"
          onApprove={noop}
          onHandoff={noop}
        />
      ),
    },
    {
      name: "Blocked — conflicting evidence",
      node: (
        <ReviewBlock
          requiredApprover="Clinician reviewer"
          approvalState="blocked"
          warning="Conflicting evidence requires clinician resolution before packet can be approved."
          onApprove={noop}
        />
      ),
    },
  ],
};
export default story;
