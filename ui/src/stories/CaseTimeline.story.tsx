import React from "react";
import { Story } from "./story";
import { CaseTimeline, AuditEventRow } from "../components/clinical";
import { MOCK_EVENTS } from "./mockData";

const story: Story = {
  title: "CaseTimeline & AuditEventRow",
  scenes: [
    { name: "Normal — full timeline", node: <CaseTimeline events={MOCK_EVENTS} /> },
    { name: "Single AuditEventRow", node: <AuditEventRow event={MOCK_EVENTS[0]} /> },
    { name: "Empty — no events", node: <CaseTimeline events={[]} /> },
  ],
};
export default story;
