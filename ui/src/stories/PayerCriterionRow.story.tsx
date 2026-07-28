import React from "react";
import { Story } from "./story";
import { PayerCriterionRow } from "../components/clinical";

const story: Story = {
  title: "PayerCriterionRow",
  scenes: [
    {
      name: "Normal — supported",
      node: <PayerCriterionRow criterion="Documented trial of metformin ≥ 3 months" state="supported" />,
    },
    {
      name: "Edge — missing",
      node: <PayerCriterionRow criterion="Recent HbA1c within 90 days" state="missing" detail="No A1c result found in the ledger." />,
    },
    {
      name: "Conflicting",
      node: <PayerCriterionRow criterion="Primary diagnosis" state="conflicting" detail="Two Condition resources disagree." />,
    },
    {
      name: "Needs clinician confirmation",
      node: <PayerCriterionRow criterion="Contraindication to first-line therapy" state="needs-clinician-confirmation" />,
    },
  ],
};
export default story;
