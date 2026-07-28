import React from "react";
import { Story } from "./story";
import { StatusBadge } from "../components/clinical";

const story: Story = {
  title: "StatusBadge",
  scenes: [
    { name: "Normal — mid workflow", node: <StatusBadge status="Clinician review" /> },
    { name: "Edge — needs information", node: <StatusBadge status="Needs information" /> },
    { name: "Terminal — outcome recorded", node: <StatusBadge status="Outcome recorded" /> },
  ],
};
export default story;
