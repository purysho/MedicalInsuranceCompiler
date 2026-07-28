import React, { useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { TextInput, Select, Button, Toast } from "../components/primitives";
import { apiPost } from "../api";

export interface NewCaseValues {
  patientName: string;
  medication: string;
  payer: string;
  workflowType: "initial-pa" | "appeal";
}

export interface NewCasePageProps {
  /** Injectable submit for tests; defaults to POST /api/cases. */
  onSubmitCase?: (values: NewCaseValues) => Promise<{ id: string }>;
  onCreated?: (id: string) => void;
}

async function defaultSubmit(values: NewCaseValues): Promise<{ id: string }> {
  const r = await apiPost<{ case: { id: string } }>("/api/cases", values);
  return { id: r.case.id };
}

/** Create-a-case form with client-side required-field validation. */
export function NewCasePage({ onSubmitCase = defaultSubmit, onCreated }: NewCasePageProps) {
  const [values, setValues] = useState<NewCaseValues>({
    patientName: "", medication: "", payer: "", workflowType: "initial-pa",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof NewCaseValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  function set<K extends keyof NewCaseValues>(k: K, v: NewCaseValues[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof NewCaseValues, string>> = {};
    if (!values.patientName.trim()) e.patientName = "Patient is required.";
    if (!values.medication.trim()) e.medication = "Requested medication/procedure is required.";
    if (!values.payer.trim()) e.payer = "Payer is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitError(null);
    if (!validate()) return; // blocked: required fields missing
    setSubmitting(true);
    try {
      const { id } = await onSubmitCase(values);
      setCreated(id);
      onCreated?.(id);
    } catch (err: any) {
      setSubmitError(err?.message ?? "Failed to create case.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title="New case">
      <form onSubmit={onSubmit} noValidate style={{ maxWidth: 560 }}>
        {created && <Toast variant="success" title="Case created">Case {created} created.</Toast>}
        {submitError && <Toast variant="danger" title="Could not create case">{submitError}</Toast>}

        <TextInput
          label="Patient"
          required
          placeholder="Search or enter patient name"
          value={values.patientName}
          error={errors.patientName}
          onChange={(e) => set("patientName", e.target.value)}
        />
        <TextInput
          label="Requested medication / procedure"
          required
          value={values.medication}
          error={errors.medication}
          onChange={(e) => set("medication", e.target.value)}
        />
        <TextInput
          label="Payer"
          required
          value={values.payer}
          error={errors.payer}
          onChange={(e) => set("payer", e.target.value)}
        />
        <Select
          label="Workflow type"
          value={values.workflowType}
          onChange={(e) => set("workflowType", e.target.value as NewCaseValues["workflowType"])}
          options={[
            { value: "initial-pa", label: "Initial prior authorization" },
            { value: "appeal", label: "Appeal (post-denial)" },
          ]}
        />

        <div style={{ marginTop: "var(--space-3)" }}>
          <Button type="submit" variant="primary" loading={submitting}>Create case</Button>
        </div>
      </form>
    </PageLayout>
  );
}
